//! Parent-scoped family views and actions:
//! - GET /parent/children + /parent/children/{id}/report
//! - PUT /parent/children/{id}/display-mode
//! - GET /parent/approvals + POST /parent/approvals/{id}/{approve,dismiss}
//!   (the "Needs your OK" queue: pending share posts + premium-unlock requests)
//!
//! Adult-only (kid tokens are rejected by `AdultAuth`). All queries run against
//! `state.db` with runtime `sqlx::query` (no offline-cache entries needed) and
//! are scoped to the caller's own children via `parent_account_id`.

use axum::{
    extract::{Path, State},
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use utoipa::ToSchema;
use uuid::Uuid;

use idea_pop_domain::{progress::level_from_xp, DomainError, Role};

use crate::{error::ApiError, extractor::AdultAuth, portfolio, state::AppState};

/// Parent-only guard for `/parent/*` routes. `AdultAuth` alone accepts any
/// adult role (teacher/reviewer/admin), so these endpoints additionally require
/// the caller to actually be a parent — mirrors `require_teacher` in teacher.rs.
pub(crate) fn require_parent(role: &Role) -> Result<(), ApiError> {
    if matches!(role, Role::Parent) {
        Ok(())
    } else {
        Err(DomainError::Forbidden("Parent role required".into()).into())
    }
}

// ── DTOs (match the frontend ParentChild / ChildReport contract) ────────────────

#[derive(Serialize, ToSchema)]
pub struct ParentChildResponse {
    pub id: Uuid,
    pub nickname: String,
    pub avatar_id: String,
    pub birth_year: i32,
    pub level: i32,
    pub total_xp: i32,
    pub consent_granted: bool,
    pub class_sharing_enabled: bool,
    pub public_sharing_enabled: bool,
    /// How the child is shown on shared content:
    /// avatar_nickname | first_name | anonymous.
    pub display_mode: String,
    /// Whether the scoped AI mission helper is switched on for this child.
    pub helper_enabled: bool,
}

#[derive(Serialize, ToSchema)]
pub struct ParentProjectSummary {
    pub id: Uuid,
    pub title: String,
    pub what_i_made: String,
    pub project_photo_url: Option<String>,
    pub visibility: String,
    pub visibility_pending: bool,
    pub created_at: String,
    pub challenge_title: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct ChildReportResponse {
    pub child_id: Uuid,
    pub week_start: String,
    pub explore_videos_watched: i32,
    pub lessons_completed: i32,
    pub challenges_completed: i32,
    pub xp_earned: i32,
    pub projects: Vec<ParentProjectSummary>,
}

fn internal(e: sqlx::Error) -> DomainError {
    DomainError::Internal(e.to_string())
}

// ── GET /parent/children ────────────────────────────────────────────────────────

/// List the authenticated parent's children with level, XP and sharing state.
#[utoipa::path(get, path = "/parent/children", tag = "children",
    responses(
        (status = 200, description = "The caller's children", body = [ParentChildResponse]),
        (status = 401, description = "Not authenticated", body = crate::ProblemDetail),
        (status = 403, description = "Kid tokens rejected", body = crate::ProblemDetail),
    ))]
pub async fn list_children(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
) -> Result<Json<Vec<ParentChildResponse>>, ApiError> {
    require_parent(&claims.role)?;
    let rows = sqlx::query(
        r#"SELECT c.id, c.nickname, c.avatar_id, c.birth_year, c.display_mode, c.helper_enabled,
                  COALESCE((SELECT SUM(amount) FROM xp_events WHERE child_id = c.id), 0) AS total_xp,
                  (SELECT status FROM parental_consents
                   WHERE child_id = c.id ORDER BY sent_at DESC LIMIT 1) AS consent_status
           FROM child_profiles c
           WHERE c.parent_account_id = $1
           ORDER BY c.created_at"#,
    )
    .bind(claims.account_id)
    .fetch_all(&state.db)
    .await
    .map_err(internal)?;

    let children = rows
        .iter()
        .map(|r| {
            let total_xp: i64 = r.try_get("total_xp").unwrap_or(0);
            let avatar_id: String = r.try_get("avatar_id").unwrap_or_default();
            let birth_year: i16 = r.try_get("birth_year").unwrap_or(0);
            let status: Option<String> = r.try_get("consent_status").ok().flatten();
            let s = status.as_deref();
            ParentChildResponse {
                id: r.try_get("id").unwrap_or_default(),
                nickname: r.try_get("nickname").unwrap_or_default(),
                avatar_id,
                birth_year: birth_year as i32,
                level: level_from_xp(total_xp as i32) as i32,
                total_xp: total_xp as i32,
                consent_granted: s == Some("granted"),
                class_sharing_enabled: s == Some("class_granted"),
                public_sharing_enabled: matches!(s, Some("granted") | Some("class_granted")),
                display_mode: r
                    .try_get("display_mode")
                    .unwrap_or_else(|_| "avatar_nickname".to_owned()),
                helper_enabled: r.try_get("helper_enabled").unwrap_or(false),
            }
        })
        .collect();

    Ok(Json(children))
}

