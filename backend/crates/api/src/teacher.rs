//! Teacher class dashboard reads + mission assignment.
//!
//! GET  /teacher/class          — the caller's class (code, size, assignment)
//! GET  /teacher/class/gallery  — class-visible student projects
//! POST /teacher/class/assign   — set the class's current mission
//!
//! Teacher/Admin only. Runtime `sqlx::query` — no offline-cache entries.
//! The class store is the same `classes` table `POST /classes` writes, so a
//! newly created class is immediately readable here.

use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use idea_pop_domain::{DomainError, Role};

use crate::{error::ApiError, extractor::AdultAuth, state::AppState};

/// A random 4-digit login PIN — child-friendly, shown to the grown-up once, and
/// only ever stored hashed. PIN login is rate-limited + lockable. Shared with
/// the parent's own reset, so a child's PIN is made the same way wherever it
/// comes from.
pub(crate) fn generate_pin() -> String {
    let n = (Uuid::new_v4().as_u128() % 10_000) as u16;
    format!("{n:04}")
}

fn internal(e: sqlx::Error) -> DomainError {
    DomainError::Internal(e.to_string())
}

fn require_teacher(role: &Role) -> Result<(), ApiError> {
    if matches!(role, Role::Teacher | Role::Admin) {
        Ok(())
    } else {
        Err(DomainError::Forbidden("Teacher or Admin role required".into()).into())
    }
}

// ── DTOs (match the frontend TeacherClass / ClassGalleryItem contract) ─────────

#[derive(Serialize, ToSchema)]
pub struct TeacherClassResponse {
    pub id: Uuid,
    pub name: String,
    pub class_code: String,
    pub student_count: i64,
    pub assigned_challenge_id: Option<Uuid>,
    pub assigned_challenge_title: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct ClassGalleryItemResponse {
    pub id: Uuid,
    pub student_nickname: String,
    pub student_avatar_id: String,
    pub project_title: String,
    /// Photos are private S3 keys; presigned URLs are out of scope here
    /// (same deferral as the parent report).
    pub project_photo_url: Option<String>,
    pub challenge_title: String,
    pub created_at: String,
}

#[derive(Deserialize, ToSchema)]
pub struct AssignMissionRequest {
    pub challenge_id: Uuid,
}

// ── GET /teacher/class ──────────────────────────────────────────────────────────

/// The authenticated teacher's class. 404 while no class exists yet.
#[utoipa::path(get, path = "/teacher/class", tag = "classes",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "The caller's class", body = TeacherClassResponse),
        (status = 403, description = "Teacher role required", body = crate::ProblemDetail),
        (status = 404, description = "No class created yet", body = crate::ProblemDetail),
    ))]
pub async fn get_class(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
) -> Result<Json<TeacherClassResponse>, ApiError> {
    require_teacher(&claims.role)?;

    let row = sqlx::query(
        r#"SELECT c.id, c.name, c.class_code, c.assigned_challenge_id,
                  ch.title AS assigned_challenge_title,
                  (SELECT COUNT(*) FROM class_memberships m WHERE m.class_id = c.id) AS student_count
           FROM classes c
           LEFT JOIN challenges ch ON ch.id = c.assigned_challenge_id
           WHERE c.teacher_account_id = $1
           ORDER BY c.created_at DESC
           LIMIT 1"#,
    )
    .bind(claims.account_id)
    .fetch_optional(&state.db)
    .await
    .map_err(internal)?
    .ok_or(ApiError::Domain(DomainError::NotFound))?;

    Ok(Json(TeacherClassResponse {
        id: row.try_get("id").unwrap_or_default(),
        name: row.try_get("name").unwrap_or_default(),
        class_code: row.try_get("class_code").unwrap_or_default(),
        student_count: row.try_get("student_count").unwrap_or(0),
        assigned_challenge_id: row.try_get("assigned_challenge_id").ok().flatten(),
        assigned_challenge_title: row.try_get("assigned_challenge_title").ok().flatten(),
    }))
}

// ── POST /teacher/class/assign ──────────────────────────────────────────────────

/// Assign a mission to the caller's class.
#[utoipa::path(post, path = "/teacher/class/assign", tag = "classes",
    request_body = AssignMissionRequest,
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Mission assigned", body = TeacherClassResponse),
        (status = 403, description = "Teacher role required", body = crate::ProblemDetail),
        (status = 404, description = "No class yet, or unknown challenge", body = crate::ProblemDetail),
    ))]
