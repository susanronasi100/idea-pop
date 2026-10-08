//! Scoped AI mission helper (AI-helper-spec.md).
//!
//! POST /challenges/{id}/steps/{step}/help — kid-scoped, feature-flagged,
//! consent-gated, rate-limited, moderated on input AND output, and every
//! exchange is appended to `help_messages` for parent/teacher review.
//!
//! Gate order: flag (404, ships dark) → kid token → consent
//! (ParentGranted/ClassGranted) → per-child opt-in toggle → deterministic
//! pre-screen → hourly rate limit → input moderation → model call →
//! output moderation → persist → respond.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use utoipa::ToSchema;
use uuid::Uuid;

use idea_pop_domain::{
    challenge::ChallengeStep,
    help::{
        build_idea_check_prompt, build_system_prompt, parse_idea_feedback, screen_question,
        IdeaCheckContext, CANNED_REFUSAL,
    },
    DomainError, GatedAction, Role,
};

use crate::{
    error::{problem, ApiError},
    extractor::{AdultAuth, KidAuth},
    parent::{assert_own_child, require_parent},
    state::AppState,
};

fn internal(e: sqlx::Error) -> DomainError {
    DomainError::Internal(e.to_string())
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

#[derive(Deserialize, ToSchema)]
pub struct HelpRequest {
    pub question: String,
}

#[derive(Serialize, ToSchema)]
pub struct HelpResponse {
    /// The helper's reply — a gentle canned message when blocked.
    pub answer: String,
    /// True when the exchange was refused by moderation/guards.
    pub blocked: bool,
}

#[derive(Serialize, ToSchema)]
pub struct HelpMessageResponse {
    pub id: Uuid,
    pub child_id: Uuid,
    pub child_nickname: String,
    pub challenge_title: String,
    pub step: i16,
    pub question: String,
    pub answer: Option<String>,
    pub blocked: bool,
    pub created_at: String,
}

#[derive(Deserialize, ToSchema)]
pub struct IdeaFeedbackRequest {
    /// The kid's own words about their idea (what they made and how it works).
    pub idea: String,
    /// "en" or "fa": the language Popi answers in.
    #[serde(default)]
    pub lang: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct IdeaFeedbackResponse {
    /// Popi's two short sentences for the kid.
    pub message: String,
    /// True when the idea is a real attempt at this mission's problem.
    pub fits: bool,
    /// True when safety checks stopped the exchange (the message is a gentle canned one).
    pub blocked: bool,
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateHelperEnabledRequest {
    pub enabled: bool,
}

#[derive(Serialize, ToSchema)]
pub struct HelperEnabledResponse {
    pub child_id: Uuid,
    pub enabled: bool,
}

// ── POST /challenges/{id}/steps/{step}/help ───────────────────────────────────

/// Ask the scoped helper a question about the current mission step.
#[utoipa::path(post, path = "/challenges/{id}/steps/{step}/help", tag = "challenges",
    params(
        ("id" = Uuid, Path, description = "Challenge UUID"),
        ("step" = i16, Path, description = "Step number 1-8"),
    ),
    request_body = HelpRequest,
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Answer (or gentle refusal with blocked=true)", body = HelpResponse),
        (status = 403, description = "Consent or opt-in missing / not a kid token", body = crate::ProblemDetail),
        (status = 404, description = "Feature off, or unknown challenge/step", body = crate::ProblemDetail),
        (status = 429, description = "Hourly helper limit reached", body = crate::ProblemDetail),
    ))]