// ── GET /parent/children/{id}/report ────────────────────────────────────────────

/// This-week activity report for one of the caller's children.
#[utoipa::path(get, path = "/parent/children/{id}/report", tag = "children",
    params(("id" = Uuid, Path, description = "Child profile UUID")),
    responses(
        (status = 200, description = "Weekly report", body = ChildReportResponse),
        (status = 403, description = "Not the parent of this child", body = crate::ProblemDetail),
        (status = 404, description = "Not found", body = crate::ProblemDetail),
    ))]
pub async fn child_report(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
    Path(child_id): Path<Uuid>,
) -> Result<Json<ChildReportResponse>, ApiError> {
    require_parent(&claims.role)?;
    // Ownership: only the parent who owns the child may read the report.
    let owner: Option<Uuid> =
        sqlx::query_scalar("SELECT parent_account_id FROM child_profiles WHERE id = $1")
            .bind(child_id)
            .fetch_optional(&state.db)
            .await
            .map_err(internal)?;
    match owner {
        None => return Err(DomainError::NotFound.into()),
        Some(p) if p != claims.account_id => {
            return Err(DomainError::Forbidden("not the parent of this child".into()).into());
        }
        _ => {}
    }

    let row = sqlx::query(
        r#"SELECT
             (SELECT COUNT(*) FROM video_views
              WHERE child_id = $1 AND date_trunc('week', viewed_at) = date_trunc('week', now())) AS videos,
             (SELECT COUNT(*) FROM lesson_completions
              WHERE child_id = $1 AND date_trunc('week', completed_at) = date_trunc('week', now())) AS lessons,
             (SELECT COUNT(DISTINCT challenge_id) FROM challenge_attempts
              WHERE child_id = $1 AND status = 'completed'
                AND date_trunc('week', completed_at) = date_trunc('week', now())) AS challenges,
             COALESCE((SELECT SUM(amount) FROM xp_events
              WHERE child_id = $1 AND date_trunc('week', created_at) = date_trunc('week', now())), 0) AS xp,
             to_char(date_trunc('week', now()), 'YYYY-MM-DD') AS week_start"#,
    )
    .bind(child_id)
    .fetch_one(&state.db)
    .await
    .map_err(internal)?;

    let project_rows = sqlx::query(
        r#"SELECT id, title, description, requested_visibility, effective_visibility, created_at
           FROM projects WHERE child_id = $1 ORDER BY created_at DESC"#,
    )
    .bind(child_id)
    .fetch_all(&state.db)
    .await
    .map_err(internal)?;

    let projects = project_rows
        .iter()
        .map(|r| {
            let req: String = r.try_get("requested_visibility").unwrap_or_default();
            let eff: String = r.try_get("effective_visibility").unwrap_or_default();
            let created: chrono::DateTime<chrono::Utc> = r
                .try_get("created_at")
                .unwrap_or_else(|_| chrono::Utc::now());
            ParentProjectSummary {
                id: r.try_get("id").unwrap_or_default(),
                title: r.try_get("title").unwrap_or_default(),
                what_i_made: r.try_get("description").unwrap_or_default(),
                // Photos are private S3 keys; a presigned URL is out of scope here.
                project_photo_url: None,
                visibility: eff.clone(),
                visibility_pending: req != eff,
                created_at: created.to_rfc3339(),
                challenge_title: None,
            }
        })
        .collect();

    let as_i32 = |name: &str| row.try_get::<i64, _>(name).unwrap_or(0) as i32;

    Ok(Json(ChildReportResponse {
        child_id,
        week_start: row.try_get("week_start").unwrap_or_default(),
        explore_videos_watched: as_i32("videos"),
        lessons_completed: as_i32("lessons"),
        challenges_completed: as_i32("challenges"),
        xp_earned: as_i32("xp"),
        projects,
    }))
}

// ── PUT /parent/children/{id}/display-mode ──────────────────────────────────────