pub async fn assign_mission(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
    Json(body): Json<AssignMissionRequest>,
) -> Result<Json<TeacherClassResponse>, ApiError> {
    require_teacher(&claims.role)?;

    let updated = sqlx::query(
        r#"UPDATE classes SET assigned_challenge_id = $1
           WHERE teacher_account_id = $2
             AND EXISTS (SELECT 1 FROM challenges WHERE id = $1)"#,
    )
    .bind(body.challenge_id)
    .bind(claims.account_id)
    .execute(&state.db)
    .await
    .map_err(internal)?;
    if updated.rows_affected() == 0 {
        return Err(DomainError::NotFound.into());
    }

    get_class(AdultAuth(claims), State(state)).await
}

// ── GET /teacher/class/gallery ──────────────────────────────────────────────────

/// Class-visible student projects for the caller's class, newest first.
#[utoipa::path(get, path = "/teacher/class/gallery", tag = "classes",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Class gallery", body = [ClassGalleryItemResponse]),
        (status = 403, description = "Teacher role required", body = crate::ProblemDetail),
    ))]
pub async fn class_gallery(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
) -> Result<Json<Vec<ClassGalleryItemResponse>>, ApiError> {
    require_teacher(&claims.role)?;

    let rows = sqlx::query(
        r#"SELECT p.id, p.title, p.created_at, c.nickname, c.avatar_id,
                  ch.title AS challenge_title
           FROM projects p
           JOIN child_profiles c ON c.id = p.child_id
           JOIN class_memberships m ON m.child_id = p.child_id
           JOIN classes cl ON cl.id = m.class_id
           LEFT JOIN challenges ch
                  ON p.origin_type = 'challenge' AND ch.id = p.origin_id
           WHERE cl.teacher_account_id = $1
             AND p.effective_visibility IN ('class', 'public')
           ORDER BY p.created_at DESC
           LIMIT 100"#,
    )
    .bind(claims.account_id)
    .fetch_all(&state.db)
    .await
    .map_err(internal)?;

    let items = rows
        .iter()
        .map(|r| {
            let avatar_id: String = r.try_get("avatar_id").unwrap_or_default();
            let created: chrono::DateTime<chrono::Utc> = r
                .try_get("created_at")
                .unwrap_or_else(|_| chrono::Utc::now());
            ClassGalleryItemResponse {
                id: r.try_get("id").unwrap_or_default(),
                student_nickname: r.try_get("nickname").unwrap_or_default(),
                student_avatar_id: avatar_id,
                project_title: r.try_get("title").unwrap_or_default(),
                project_photo_url: None,
                challenge_title: r
                    .try_get::<Option<String>, _>("challenge_title")
                    .ok()
                    .flatten()
                    .unwrap_or_default(),
                created_at: created.to_rfc3339(),
            }
        })
        .collect();

    Ok(Json(items))
}

// ── Teacher-managed class students (PIN login) ────────────────────────────────
//
// A teacher can roster kids directly instead of waiting for each to self-sign-up.
// These kids have no email/password: they sign in with the class code + their
// name + a 4-digit PIN (see classes::class_login). Data stays minimal (nickname,
// avatar, birth year); the teacher's account is the responsible adult and consent
// is recorded as class_granted (class sharing only — never public).

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateStudentRequest {
    #[validate(length(min = 1, max = 30, message = "nickname must be 1–30 characters"))]
    pub nickname: String,
    #[validate(length(min = 1, max = 32, message = "avatar_id must be 1–32 characters"))]
    pub avatar_id: String,
    #[validate(range(min = 1980, max = 2020, message = "birth_year must be 1980–2020"))]
    pub birth_year: u16,
}

#[derive(Serialize, ToSchema)]
pub struct CreateStudentResponse {
    pub child_id: Uuid,
    pub nickname: String,
    /// The plaintext PIN — returned ONCE, at creation. Give it to the child;
    /// it is stored only as a hash and cannot be retrieved again (reset instead).
    pub login_pin: String,
}

#[derive(Serialize, ToSchema)]
pub struct StudentRosterItem {
    pub child_id: Uuid,
    pub nickname: String,
    pub avatar_id: String,
    /// True for teacher-created kids who sign in with a PIN.
    pub has_login_pin: bool,
}

#[derive(Serialize, ToSchema)]
pub struct ResetPinResponse {
    pub child_id: Uuid,
    pub login_pin: String,
}