pub async fn ask_helper(
    kid: KidAuth,
    State(state): State<AppState>,
    Path((challenge_id, step_num)): Path<(Uuid, i16)>,
    Json(body): Json<HelpRequest>,
) -> Result<Response, ApiError> {
    // Feature flag — ships dark: the route pretends not to exist.
    if !state.helper_config.enabled {
        return Err(DomainError::NotFound.into());
    }
    let child_id = kid.child_id;

    // Consent gate: helper exchanges are extra data collection.
    state
        .consent
        .check_gate(child_id, &GatedAction::CollectExtraData)
        .await?;

    // Per-child opt-in (parent toggle) — off by default.
    let enabled: Option<bool> =
        sqlx::query_scalar("SELECT helper_enabled FROM child_profiles WHERE id = $1")
            .bind(child_id)
            .fetch_optional(&state.db)
            .await
            .map_err(internal)?;
    if !enabled.unwrap_or(false) {
        return Err(DomainError::Forbidden(
            "the mission helper is not switched on for this profile".into(),
        )
        .into());
    }

    if !(1..=8).contains(&step_num) {
        return Err(DomainError::NotFound.into());
    }

    // Deterministic pre-screen: refuse before any model call, but still log.
    if screen_question(&body.question).is_some() {
        log_exchange(
            &state,
            child_id,
            challenge_id,
            step_num,
            &body.question,
            None,
            true,
        )
        .await?;
        return Ok(blocked_response());
    }

    // Per-child hourly cap.
    let recent: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM help_messages
         WHERE child_id = $1 AND created_at > now() - interval '1 hour'",
    )
    .bind(child_id)
    .fetch_one(&state.db)
    .await
    .map_err(internal)?;
    if recent >= state.helper_config.hourly_limit {
        return Ok(problem(
            StatusCode::TOO_MANY_REQUESTS,
            "helper-rate-limited",
            "That's a lot of questions! The helper needs a little rest — try again soon.",
        ));
    }

    // The step's own text is the ONLY context the model sees (no PII).
    let steps_val: Option<serde_json::Value> =
        sqlx::query_scalar::<_, serde_json::Value>("SELECT steps FROM challenges WHERE id = $1")
            .bind(challenge_id)
            .fetch_optional(&state.db)
            .await
            .map_err(internal)?;
    let steps: Vec<ChallengeStep> = match steps_val {
        Some(v) => serde_json::from_value(v).map_err(|e| DomainError::Internal(e.to_string()))?,
        None => return Err(DomainError::NotFound.into()),
    };
    let Some(step) = steps.get((step_num - 1) as usize) else {
        return Err(DomainError::NotFound.into());
    };
    let title: String = sqlx::query_scalar("SELECT title FROM challenges WHERE id = $1")
        .bind(challenge_id)
        .fetch_one(&state.db)
        .await
        .map_err(internal)?;

    // Input moderation (LLM layer; fails closed inside the provider).
    if !state.helper.moderate(&body.question).await? {
        log_exchange(
            &state,
            child_id,
            challenge_id,
            step_num,
            &body.question,
            None,
            true,
        )
        .await?;
        return Ok(blocked_response());
    }

    let system_prompt = build_system_prompt(&title, step);
    let answer = state.helper.answer(&system_prompt, &body.question).await?;

    // Output moderation — a blocked answer is stored for review, never shown.
    if !state.helper.moderate(&answer).await? {
        log_exchange(
            &state,
            child_id,
            challenge_id,
            step_num,
            &body.question,
            Some(&answer),
            true,
        )
        .await?;
        return Ok(blocked_response());
    }

    log_exchange(
        &state,
        child_id,
        challenge_id,
        step_num,
        &body.question,
        Some(&answer),
        false,
    )
    .await?;

    Ok(Json(HelpResponse {
        answer,
        blocked: false,
    })
    .into_response())
}

// ── POST /challenges/{id}/idea-feedback ───────────────────────────────────────

/// The Sketch step's step number in the mission's data, for the review transcript.
const SKETCH_STEP: i16 = 6;