#[derive(Deserialize, ToSchema)]
pub struct UpdateDisplayModeRequest {
    /// avatar_nickname | first_name | anonymous
    pub display_mode: String,
}

#[derive(Serialize, ToSchema)]
pub struct DisplayModeResponse {
    pub child_id: Uuid,
    pub display_mode: String,
}

/// Set how one of the caller's children is shown on shared content.
#[utoipa::path(put, path = "/parent/children/{id}/display-mode", tag = "children",
    params(("id" = Uuid, Path, description = "Child profile UUID")),
    request_body = UpdateDisplayModeRequest,
    responses(
        (status = 200, description = "Display mode updated", body = DisplayModeResponse),
        (status = 403, description = "Not the parent of this child", body = crate::ProblemDetail),
        (status = 404, description = "Not found", body = crate::ProblemDetail),
        (status = 422, description = "Invalid display_mode", body = crate::ProblemDetail),
    ))]
pub async fn set_display_mode(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
    Path(child_id): Path<Uuid>,
    Json(body): Json<UpdateDisplayModeRequest>,
) -> Result<Json<DisplayModeResponse>, ApiError> {
    require_parent(&claims.role)?;
    const ALLOWED: [&str; 3] = ["avatar_nickname", "first_name", "anonymous"];
    if !ALLOWED.contains(&body.display_mode.as_str()) {
        return Err(DomainError::Validation(
            "display_mode must be one of avatar_nickname | first_name | anonymous".into(),
        )
        .into());
    }

    assert_own_child(&state, claims.account_id, child_id).await?;

    sqlx::query("UPDATE child_profiles SET display_mode = $1 WHERE id = $2")
        .bind(&body.display_mode)
        .bind(child_id)
        .execute(&state.db)
        .await
        .map_err(internal)?;

    Ok(Json(DisplayModeResponse {
        child_id,
        display_mode: body.display_mode,
    }))
}

/// 404 if the child doesn't exist; 403 if it belongs to another parent.
pub(crate) async fn assert_own_child(
    state: &AppState,
    parent_id: Uuid,
    child_id: Uuid,
) -> Result<(), ApiError> {
    let owner: Option<Uuid> =
        sqlx::query_scalar("SELECT parent_account_id FROM child_profiles WHERE id = $1")
            .bind(child_id)
            .fetch_optional(&state.db)
            .await
            .map_err(internal)?;
    match owner {
        None => Err(DomainError::NotFound.into()),
        Some(p) if p != parent_id => {
            Err(DomainError::Forbidden("not the parent of this child".into()).into())
        }
        _ => Ok(()),
    }
}

// ── GET /parent/approvals — the "Needs your OK" queue ───────────────────────────

#[derive(Serialize, ToSchema)]
pub struct ParentApprovalResponse {
    /// share_post → moderation_queue id; premium_unlock → premium_unlock_requests id.
    pub id: Uuid,
    /// share_post | premium_unlock
    pub kind: String,
    pub child_id: Uuid,
    pub child_nickname: String,
    /// Project title or idea text (share_post only).
    pub title: Option<String>,
    /// Visibility the child asked for (share_post projects only).
    pub requested_visibility: Option<String>,
    pub created_at: String,
}

#[derive(Deserialize, ToSchema)]
pub struct ResolveApprovalRequest {
    /// share_post | premium_unlock — which queue the id belongs to.
    pub kind: String,
}

#[derive(Serialize, ToSchema)]
pub struct ResolveApprovalResponse {
    pub id: Uuid,
    pub status: String,
}

/// Pending items awaiting the caller's OK: the children's share requests
/// (posts in the moderation queue) and premium-unlock requests.
#[utoipa::path(get, path = "/parent/approvals", tag = "children",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Pending approvals, oldest first", body = [ParentApprovalResponse]),
        (status = 401, description = "Not authenticated", body = crate::ProblemDetail),
        (status = 403, description = "Kid tokens rejected", body = crate::ProblemDetail),
    ))]