/// The caller's class id, or a 422 telling them to create a class first.
async fn own_class_id(state: &AppState, teacher_account_id: Uuid) -> Result<Uuid, ApiError> {
    sqlx::query_scalar("SELECT id FROM classes WHERE teacher_account_id = $1")
        .bind(teacher_account_id)
        .fetch_optional(&state.db)
        .await
        .map_err(internal)?
        .ok_or_else(|| {
            DomainError::Validation("create a class before adding students".into()).into()
        })
}

// ── POST /teacher/class/students ──────────────────────────────────────────────

/// Create a student in the teacher's class and return a one-time login PIN.
#[utoipa::path(post, path = "/teacher/class/students", tag = "classes",
    request_body = CreateStudentRequest,
    security(("bearer_auth" = [])),
    responses(
        (status = 201, description = "Student created; PIN shown once", body = CreateStudentResponse),
        (status = 403, description = "Teacher/Admin role required", body = crate::ProblemDetail),
        (status = 422, description = "No class yet, or invalid input", body = crate::ProblemDetail),
    ))]
pub async fn create_student(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
    Json(body): Json<CreateStudentRequest>,
) -> Result<(StatusCode, Json<CreateStudentResponse>), ApiError> {
    require_teacher(&claims.role)?;
    body.validate()
        .map_err(|e| DomainError::Validation(e.to_string()))?;

    let class_id = own_class_id(&state, claims.account_id).await?;

    let pin = generate_pin();
    let pin_hash = state.auth.hasher.hash(&pin).await?;
    let child_id = Uuid::new_v4();
    // A unique (unused) token hash keeps the NOT NULL / UNIQUE consent column happy.
    let consent_hash = state
        .tokens
        .hash_token(&state.tokens.generate_opaque_token());

    // Teacher is the responsible adult (parent_account_id). Consent is recorded
    // as class_granted (school-consent model): class sharing only, never public.
    sqlx::query(
        "INSERT INTO child_profiles
           (id, parent_account_id, nickname, avatar_id, birth_year, login_pin_hash)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(child_id)
    .bind(claims.account_id)
    .bind(&body.nickname)
    .bind(&body.avatar_id)
    .bind(body.birth_year as i16)
    .bind(&pin_hash)
    .execute(&state.db)
    .await
    .map_err(internal)?;

    sqlx::query(
        "INSERT INTO parental_consents (child_id, token_hash, status, granted_at, expires_at)
         VALUES ($1, $2, 'class_granted', now(), now() + interval '3650 days')",
    )
    .bind(child_id)
    .bind(&consent_hash)
    .execute(&state.db)
    .await
    .map_err(internal)?;

    sqlx::query("INSERT INTO class_memberships (class_id, child_id) VALUES ($1, $2)")
        .bind(class_id)
        .bind(child_id)
        .execute(&state.db)
        .await
        .map_err(internal)?;

    Ok((
        StatusCode::CREATED,
        Json(CreateStudentResponse {
            child_id,
            nickname: body.nickname,
            login_pin: pin,
        }),
    ))
}

// ── GET /teacher/class/students ───────────────────────────────────────────────

/// The roster of the teacher's class (nickname + avatar only — no PII).
#[utoipa::path(get, path = "/teacher/class/students", tag = "classes",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Class roster", body = [StudentRosterItem]),
        (status = 403, description = "Teacher/Admin role required", body = crate::ProblemDetail),
    ))]
pub async fn list_students(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
) -> Result<Json<Vec<StudentRosterItem>>, ApiError> {
    require_teacher(&claims.role)?;
    let rows = sqlx::query(
        "SELECT p.id, p.nickname, p.avatar_id, (p.login_pin_hash IS NOT NULL) AS has_pin
         FROM child_profiles p
         JOIN class_memberships m ON m.child_id = p.id
         JOIN classes c ON c.id = m.class_id
         WHERE c.teacher_account_id = $1
         ORDER BY p.nickname",
    )
    .bind(claims.account_id)
    .fetch_all(&state.db)
    .await
    .map_err(internal)?;
    Ok(Json(
        rows.iter()
            .map(|r| StudentRosterItem {
                child_id: r.try_get("id").unwrap_or_default(),
                nickname: r.try_get("nickname").unwrap_or_default(),
                avatar_id: r.try_get("avatar_id").unwrap_or_default(),
                has_login_pin: r.try_get("has_pin").unwrap_or(false),
            })
            .collect(),
    ))
}