/// Popi checks a kid's sketched idea and answers with what's good about it and one
/// question to improve it, or kindly asks them to try again when it doesn't solve the
/// problem. The same gates as the helper: feature flag, consent, the parent's opt-in,
/// pre-screen, hourly limit, input and output moderation, and a reviewable transcript.
/// XP never depends on this: it was already given when the idea was saved.
#[utoipa::path(post, path = "/challenges/{id}/idea-feedback", tag = "challenges",
    params(("id" = Uuid, Path, description = "Challenge UUID")),
    request_body = IdeaFeedbackRequest,
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Popi's feedback (or a gentle refusal with blocked=true)", body = IdeaFeedbackResponse),
        (status = 403, description = "Consent or opt-in missing / not a kid token", body = crate::ProblemDetail),
        (status = 404, description = "Feature off, or unknown challenge", body = crate::ProblemDetail),
        (status = 429, description = "Hourly helper limit reached", body = crate::ProblemDetail),
    ))]
pub async fn idea_feedback(
    kid: KidAuth,
    State(state): State<AppState>,
    Path(challenge_id): Path<Uuid>,
    Json(body): Json<IdeaFeedbackRequest>,
) -> Result<Response, ApiError> {
    if !state.helper_config.enabled {
        return Err(DomainError::NotFound.into());
    }
    let child_id = kid.child_id;
    state
        .consent
        .check_gate(child_id, &GatedAction::CollectExtraData)
        .await?;
    let enabled: Option<bool> =
        sqlx::query_scalar("SELECT helper_enabled FROM child_profiles WHERE id = $1")
            .bind(child_id)
            .fetch_optional(&state.db)
            .await
            .map_err(internal)?;
    if !enabled.unwrap_or(false) {
        return Err(DomainError::Forbidden(
            "the mission helper is not switched on for this profile".into(),
        )
        .into());
    }

    let idea = body.idea.trim().to_owned();
    if screen_question(&idea).is_some() {
        log_exchange(
            &state,
            child_id,
            challenge_id,
            SKETCH_STEP,
            &idea,
            None,
            true,
        )
        .await?;
        return Ok(blocked_idea_response());
    }

    let recent: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM help_messages
         WHERE child_id = $1 AND created_at > now() - interval '1 hour'",
    )
    .bind(child_id)
    .fetch_one(&state.db)
    .await
    .map_err(internal)?;
    if recent >= state.helper_config.hourly_limit {
        return Ok(problem(
            StatusCode::TOO_MANY_REQUESTS,
            "helper-rate-limited",
            "Popi needs a little rest — try again soon.",
        ));
    }

    // The mission's own story text is the only context (no PII).
    let lang = body.lang.as_deref().unwrap_or("en");
    let row = sqlx::query("SELECT title, story, translations FROM challenges WHERE id = $1")
        .bind(challenge_id)
        .fetch_optional(&state.db)
        .await
        .map_err(internal)?
        .ok_or(DomainError::NotFound)?;
    let title: String = row.get("title");
    let story_en: Option<serde_json::Value> = row.get("story");
    let translations: serde_json::Value = row.get("translations");
    let story = (if lang == "fa" {
        translations.get("fa").and_then(|t| t.get("story")).cloned()
    } else {
        None
    })
    .or(story_en)
    .ok_or(DomainError::NotFound)?;
    let text = |v: &serde_json::Value, path: &[&str]| -> String {
        let mut cur = v;
        for p in path {
            match cur.get(p) {
                Some(next) => cur = next,
                None => return String::new(),
            }
        }
        cur.as_str().unwrap_or_default().to_owned()
    };
    let heroes: Vec<String> = story
        .get("clue_cards")
        .and_then(|c| c.as_array())
        .map(|cards| {
            cards
                .iter()
                .filter_map(|c| c.get("name")?.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default();
    let (hero, problem_text, goal, question) = (
        text(&story, &["hero", "name"]),
        text(&story, &["card", "problem"]),
        text(&story, &["card", "goal"]),
        text(&story, &["function_question"]),
    );
    let ctx = IdeaCheckContext {
        challenge_title: &title,
        hero: &hero,
        problem: &problem_text,
        goal: &goal,
        function_question: &question,
        nature_heroes: &heroes,
        lang,
    };

    if !state.helper.moderate(&idea).await? {
        log_exchange(
            &state,
            child_id,
            challenge_id,
            SKETCH_STEP,
            &idea,
            None,
            true,
        )
        .await?;
        return Ok(blocked_idea_response());
    }
    let raw = state
        .helper
        .answer(&build_idea_check_prompt(&ctx), &idea)
        .await?;
    let Some(feedback) = parse_idea_feedback(&raw) else {
        log_exchange(
            &state,
            child_id,
            challenge_id,
            SKETCH_STEP,
            &idea,
            Some(&raw),
            true,
        )
        .await?;
        return Ok(blocked_idea_response());
    };
    if !state.helper.moderate(&feedback.message).await? {
        log_exchange(
            &state,
            child_id,
            challenge_id,
            SKETCH_STEP,
            &idea,
            Some(&raw),
            true,
        )
        .await?;
        return Ok(blocked_idea_response());
    }
    log_exchange(
        &state,
        child_id,
        challenge_id,
        SKETCH_STEP,
        &idea,
        Some(&feedback.message),
        false,
    )
    .await?;

    Ok(Json(IdeaFeedbackResponse {
        message: feedback.message,
        fits: feedback.fits,
        blocked: false,
    })
    .into_response())
}

fn blocked_idea_response() -> Response {
    Json(IdeaFeedbackResponse {
        message: CANNED_REFUSAL.to_owned(),
        fits: false,
        blocked: true,
    })
    .into_response()
}

fn blocked_response() -> Response {
    Json(HelpResponse {
        answer: CANNED_REFUSAL.to_owned(),
        blocked: true,
    })
    .into_response()
}

/// Append one exchange to the append-only transcript.
async fn log_exchange(
    state: &AppState,
    child_id: Uuid,
    challenge_id: Uuid,
    step: i16,
    question: &str,
    answer: Option<&str>,
    blocked: bool,
) -> Result<(), ApiError> {
    sqlx::query(
        "INSERT INTO help_messages (child_id, challenge_id, step, question, answer, blocked)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(child_id)
    .bind(challenge_id)
    .bind(step)
    .bind(question)
    .bind(answer)
    .bind(blocked)
    .execute(&state.db)
    .await
    .map_err(internal)?;
    Ok(())
}

// ── Review feeds (parent + teacher) ───────────────────────────────────────────

/// A child's helper transcript, for the child's own parent.
#[utoipa::path(get, path = "/parent/children/{id}/help-messages", tag = "children",
    params(("id" = Uuid, Path, description = "Child profile UUID")),
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Most recent exchanges first", body = [HelpMessageResponse]),
        (status = 403, description = "Not the parent of this child", body = crate::ProblemDetail),
        (status = 404, description = "Not found", body = crate::ProblemDetail),
    ))]