pub async fn list_approvals(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
) -> Result<Json<Vec<ParentApprovalResponse>>, ApiError> {
    require_parent(&claims.role)?;
    let share_rows = sqlx::query(
        r#"SELECT m.id, m.created_at, c.id AS child_id, c.nickname,
                  COALESCE(p.title, i.text) AS title,
                  p.requested_visibility
           FROM moderation_queue m
           LEFT JOIN projects p        ON m.content_type = 'project' AND p.id = m.content_id
           LEFT JOIN challenge_ideas i ON m.content_type = 'idea'    AND i.id = m.content_id
           JOIN child_profiles c ON c.id = COALESCE(p.child_id, i.child_id)
           WHERE m.status = 'pending' AND c.parent_account_id = $1"#,
    )
    .bind(claims.account_id)
    .fetch_all(&state.db)
    .await
    .map_err(internal)?;

    let unlock_rows = sqlx::query(
        r#"SELECT r.id, r.created_at, c.id AS child_id, c.nickname
           FROM premium_unlock_requests r
           JOIN child_profiles c ON c.id = r.child_id
           WHERE r.status = 'pending' AND c.parent_account_id = $1"#,
    )
    .bind(claims.account_id)
    .fetch_all(&state.db)
    .await
    .map_err(internal)?;

    let created = |r: &sqlx::postgres::PgRow| -> String {
        r.try_get::<chrono::DateTime<Utc>, _>("created_at")
            .unwrap_or_else(|_| Utc::now())
            .to_rfc3339()
    };

    let mut items: Vec<ParentApprovalResponse> = share_rows
        .iter()
        .map(|r| ParentApprovalResponse {
            id: r.try_get("id").unwrap_or_default(),
            kind: "share_post".to_owned(),
            child_id: r.try_get("child_id").unwrap_or_default(),
            child_nickname: r.try_get("nickname").unwrap_or_default(),
            title: r.try_get("title").ok(),
            requested_visibility: r.try_get("requested_visibility").ok().flatten(),
            created_at: created(r),
        })
        .chain(unlock_rows.iter().map(|r| ParentApprovalResponse {
            id: r.try_get("id").unwrap_or_default(),
            kind: "premium_unlock".to_owned(),
            child_id: r.try_get("child_id").unwrap_or_default(),
            child_nickname: r.try_get("nickname").unwrap_or_default(),
            title: None,
            requested_visibility: None,
            created_at: created(r),
        }))
        .collect();
    items.sort_by(|a, b| a.created_at.cmp(&b.created_at));

    Ok(Json(items))
}

// ── POST /parent/approvals/{id}/approve | /dismiss ──────────────────────────────

/// Approve a pending item. share_post: records the parent as the human
/// approver and applies the same side-effects as the reviewer queue
/// (promotes project visibility / marks the idea approved). premium_unlock:
/// marks the request approved — payment still happens only on the parent's
/// own billing flow.
#[utoipa::path(post, path = "/parent/approvals/{id}/approve", tag = "children",
    params(("id" = Uuid, Path, description = "Approval item UUID")),
    request_body = ResolveApprovalRequest,
    responses(
        (status = 200, description = "Approved", body = ResolveApprovalResponse),
        (status = 403, description = "Not the parent of this child", body = crate::ProblemDetail),
        (status = 404, description = "Not found or not pending", body = crate::ProblemDetail),
        (status = 422, description = "Unknown kind", body = crate::ProblemDetail),
    ))]
pub async fn approve_approval(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
    Json(body): Json<ResolveApprovalRequest>,
) -> Result<Json<ResolveApprovalResponse>, ApiError> {
    require_parent(&claims.role)?;
    resolve_approval(&state, claims.account_id, item_id, &body.kind, true).await
}

/// Dismiss a pending item. share_post: rejects the moderation item (the
/// content stays private). premium_unlock: marks the request dismissed.
#[utoipa::path(post, path = "/parent/approvals/{id}/dismiss", tag = "children",
    params(("id" = Uuid, Path, description = "Approval item UUID")),
    request_body = ResolveApprovalRequest,
    responses(
        (status = 200, description = "Dismissed", body = ResolveApprovalResponse),
        (status = 403, description = "Not the parent of this child", body = crate::ProblemDetail),
        (status = 404, description = "Not found or not pending", body = crate::ProblemDetail),
        (status = 422, description = "Unknown kind", body = crate::ProblemDetail),
    ))]
pub async fn dismiss_approval(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
    Json(body): Json<ResolveApprovalRequest>,
) -> Result<Json<ResolveApprovalResponse>, ApiError> {
    require_parent(&claims.role)?;
    resolve_approval(&state, claims.account_id, item_id, &body.kind, false).await
}