// ── POST /teacher/class/students/{id}/reset-pin ───────────────────────────────

/// Regenerate a student's login PIN (returned once). Clears any lockout.
#[utoipa::path(post, path = "/teacher/class/students/{id}/reset-pin", tag = "classes",
    params(("id" = Uuid, Path, description = "Child profile UUID")),
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "New PIN (shown once)", body = ResetPinResponse),
        (status = 403, description = "Teacher/Admin role required", body = crate::ProblemDetail),
        (status = 404, description = "Not a student in your class", body = crate::ProblemDetail),
    ))]
pub async fn reset_student_pin(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
    Path(child_id): Path<Uuid>,
) -> Result<Json<ResetPinResponse>, ApiError> {
    require_teacher(&claims.role)?;
    let in_class: Option<Uuid> = sqlx::query_scalar(
        "SELECT p.id FROM child_profiles p
         JOIN class_memberships m ON m.child_id = p.id
         JOIN classes c ON c.id = m.class_id
         WHERE c.teacher_account_id = $1 AND p.id = $2",
    )
    .bind(claims.account_id)
    .bind(child_id)
    .fetch_optional(&state.db)
    .await
    .map_err(internal)?;
    if in_class.is_none() {
        return Err(DomainError::NotFound.into());
    }

    let pin = generate_pin();
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

    Ok(Json(ResetPinResponse {
        child_id,
        login_pin: pin,
    }))
}

// ── Class progress report ─────────────────────────────────────────────────────
//
// GET /teacher/class/report      — per-student progress for the caller's class.
// GET /teacher/class/report.csv  — the same, as a school-facing CSV download.
// Scoped to the teacher's own class (teacher_account_id + class_memberships).

#[derive(Deserialize, ToSchema)]
pub struct ClassReportQuery {
    /// Which mission to report on; defaults to the class's assigned challenge.
    pub challenge_id: Option<Uuid>,
}

#[derive(Serialize, ToSchema)]
pub struct ClassReportStudent {
    pub child_id: Uuid,
    pub nickname: String,
    pub avatar_id: String,
    /// Progress on the selected mission: not_started | in_progress | completed.
    pub status: String,
    /// 0 when the child has not started this mission.
    pub current_step: i16,
    /// XP earned on THIS mission.
    pub xp: i64,
    pub last_active: Option<String>,
    /// True if the child shared a project or idea for THIS mission.
    pub shared: bool,
}

#[derive(Serialize, ToSchema)]
pub struct ClassReportSummary {
    pub challenge_id: Uuid,
    pub challenge_title: String,
    pub student_count: i64,
    pub completed: i64,
    pub in_progress: i64,
    pub not_started: i64,
    /// Average step reached across the class (not-started counts as 0).
    pub average_step_reached: f64,
}

#[derive(Serialize, ToSchema)]
pub struct ClassReportResponse {
    pub summary: ClassReportSummary,
    pub students: Vec<ClassReportStudent>,
}

