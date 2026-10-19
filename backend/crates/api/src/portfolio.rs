//! Portfolio, Ideas Wall, Moderation, and Reporting handlers.
//!
//! Security invariants enforced here:
//! - Projects are Private by default; promotion to Class/Public enqueues moderation.
//! - Effective visibility stays Private until a reviewer approves.
//! - Identity on shared content is ONLY avatar_id + nickname; no account_id or PII.
//! - Ideas Wall is locked-until-submit for kids (reviewers/adults are exempt).
//! - Sharing/idea-submit/remix routes require a consent-gated kid token.
//! - Reviewer endpoints require Role::Reviewer or Role::Admin.

use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{header::CONTENT_TYPE, HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use idea_pop_domain::{
    portfolio::{
        check_project_photo, clean_project_text, ChallengeIdea, ModerationContentType,
        ModerationItem, OriginType, Project, ReactionType, Report, VisibilityChangeResult,
    },
    request_visibility_change, DomainError, Role, Visibility,
};

use crate::{
    error::ApiError,
    extractor::{AuthToken, KidAuth, ReviewerAuth},
    state::AppState,
};

// ── DTOs ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateProjectRequest {
    pub origin_type: String,
    pub origin_id: Uuid,
    pub title: String,
    /// What the child made, in their own words.
    #[serde(default)]
    pub description: String,
    /// What they used.
    #[serde(default)]
    pub materials: String,
    #[serde(default)]
    pub what_was_hard: String,
    #[serde(default)]
    pub what_to_improve: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ProjectResponse {
    pub id: Uuid,
    pub origin_type: String,
    pub origin_id: Uuid,
    pub title: String,
    pub description: String,
    pub materials: String,
    pub what_was_hard: String,
    pub what_to_improve: String,
    pub photo_keys: Vec<String>,
    pub requested_visibility: String,
    pub effective_visibility: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ProjectListResponse {
    pub items: Vec<ProjectResponse>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PresignResponse {
    pub upload_url: String,
    pub key: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateVisibilityRequest {
    pub visibility: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UpdateVisibilityResponse {
    pub effective_visibility: String,
    pub pending_moderation: bool,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SubmitIdeaRequest {
    pub text: String,
    pub photo_key: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct IdeaResponse {
    pub id: Uuid,
    pub challenge_id: Uuid,
    pub text: String,
    pub photo_key: Option<String>,
    pub remix_of: Option<Uuid>,
    pub moderation_status: String,
    pub created_at: String,
    pub reactions: ReactionCountsDto,
}

#[derive(Debug, Serialize, ToSchema, Default)]
pub struct ReactionCountsDto {
    pub claps: u32,
    pub stars: u32,
    pub lightbulbs: u32,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct IdeaListResponse {
    pub items: Vec<IdeaResponse>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ReactRequest {
    pub reaction_type: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RemixRequest {
    pub text: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ModerationItemResponse {
    pub id: Uuid,
    pub content_type: String,
    pub content_id: Uuid,
    pub status: String,
    pub reason: Option<String>,
    pub created_at: String,
    pub due_at: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ModerationQueueResponse {
    pub items: Vec<ModerationItemResponse>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RejectRequest {
    pub reason: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateReportRequest {
    pub content_type: String,
    pub content_id: Uuid,
    pub reason: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ReportResponse {
    pub id: Uuid,
    pub content_type: String,
    pub content_id: Uuid,
    pub reason: String,
    pub status: String,
    pub created_at: String,
    pub due_at: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ReportListResponse {
    pub items: Vec<ReportResponse>,
}

// ── Mappers ───────────────────────────────────────────────────────────────────

fn map_project(p: Project) -> ProjectResponse {
    ProjectResponse {
        id: p.id,
        origin_type: p.origin_type.as_str().to_owned(),
        origin_id: p.origin_id,
        title: p.title,
        description: p.description,
        materials: p.materials,
        what_was_hard: p.what_was_hard,
        what_to_improve: p.what_to_improve,
        photo_keys: p.photo_keys,
        requested_visibility: p.requested_visibility.as_str().to_owned(),
        effective_visibility: p.effective_visibility.as_str().to_owned(),
        created_at: p.created_at.to_rfc3339(),
    }
}

fn map_moderation_item(m: ModerationItem) -> ModerationItemResponse {
    ModerationItemResponse {
        id: m.id,
        content_type: m.content_type.as_str().to_owned(),
        content_id: m.content_id,
        status: m.status.as_str().to_owned(),
        reason: m.reason,
        created_at: m.created_at.to_rfc3339(),
        due_at: m.due_at.to_rfc3339(),
    }
}

fn map_report(r: Report) -> ReportResponse {
    ReportResponse {
        id: r.id,
        content_type: r.content_type.as_str().to_owned(),
        content_id: r.content_id,
        reason: r.reason,
        status: r.status.as_str().to_owned(),
        created_at: r.created_at.to_rfc3339(),
        due_at: r.due_at.to_rfc3339(),
    }
}

// ── POST /projects ────────────────────────────────────────────────────────────

#[utoipa::path(
    post, path = "/projects", tag = "portfolio",
    request_body = CreateProjectRequest,
    responses(
        (status = 201, description = "Project created (private)", body = ProjectResponse),
        (status = 403, description = "Non-kid token", body = crate::ProblemDetail),
    )
)]
pub async fn create_project(
    KidAuth { child_id, .. }: KidAuth,
    State(state): State<AppState>,
    Json(body): Json<CreateProjectRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let title = body.title.trim().to_owned();
    if title.is_empty() || title.len() > 100 {
        return Err(ApiError::Domain(DomainError::Validation(
            "title must be 1–100 characters".into(),
        )));
    }

    let origin_type = OriginType::from_db(&body.origin_type).ok_or_else(|| {
        ApiError::Domain(DomainError::Validation(
            "origin_type must be challenge, lesson, or quick_make".into(),
        ))
    })?;

    let now = Utc::now();
    let mut project = Project::new(child_id, origin_type, body.origin_id, title, now);
    project.description = clean_project_text(&body.description);
    project.materials = clean_project_text(&body.materials);
    project.what_was_hard = clean_project_text(&body.what_was_hard);
    project.what_to_improve = clean_project_text(&body.what_to_improve);

    state.portfolio.projects.create(&project).await?;

    Ok((StatusCode::CREATED, Json(map_project(project))))
}

// ── GET /me/projects ──────────────────────────────────────────────────────────

#[utoipa::path(
    get, path = "/me/projects", tag = "portfolio",
    responses(
        (status = 200, description = "Child's projects", body = ProjectListResponse),
        (status = 403, description = "Non-kid token", body = crate::ProblemDetail),
    )
)]
pub async fn list_my_projects(
    KidAuth { child_id, .. }: KidAuth,
    State(state): State<AppState>,
) -> Result<Json<ProjectListResponse>, ApiError> {
    let projects = state.portfolio.projects.list_by_child(child_id).await?;
    Ok(Json(ProjectListResponse {
        items: projects.into_iter().map(map_project).collect(),
    }))
}

// ── POST /projects/:id/photos/presign ─────────────────────────────────────────

#[utoipa::path(
    post, path = "/projects/{id}/photos/presign", tag = "portfolio",
    params(("id" = Uuid, Path, description = "Project ID")),
    responses(
        (status = 200, description = "Presigned upload URL", body = PresignResponse),
        (status = 403, description = "Non-kid token or not the owner", body = crate::ProblemDetail),
        (status = 404, description = "Project not found", body = crate::ProblemDetail),
    )
)]
pub async fn presign_photo_upload(
    KidAuth { child_id, .. }: KidAuth,
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<PresignResponse>, ApiError> {
    let project = state
        .portfolio
        .projects
        .find_by_id(project_id)
        .await?
        .ok_or(ApiError::Domain(DomainError::NotFound))?;

    if project.child_id != child_id {
        return Err(ApiError::Domain(DomainError::Forbidden(
            "Project belongs to another child".into(),
        )));
    }

    let key = format!("projects/{child_id}/{project_id}/{}.jpg", Uuid::new_v4());
    let upload_url = state.portfolio.photos.presign_upload(&key, 900).await?;

    Ok(Json(PresignResponse { upload_url, key }))
}

// ── POST /projects/:id/photos ─────────────────────────────────────────────────

/// Adds a photo of the child's project. The image bytes are the request body and its
/// type is the Content-Type header. The photo is stored privately and never changes the
/// project's visibility, so adding one never publishes anything.
#[utoipa::path(
    post, path = "/projects/{id}/photos", tag = "portfolio",
    params(("id" = Uuid, Path, description = "Project ID")),
    request_body(content = Vec<u8>, content_type = "image/jpeg", description = "The photo (JPEG, PNG or WebP, up to 8 MB)"),
    responses(
        (status = 201, description = "Photo added", body = ProjectResponse),
        (status = 403, description = "Non-kid token or not the owner", body = crate::ProblemDetail),
        (status = 404, description = "Project not found", body = crate::ProblemDetail),
        (status = 422, description = "Not an image, too big, or too many photos", body = crate::ProblemDetail),
    )
)]
pub async fn add_project_photo(
    KidAuth { child_id, .. }: KidAuth,
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let project = state
        .portfolio
        .projects
        .find_by_id(project_id)
        .await?
        .ok_or(ApiError::Domain(DomainError::NotFound))?;
    if project.child_id != child_id {
        return Err(ApiError::Domain(DomainError::Forbidden(
            "Project belongs to another child".into(),
        )));
    }

    let content_type = headers
        .get(CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    let ext = check_project_photo(&content_type, body.len(), project.photo_keys.len())?;

    let key = format!("projects/{child_id}/{project_id}/{}.{ext}", Uuid::new_v4());
    state
        .portfolio
        .photos
        .put(&key, body.to_vec(), &content_type)
        .await?;
    let now = Utc::now();
    state
        .portfolio
        .projects
        .add_photo_key(project_id, &key, now)
        .await?;

    let mut project = project;
    project.photo_keys.push(key);
    project.updated_at = now;
    Ok((StatusCode::CREATED, Json(map_project(project))))
}

// ── PATCH /projects/:id/visibility ───────────────────────────────────────────

#[utoipa::path(
    patch, path = "/projects/{id}/visibility", tag = "portfolio",
    params(("id" = Uuid, Path, description = "Project ID")),
    request_body = UpdateVisibilityRequest,
    responses(
        (status = 200, description = "Visibility updated (or pending moderation)", body = UpdateVisibilityResponse),
        (status = 403, description = "Non-kid token, not the owner, or consent required", body = crate::ProblemDetail),
        (status = 404, description = "Project not found", body = crate::ProblemDetail),
    )
)]
pub async fn update_project_visibility(
    KidAuth { child_id, .. }: KidAuth,
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(body): Json<UpdateVisibilityRequest>,
) -> Result<Json<UpdateVisibilityResponse>, ApiError> {
    let target = Visibility::from_db(&body.visibility).ok_or_else(|| {
        ApiError::Domain(DomainError::Validation(
            "visibility must be private, class, or public".into(),
        ))
    })?;

    let project = state
        .portfolio
        .projects
        .find_by_id(project_id)
        .await?
        .ok_or(ApiError::Domain(DomainError::NotFound))?;

    if project.child_id != child_id {
        return Err(ApiError::Domain(DomainError::Forbidden(
            "Project belongs to another child".into(),
        )));
    }

    let now = Utc::now();
    let result = request_visibility_change(target.clone());
    let (effective, pending_moderation) = match result {
        VisibilityChangeResult::Immediate(v) => (v, false),
        VisibilityChangeResult::PendingModeration(_) => {
            // Enqueue moderation; effective stays Private until approved.
            let item = ModerationItem::new(ModerationContentType::Project, project_id, now);
            state.portfolio.moderation.enqueue(&item).await?;
            (Visibility::Private, true)
        }
    };

    state
        .portfolio
        .projects
        .set_visibility(project_id, &target, &effective, now)
        .await?;

    Ok(Json(UpdateVisibilityResponse {
        effective_visibility: effective.as_str().to_owned(),
        pending_moderation,
    }))
}

// ── POST /challenges/:id/ideas ────────────────────────────────────────────────

#[utoipa::path(
    post, path = "/challenges/{id}/ideas", tag = "portfolio",
    params(("id" = Uuid, Path, description = "Challenge ID")),
    request_body = SubmitIdeaRequest,
    responses(
        (status = 201, description = "Idea submitted (pending moderation)", body = IdeaResponse),
        (status = 403, description = "Non-kid token or consent required", body = crate::ProblemDetail),
        (status = 409, description = "Already submitted an idea for this challenge", body = crate::ProblemDetail),
    )
)]
pub async fn submit_idea(
    KidAuth { child_id, .. }: KidAuth,
    Path(challenge_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(body): Json<SubmitIdeaRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let text = body.text.trim().to_owned();
    if text.is_empty() || text.len() > 500 {
        return Err(ApiError::Domain(DomainError::Validation(
            "idea text must be 1–500 characters".into(),
        )));
    }

    // Verify challenge exists
    state
        .challenge
        .find_by_id(challenge_id)
        .await?
        .ok_or(ApiError::Domain(DomainError::NotFound))?;

    // One idea per child per challenge
    if state
        .portfolio
        .ideas
        .has_submitted(child_id, challenge_id)
        .await?
    {
        return Err(ApiError::Domain(DomainError::Conflict(
            "You have already submitted an idea for this challenge".into(),
        )));
    }

    let now = Utc::now();
    let idea = ChallengeIdea::new(child_id, challenge_id, text, body.photo_key, None, now);

    state.portfolio.ideas.submit(&idea).await?;

    // Enqueue moderation for the idea
    let mod_item = ModerationItem::new(ModerationContentType::Idea, idea.id, now);
    state.portfolio.moderation.enqueue(&mod_item).await?;

    Ok((
        StatusCode::CREATED,
        Json(IdeaResponse {
            id: idea.id,
            challenge_id: idea.challenge_id,
            text: idea.text,
            photo_key: idea.photo_key,
            remix_of: idea.remix_of,
            moderation_status: idea.moderation_status.as_str().to_owned(),
            created_at: idea.created_at.to_rfc3339(),
            reactions: ReactionCountsDto::default(),
        }),
    ))
}

// ── GET /challenges/:id/ideas ─────────────────────────────────────────────────

#[utoipa::path(
    get, path = "/challenges/{id}/ideas", tag = "portfolio",
    params(("id" = Uuid, Path, description = "Challenge ID")),
    responses(
        (status = 200, description = "Approved ideas (kid must have submitted first)", body = IdeaListResponse),
        (status = 403, description = "Kid has not yet submitted their own idea", body = crate::ProblemDetail),
    )
)]
pub async fn list_ideas(
    AuthToken(claims): AuthToken,
    Path(challenge_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<IdeaListResponse>, ApiError> {
    // Kids are locked-out until they submit their own idea.
    // Reviewers and admins can always browse.
    if claims.role == Role::Kid {
        let child_id = claims
            .child_id
            .ok_or_else(|| ApiError::Domain(DomainError::Forbidden("Invalid kid token".into())))?;

        if !state
            .portfolio
            .ideas
            .has_submitted(child_id, challenge_id)
            .await?
        {
            return Err(ApiError::Domain(DomainError::Forbidden(
                "Submit your own idea first to unlock the Ideas Wall".into(),
            )));
        }
    }

    let ideas = state.portfolio.ideas.list_approved(challenge_id).await?;
    let mut items = Vec::with_capacity(ideas.len());
    for idea in ideas {
        let counts = state.portfolio.ideas.count_reactions(idea.id).await?;
        items.push(IdeaResponse {
            id: idea.id,
            challenge_id: idea.challenge_id,
            text: idea.text,
            photo_key: idea.photo_key,
            remix_of: idea.remix_of,
            moderation_status: idea.moderation_status.as_str().to_owned(),
            created_at: idea.created_at.to_rfc3339(),
            reactions: ReactionCountsDto {
                claps: counts.claps,
                stars: counts.stars,
                lightbulbs: counts.lightbulbs,
            },
        });
    }

    Ok(Json(IdeaListResponse { items }))
}

// ── POST /ideas/:id/react ─────────────────────────────────────────────────────

#[utoipa::path(
    post, path = "/ideas/{id}/react", tag = "portfolio",
    params(("id" = Uuid, Path, description = "Idea ID")),
    request_body = ReactRequest,
    responses(
        (status = 204, description = "Reaction recorded (idempotent)"),
        (status = 403, description = "Non-kid token", body = crate::ProblemDetail),
        (status = 404, description = "Idea not found", body = crate::ProblemDetail),
    )
)]
pub async fn react_to_idea(
    KidAuth { child_id, .. }: KidAuth,
    Path(idea_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(body): Json<ReactRequest>,
) -> Result<StatusCode, ApiError> {
    let reaction_type = ReactionType::from_str_validated(&body.reaction_type).ok_or_else(|| {
        ApiError::Domain(DomainError::Validation(
            "reaction_type must be claps, stars, or lightbulbs".into(),
        ))
    })?;

    state
        .portfolio
        .ideas
        .find_by_id(idea_id)
        .await?
        .ok_or(ApiError::Domain(DomainError::NotFound))?;

    state
        .portfolio
        .ideas
        .add_reaction(idea_id, child_id, &reaction_type)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ── POST /ideas/:id/remix ─────────────────────────────────────────────────────

#[utoipa::path(
    post, path = "/ideas/{id}/remix", tag = "portfolio",
    params(("id" = Uuid, Path, description = "Original idea ID")),
    request_body = RemixRequest,
    responses(
        (status = 201, description = "Remix submitted (pending moderation)", body = IdeaResponse),
        (status = 403, description = "Non-kid token or consent required", body = crate::ProblemDetail),
        (status = 404, description = "Original idea not found or not approved", body = crate::ProblemDetail),
    )
)]
pub async fn remix_idea(
    KidAuth { child_id, .. }: KidAuth,
    Path(original_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(body): Json<RemixRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let text = body.text.trim().to_owned();
    if text.is_empty() || text.len() > 500 {
        return Err(ApiError::Domain(DomainError::Validation(
            "remix text must be 1–500 characters".into(),
        )));
    }

    let original = state
        .portfolio
        .ideas
        .find_by_id(original_id)
        .await?
        .ok_or(ApiError::Domain(DomainError::NotFound))?;

    // Can only remix approved ideas
    if original.moderation_status != idea_pop_domain::ModerationStatus::Approved {
        return Err(ApiError::Domain(DomainError::NotFound));
    }

    let now = Utc::now();
    let remix = ChallengeIdea::new(
        child_id,
        original.challenge_id,
        text,
        None,
        Some(original_id),
        now,
    );

    state.portfolio.ideas.submit(&remix).await?;

    let mod_item = ModerationItem::new(ModerationContentType::Idea, remix.id, now);
    state.portfolio.moderation.enqueue(&mod_item).await?;

    Ok((
        StatusCode::CREATED,
        Json(IdeaResponse {
            id: remix.id,
            challenge_id: remix.challenge_id,
            text: remix.text,
            photo_key: remix.photo_key,
            remix_of: remix.remix_of,
            moderation_status: remix.moderation_status.as_str().to_owned(),
            created_at: remix.created_at.to_rfc3339(),
            reactions: ReactionCountsDto::default(),
        }),
    ))
}

// ── GET /moderation/queue ─────────────────────────────────────────────────────

#[utoipa::path(
    get, path = "/moderation/queue", tag = "moderation",
    responses(
        (status = 200, description = "Pending moderation items", body = ModerationQueueResponse),
        (status = 403, description = "Reviewer role required", body = crate::ProblemDetail),
    )
)]
pub async fn list_moderation_queue(
    ReviewerAuth(_claims): ReviewerAuth,
    State(state): State<AppState>,
) -> Result<Json<ModerationQueueResponse>, ApiError> {
    let items = state.portfolio.moderation.pending_queue().await?;
    Ok(Json(ModerationQueueResponse {
        items: items.into_iter().map(map_moderation_item).collect(),
    }))
}

// ── POST /moderation/:id/approve ─────────────────────────────────────────────

#[utoipa::path(
    post, path = "/moderation/{id}/approve", tag = "moderation",
    params(("id" = Uuid, Path, description = "Moderation item ID")),
    responses(
        (status = 200, description = "Item approved; effective visibility updated", body = ModerationItemResponse),
        (status = 403, description = "Reviewer role required", body = crate::ProblemDetail),
        (status = 404, description = "Item not found or not pending", body = crate::ProblemDetail),
    )
)]
pub async fn approve_item(
    ReviewerAuth(claims): ReviewerAuth,
    Path(item_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<ModerationItemResponse>, ApiError> {
    let now = Utc::now();
    let reviewer_id = claims.account_id;

    let item = state
        .portfolio
        .moderation
        .approve(item_id, reviewer_id, now)
        .await?
        .ok_or(ApiError::Domain(DomainError::NotFound))?;

    apply_approval_side_effects(&state, &item, now).await?;

    Ok(Json(map_moderation_item(item)))
}

/// Content side-effects of an approval: promote a project's
/// effective_visibility to its requested level, or mark an idea approved.
/// Shared by the reviewer queue and the parent "Needs your OK" queue.
pub(crate) async fn apply_approval_side_effects(
    state: &AppState,
    item: &ModerationItem,
    now: chrono::DateTime<Utc>,
) -> Result<(), ApiError> {
    match item.content_type {
        ModerationContentType::Project => {
            if let Some(project) = state.portfolio.projects.find_by_id(item.content_id).await? {
                let requested = project.requested_visibility.clone();
                state
                    .portfolio
                    .projects
                    .set_visibility(project.id, &requested.clone(), &requested, now)
                    .await?;
            }
        }
        ModerationContentType::Idea => {
            state
                .portfolio
                .ideas
                .update_moderation_status(
                    item.content_id,
                    &idea_pop_domain::ModerationStatus::Approved,
                )
                .await?;
        }
    }
    Ok(())
}

/// Content side-effect of a rejection: mark an idea rejected. Projects need
/// no change — effective_visibility already stays Private.
pub(crate) async fn apply_rejection_side_effects(
    state: &AppState,
    item: &ModerationItem,
) -> Result<(), ApiError> {
    if item.content_type == ModerationContentType::Idea {
        state
            .portfolio
            .ideas
            .update_moderation_status(
                item.content_id,
                &idea_pop_domain::ModerationStatus::Rejected,
            )
            .await?;
    }
    Ok(())
}

// ── POST /moderation/:id/reject ───────────────────────────────────────────────

#[utoipa::path(
    post, path = "/moderation/{id}/reject", tag = "moderation",
    params(("id" = Uuid, Path, description = "Moderation item ID")),
    request_body = RejectRequest,
    responses(
        (status = 200, description = "Item rejected", body = ModerationItemResponse),
        (status = 403, description = "Reviewer role required", body = crate::ProblemDetail),
        (status = 404, description = "Item not found or not pending", body = crate::ProblemDetail),
    )
)]
pub async fn reject_item(
    ReviewerAuth(claims): ReviewerAuth,
    Path(item_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(body): Json<RejectRequest>,
) -> Result<Json<ModerationItemResponse>, ApiError> {
    if body.reason.trim().is_empty() {
        return Err(ApiError::Domain(DomainError::Validation(
            "reason is required for rejection".into(),
        )));
    }

    let now = Utc::now();
    let reviewer_id = claims.account_id;

    let item = state
        .portfolio
        .moderation
        .reject(item_id, reviewer_id, body.reason, now)
        .await?
        .ok_or(ApiError::Domain(DomainError::NotFound))?;

    apply_rejection_side_effects(&state, &item).await?;

    Ok(Json(map_moderation_item(item)))
}

// ── POST /reports ─────────────────────────────────────────────────────────────

#[utoipa::path(
    post, path = "/reports", tag = "moderation",
    request_body = CreateReportRequest,
    responses(
        (status = 201, description = "Report created with 24h due_at", body = ReportResponse),
        (status = 401, description = "Not authenticated", body = crate::ProblemDetail),
    )
)]
pub async fn create_report(
    AuthToken(claims): AuthToken,
    State(state): State<AppState>,
    Json(body): Json<CreateReportRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let reason = body.reason.trim().to_owned();
    if reason.is_empty() {
        return Err(ApiError::Domain(DomainError::Validation(
            "reason is required".into(),
        )));
    }

    let content_type = ModerationContentType::from_db(&body.content_type).ok_or_else(|| {
        ApiError::Domain(DomainError::Validation(
            "content_type must be project or idea".into(),
        ))
    })?;

    let now = Utc::now();
    let report = Report::new(
        claims.account_id,
        content_type,
        body.content_id,
        reason,
        now,
    );

    state.portfolio.reports.create(&report).await?;

    Ok((StatusCode::CREATED, Json(map_report(report))))
}

// ── GET /reports ──────────────────────────────────────────────────────────────

#[utoipa::path(
    get, path = "/reports", tag = "moderation",
    responses(
        (status = 200, description = "Pending reports (reviewer only)", body = ReportListResponse),
        (status = 403, description = "Reviewer role required", body = crate::ProblemDetail),
    )
)]
pub async fn list_reports(
    ReviewerAuth(_claims): ReviewerAuth,
    State(state): State<AppState>,
) -> Result<Json<ReportListResponse>, ApiError> {
    let reports = state.portfolio.reports.list_pending().await?;
    Ok(Json(ReportListResponse {
        items: reports.into_iter().map(map_report).collect(),
    }))
}