async fn resolve_approval(
    state: &AppState,
    parent_id: Uuid,
    item_id: Uuid,
    kind: &str,
    approve: bool,
) -> Result<Json<ResolveApprovalResponse>, ApiError> {
    let status = if approve { "approved" } else { "dismissed" };
    match kind {
        "share_post" => {
            // Ownership: the moderation item must reference content by one of
            // the caller's children.
            let owner: Option<Uuid> = sqlx::query_scalar(
                r#"SELECT c.parent_account_id
                   FROM moderation_queue m
                   LEFT JOIN projects p        ON m.content_type = 'project' AND p.id = m.content_id
                   LEFT JOIN challenge_ideas i ON m.content_type = 'idea'    AND i.id = m.content_id
                   JOIN child_profiles c ON c.id = COALESCE(p.child_id, i.child_id)
                   WHERE m.id = $1 AND m.status = 'pending'"#,
            )
            .bind(item_id)
            .fetch_optional(&state.db)
            .await
            .map_err(internal)?;
            match owner {
                None => return Err(DomainError::NotFound.into()),
                Some(p) if p != parent_id => {
                    return Err(
                        DomainError::Forbidden("not the parent of this child".into()).into(),
                    );
                }
                _ => {}
            }

            let now = Utc::now();
            if approve {
                let item = state
                    .portfolio
                    .moderation
                    .approve(item_id, parent_id, now)
                    .await?
                    .ok_or(ApiError::Domain(DomainError::NotFound))?;
                portfolio::apply_approval_side_effects(state, &item, now).await?;
            } else {
                let item = state
                    .portfolio
                    .moderation
                    .reject(item_id, parent_id, "Dismissed by parent".to_owned(), now)
                    .await?
                    .ok_or(ApiError::Domain(DomainError::NotFound))?;
                portfolio::apply_rejection_side_effects(state, &item).await?;
            }
        }
        "premium_unlock" => {
            let updated = sqlx::query(
                r#"UPDATE premium_unlock_requests r
                   SET status = $1, resolved_at = now(), resolved_by = $2
                   FROM child_profiles c
                   WHERE r.id = $3 AND r.status = 'pending'
                     AND c.id = r.child_id AND c.parent_account_id = $2"#,
            )
            .bind(status)
            .bind(parent_id)
            .bind(item_id)
            .execute(&state.db)
            .await
            .map_err(internal)?;
            if updated.rows_affected() == 0 {
                // Either not found / already resolved, or another parent's child.
                let exists: Option<Uuid> = sqlx::query_scalar(
                    "SELECT id FROM premium_unlock_requests WHERE id = $1 AND status = 'pending'",
                )
                .bind(item_id)
                .fetch_optional(&state.db)
                .await
                .map_err(internal)?;
                return Err(match exists {
                    Some(_) => DomainError::Forbidden("not the parent of this child".into()).into(),
                    None => DomainError::NotFound.into(),
                });
            }
        }
        _ => {
            return Err(
                DomainError::Validation("kind must be share_post | premium_unlock".into()).into(),
            );
        }
    }

    Ok(Json(ResolveApprovalResponse {
        id: item_id,
        status: status.to_owned(),
    }))
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ResetChildPinResponse {
    pub child_id: Uuid,
    /// Shown once, here and nowhere else; only the hash is kept.
    pub login_pin: String,
}

/// Give a child a new PIN when they have forgotten theirs, or a first one when
/// a parent added them and never set one. Clears any pause on wrong tries.
#[utoipa::path(post, path = "/parent/children/{id}/reset-pin", tag = "children",
    params(("id" = Uuid, Path, description = "Child profile UUID")),
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "New PIN (shown once)", body = ResetChildPinResponse),
        (status = 403, description = "Parent role required", body = crate::ProblemDetail),
        (status = 404, description = "Not your child", body = crate::ProblemDetail),
    ))]
pub async fn reset_child_pin(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
    Path(child_id): Path<Uuid>,
) -> Result<Json<ResetChildPinResponse>, ApiError> {
    require_parent(&claims.role)?;
    let mine: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM child_profiles WHERE id = $1 AND parent_account_id = $2",
    )
    .bind(child_id)
    .bind(claims.account_id)
    .fetch_optional(&state.db)
    .await
    .map_err(internal)?;
    if mine.is_none() {
        return Err(DomainError::NotFound.into());
    }

    let pin = crate::teacher::generate_pin();
    let pin_hash = state.auth.hasher.hash(&pin).await?;
    sqlx::query(
        "UPDATE child_profiles
         SET login_pin_hash = $1, pin_attempts = 0, pin_locked_until = NULL
         WHERE id = $2",
    )
    .bind(&pin_hash)
    .bind(child_id)
    .execute(&state.db)
    .await
    .map_err(internal)?;

    Ok(Json(ResetChildPinResponse {
        child_id,
        login_pin: pin,
    }))
}