/// Per-student progress on ONE mission for the teacher's own class. The mission
/// is `challenge_id`, defaulting to the class's assigned challenge. 404 if the
/// caller has no class, or no mission can be resolved / doesn't exist.
async fn build_class_report(
    state: &AppState,
    teacher_account_id: Uuid,
    challenge_id: Option<Uuid>,
) -> Result<ClassReportResponse, ApiError> {
    let class = sqlx::query(
        r#"SELECT c.id, c.assigned_challenge_id
           FROM classes c
           WHERE c.teacher_account_id = $1
           ORDER BY c.created_at DESC
           LIMIT 1"#,
    )
    .bind(teacher_account_id)
    .fetch_optional(&state.db)
    .await
    .map_err(internal)?
    .ok_or(ApiError::Domain(DomainError::NotFound))?;

    let class_id: Uuid = class.try_get("id").map_err(internal)?;
    let assigned_id: Option<Uuid> = class.try_get("assigned_challenge_id").ok().flatten();

    // The mission to report on: the query param, else the class's assignment.
    let target: Uuid = challenge_id
        .or(assigned_id)
        .ok_or(ApiError::Domain(DomainError::NotFound))?;
    let challenge_title: String = sqlx::query_scalar("SELECT title FROM challenges WHERE id = $1")
        .bind(target)
        .fetch_optional(&state.db)
        .await
        .map_err(internal)?
        .ok_or(ApiError::Domain(DomainError::NotFound))?;

    let student_rows = sqlx::query(
        r#"SELECT p.id, p.nickname, p.avatar_id
           FROM child_profiles p
           JOIN class_memberships m ON m.child_id = p.id
           WHERE m.class_id = $1
           ORDER BY lower(p.nickname)"#,
    )
    .bind(class_id)
    .fetch_all(&state.db)
    .await
    .map_err(internal)?;

    let ids: Vec<Uuid> = student_rows
        .iter()
        .map(|r| r.try_get("id").unwrap_or_default())
        .collect();

    use std::collections::{HashMap, HashSet};

    // Attempt (status + step) for THIS mission, per child. Historical data may
    // hold duplicate attempts per (child, challenge) — pick the BEST one
    // deterministically: completed first, then furthest step, then newest.
    let attempt_rows = sqlx::query(
        r#"SELECT DISTINCT ON (child_id) child_id, status, current_step
           FROM challenge_attempts
           WHERE child_id = ANY($1) AND challenge_id = $2
           ORDER BY child_id, (status = 'completed') DESC, current_step DESC, started_at DESC"#,
    )
    .bind(&ids)
    .bind(target)
    .fetch_all(&state.db)
    .await
    .map_err(internal)?;
    let mut attempt: HashMap<Uuid, (String, i16)> = HashMap::new();
    for r in &attempt_rows {
        attempt.insert(
            r.try_get("child_id").unwrap_or_default(),
            (
                r.try_get("status").unwrap_or_default(),
                r.try_get("current_step").unwrap_or(0),
            ),
        );
    }

    // XP earned on THIS mission (solve events carry source_id = challenge_id).
    let xp_rows = sqlx::query(
        "SELECT child_id, COALESCE(SUM(amount), 0) AS xp
         FROM xp_events WHERE child_id = ANY($1) AND source_id = $2 GROUP BY child_id",
    )
    .bind(&ids)
    .bind(target)
    .fetch_all(&state.db)
    .await
    .map_err(internal)?;
    let mut xp: HashMap<Uuid, i64> = HashMap::new();
    for r in &xp_rows {
        xp.insert(
            r.try_get("child_id").unwrap_or_default(),
            r.try_get::<i64, _>("xp").unwrap_or(0),
        );
    }

    // Shared a project (class/public) OR an idea for THIS mission.
    let shared_rows = sqlx::query(
        r#"SELECT child_id FROM projects
             WHERE child_id = ANY($1) AND origin_type = 'challenge' AND origin_id = $2
               AND effective_visibility IN ('class', 'public')
           UNION
           SELECT child_id FROM challenge_ideas
             WHERE child_id = ANY($1) AND challenge_id = $2"#,
    )
    .bind(&ids)
    .bind(target)
    .fetch_all(&state.db)
    .await
    .map_err(internal)?;
    let shared: HashSet<Uuid> = shared_rows
        .iter()
        .map(|r| r.try_get("child_id").unwrap_or_default())
        .collect();

    // Last activity on THIS mission (attempt / its XP / its shared project).
    let active_rows = sqlx::query(
        r#"SELECT child_id, MAX(ts) AS last_active FROM (
             SELECT child_id, GREATEST(started_at, COALESCE(completed_at, started_at)) AS ts
               FROM challenge_attempts WHERE child_id = ANY($1) AND challenge_id = $2
             UNION ALL SELECT child_id, created_at FROM xp_events
               WHERE child_id = ANY($1) AND source_id = $2
             UNION ALL SELECT child_id, created_at FROM projects
               WHERE child_id = ANY($1) AND origin_type = 'challenge' AND origin_id = $2
           ) t GROUP BY child_id"#,
    )
    .bind(&ids)
    .bind(target)
    .fetch_all(&state.db)
    .await
    .map_err(internal)?;
    let mut active: HashMap<Uuid, String> = HashMap::new();
    for r in &active_rows {
        if let Ok(ts) = r.try_get::<chrono::DateTime<chrono::Utc>, _>("last_active") {
            active.insert(r.try_get("child_id").unwrap_or_default(), ts.to_rfc3339());
        }
    }

    let students: Vec<ClassReportStudent> = student_rows
        .iter()
        .map(|r| {
            let child_id: Uuid = r.try_get("id").unwrap_or_default();
            let (status, step) = attempt
                .get(&child_id)
                .cloned()
                .unwrap_or_else(|| ("not_started".to_owned(), 0));
            ClassReportStudent {
                child_id,
                nickname: r.try_get("nickname").unwrap_or_default(),
                avatar_id: r.try_get("avatar_id").unwrap_or_default(),
                status,
                current_step: step,
                xp: xp.get(&child_id).copied().unwrap_or(0),
                last_active: active.get(&child_id).cloned(),
                shared: shared.contains(&child_id),
            }
        })
        .collect();

    let completed = students.iter().filter(|s| s.status == "completed").count() as i64;
    let in_progress = students
        .iter()
        .filter(|s| s.status == "in_progress")
        .count() as i64;
    let not_started = students.len() as i64 - completed - in_progress;
    let average_step_reached = if students.is_empty() {
        0.0
    } else {
        let sum: i64 = students.iter().map(|s| s.current_step as i64).sum();
        (sum as f64 / students.len() as f64 * 10.0).round() / 10.0
    };

    Ok(ClassReportResponse {
        summary: ClassReportSummary {
            challenge_id: target,
            challenge_title,
            student_count: students.len() as i64,
            completed,
            in_progress,
            not_started,
            average_step_reached,
        },
        students,
    })
}