pub async fn parent_help_messages(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
    Path(child_id): Path<Uuid>,
) -> Result<Json<Vec<HelpMessageResponse>>, ApiError> {
    require_parent(&claims.role)?;
    assert_own_child(&state, claims.account_id, child_id).await?;
    let rows = sqlx::query(
        r#"SELECT h.id, h.child_id, c.nickname, ch.title, h.step, h.question, h.answer,
                  h.blocked, h.created_at
           FROM help_messages h
           JOIN child_profiles c ON c.id = h.child_id
           JOIN challenges ch ON ch.id = h.challenge_id
           WHERE h.child_id = $1
           ORDER BY h.created_at DESC
           LIMIT 100"#,
    )
    .bind(child_id)
    .fetch_all(&state.db)
    .await
    .map_err(internal)?;
    Ok(Json(rows.iter().map(map_message).collect()))
}

/// Helper transcripts for every child in the caller's classes (teacher review).
#[utoipa::path(get, path = "/teacher/help-messages", tag = "classes",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Most recent exchanges first", body = [HelpMessageResponse]),
        (status = 403, description = "Teacher role required", body = crate::ProblemDetail),
    ))]
pub async fn teacher_help_messages(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
) -> Result<Json<Vec<HelpMessageResponse>>, ApiError> {
    if !matches!(claims.role, Role::Teacher | Role::Admin) {
        return Err(DomainError::Forbidden("teacher role required".into()).into());
    }
    let rows = sqlx::query(
        r#"SELECT h.id, h.child_id, c.nickname, ch.title, h.step, h.question, h.answer,
                  h.blocked, h.created_at
           FROM help_messages h
           JOIN child_profiles c ON c.id = h.child_id
           JOIN challenges ch ON ch.id = h.challenge_id
           JOIN class_memberships cm ON cm.child_id = h.child_id
           JOIN classes cl ON cl.id = cm.class_id
           WHERE cl.teacher_account_id = $1
           ORDER BY h.created_at DESC
           LIMIT 100"#,
    )
    .bind(claims.account_id)
    .fetch_all(&state.db)
    .await
    .map_err(internal)?;
    Ok(Json(rows.iter().map(map_message).collect()))
}