/// The teacher's per-student progress report for one mission.
#[utoipa::path(get, path = "/teacher/class/report", tag = "classes",
    params(("challenge_id" = Option<Uuid>, Query, description = "Mission to report on (default: assigned)")),
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Per-student mission report", body = ClassReportResponse),
        (status = 403, description = "Teacher/Admin role required", body = crate::ProblemDetail),
        (status = 404, description = "No class, or no mission to report on", body = crate::ProblemDetail),
    ))]
pub async fn class_report(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
    Query(q): Query<ClassReportQuery>,
) -> Result<Json<ClassReportResponse>, ApiError> {
    require_teacher(&claims.role)?;
    Ok(Json(
        build_class_report(&state, claims.account_id, q.challenge_id).await?,
    ))
}

/// Escape one CSV field (RFC 4180: wrap in quotes, double any inner quotes).
fn csv_field(s: &str) -> String {
    format!("\"{}\"", s.replace('"', "\"\""))
}

/// ASCII slug for a filename (spreadsheets choke on non-ASCII header values).
fn filename_slug(title: &str) -> String {
    let s: String = title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let s = s.trim_matches('-').to_owned();
    // Collapse runs of '-' and cap length.
    let mut out = String::new();
    let mut prev_dash = false;
    for c in s.chars() {
        if c == '-' {
            if !prev_dash {
                out.push(c);
            }
            prev_dash = true;
        } else {
            out.push(c);
            prev_dash = false;
        }
    }
    let out = out.trim_matches('-').chars().take(60).collect::<String>();
    if out.is_empty() {
        "mission".to_owned()
    } else {
        out
    }
}

/// School-facing CSV — one row per student for the selected mission.
#[utoipa::path(get, path = "/teacher/class/report.csv", tag = "classes",
    params(("challenge_id" = Option<Uuid>, Query, description = "Mission to export (default: assigned)")),
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "CSV download"),
        (status = 403, description = "Teacher/Admin role required", body = crate::ProblemDetail),
        (status = 404, description = "No class, or no mission to report on", body = crate::ProblemDetail),
    ))]
pub async fn class_report_csv(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
    Query(q): Query<ClassReportQuery>,
) -> Result<Response, ApiError> {
    require_teacher(&claims.role)?;
    let report = build_class_report(&state, claims.account_id, q.challenge_id).await?;

    // UTF-8 BOM so spreadsheets (incl. Persian text) open it correctly.
    let mut csv = String::from("\u{FEFF}");
    csv.push_str("Nickname,Status,Step,XP,Last active,Shared\r\n");
    for s in &report.students {
        let row = [
            csv_field(&s.nickname),
            csv_field(&s.status),
            csv_field(&format!("{}/8", s.current_step)),
            s.xp.to_string(),
            csv_field(s.last_active.as_deref().unwrap_or("")),
            csv_field(if s.shared { "yes" } else { "no" }),
        ]
        .join(",");
        csv.push_str(&row);
        csv.push_str("\r\n");
    }

    let filename = format!(
        "class-report-{}.csv",
        filename_slug(&report.summary.challenge_title)
    );
    let disposition = format!("attachment; filename=\"{filename}\"");
    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "text/csv; charset=utf-8".to_owned()),
            (header::CONTENT_DISPOSITION, disposition),
        ],
        csv,
    )
        .into_response())
}