fn map_message(r: &sqlx::postgres::PgRow) -> HelpMessageResponse {
    let created: chrono::DateTime<chrono::Utc> = r
        .try_get("created_at")
        .unwrap_or_else(|_| chrono::Utc::now());
    HelpMessageResponse {
        id: r.try_get("id").unwrap_or_default(),
        child_id: r.try_get("child_id").unwrap_or_default(),
        child_nickname: r.try_get("nickname").unwrap_or_default(),
        challenge_title: r.try_get("title").unwrap_or_default(),
        step: r.try_get("step").unwrap_or(0),
        question: r.try_get("question").unwrap_or_default(),
        answer: r.try_get("answer").ok(),
        blocked: r.try_get("blocked").unwrap_or(false),
        created_at: created.to_rfc3339(),
    }
}

// ── PUT /parent/children/{id}/helper — the parent opt-in toggle ───────────────

/// Switch the mission helper on/off for one of the caller's children.
#[utoipa::path(put, path = "/parent/children/{id}/helper", tag = "children",
    params(("id" = Uuid, Path, description = "Child profile UUID")),
    request_body = UpdateHelperEnabledRequest,
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Toggle updated", body = HelperEnabledResponse),
        (status = 403, description = "Not the parent of this child", body = crate::ProblemDetail),
        (status = 404, description = "Not found", body = crate::ProblemDetail),
    ))]
pub async fn set_helper_enabled(
    AdultAuth(claims): AdultAuth,
    State(state): State<AppState>,
    Path(child_id): Path<Uuid>,
    Json(body): Json<UpdateHelperEnabledRequest>,
) -> Result<Json<HelperEnabledResponse>, ApiError> {
    require_parent(&claims.role)?;
    assert_own_child(&state, claims.account_id, child_id).await?;
    sqlx::query("UPDATE child_profiles SET helper_enabled = $1 WHERE id = $2")
        .bind(body.enabled)
        .bind(child_id)
        .execute(&state.db)
        .await
        .map_err(internal)?;
    Ok(Json(HelperEnabledResponse {
        child_id,
        enabled: body.enabled,
    }))
}

// ── Retention purge ───────────────────────────────────────────────────────────

/// Delete `help_messages` rows older than `retention_days`. Returns the number
/// of rows purged. Called by the server's daily retention task when
/// HELP_MESSAGE_RETENTION_DAYS is set; with the var unset nothing is ever
/// purged (backward-safe default). Also runnable as plain SQL from cron —
/// see docs/runbook.md.
pub async fn purge_expired_help_messages(
    pool: &sqlx::PgPool,
    retention_days: i64,
) -> Result<u64, DomainError> {
    if retention_days <= 0 {
        return Ok(0);
    }
    let result = sqlx::query(
        "DELETE FROM help_messages
         WHERE created_at < now() - make_interval(days => $1::int)",
    )
    .bind(retention_days)
    .execute(pool)
    .await
    .map_err(internal)?;
    Ok(result.rows_affected())
}
