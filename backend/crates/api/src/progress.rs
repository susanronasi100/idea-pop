//! Progress & gamification handlers — all kid-owned.
//!
//! Security invariants enforced here:
//! - `KidAuth` extractor rejects non-kid tokens (adult/admin get 403).
//! - `child_id` is derived from the verified JWT, never from the request body.
//! - Ownership check: PATCH /attempts/:id verifies the attempt belongs to the
//!   requesting child before mutating.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{Datelike, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use idea_pop_domain::{
    progress::{
        award_cycle_bonus, award_define_bonus, award_sketch_bonus, evaluate_new_badges,
        level_from_xp, medal_from_count, rank_from_level, xp_total, AnalyticsEvent,
        AnalyticsEventKind, AttemptStatus, ChallengeAttempt, CycleActivityResult, XpEvent,
        XpSourceType,
    },
    DomainError,
};

use crate::{error::ApiError, extractor::KidAuth, state::AppState};

// ── DTOs ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, ToSchema)]
pub struct VideoViewRequest {
    pub video_id: Uuid,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct LessonCompleteRequest {
    pub lesson_id: Uuid,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct XpAwardResponse {
    pub xp_earned: i16,
    pub xp_total: i32,
    pub level: u32,
    pub rank: String,
    pub is_new: bool,
    pub cycle_bonus_earned: bool,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct StartAttemptResponse {
    pub attempt_id: Uuid,
    pub challenge_id: Uuid,
    pub current_step: i16,
    pub status: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdvanceStepRequest {
    /// Step being completed (1-8). Completing step 8 marks the challenge done.
    pub step: i16,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AdvanceStepResponse {
    pub attempt_id: Uuid,
    pub current_step: i16,
    pub status: String,
    pub xp_earned: i16,
    pub cycle_bonus_earned: bool,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct BadgeResponse {
    pub badge_id: Uuid,
    pub slug: String,
    pub name: String,
    pub icon_url: String,
    pub awarded_at: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MedalsResponse {
    pub explore: Option<String>,
    pub learn: Option<String>,
    pub solve: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ProgressResponse {
    pub xp_total: i32,
    pub level: u32,
    pub rank: String,
    pub explore_count: u32,
    pub learn_count: u32,
    pub solve_count: u32,
    pub medals: MedalsResponse,
    pub creative_cycles_completed: u32,
    pub badges: Vec<BadgeResponse>,
}

fn medal_str(m: &Option<idea_pop_domain::Medal>) -> Option<String> {
    m.as_ref().map(|v| v.as_str().to_owned())
}

trait MedalStr {
    fn as_str(&self) -> &'static str;
}

impl MedalStr for idea_pop_domain::Medal {
    fn as_str(&self) -> &'static str {
        match self {
            idea_pop_domain::Medal::Bronze => "bronze",
            idea_pop_domain::Medal::Silver => "silver",
            idea_pop_domain::Medal::Gold => "gold",
        }
    }
}

// ── Shared helper: recompute and cache progress, then return snapshot ─────────

async fn refresh_progress(state: &AppState, child_id: Uuid) -> Result<ProgressResponse, ApiError> {
    let g = &state.gamification;

    let events = g.xp.list_events(child_id).await?;
    let total = xp_total(&events);
    let level = level_from_xp(total);
    let rank = rank_from_level(level);
    g.xp.upsert_progress(child_id, total, level, rank.as_str())
        .await?;

    let explore_count = g.progress.count_video_views(child_id).await?;
    let learn_count = g.progress.count_lesson_completions(child_id).await?;
    let solve_count = g.progress.count_completed_challenges(child_id).await?;
    let cycle_count = g.progress.count_completed_cycles(child_id).await?;

    // Badge evaluation
    let all_badges = g.badges.all_definitions().await?;
    let earned = g.badges.child_badges(child_id).await?;
    let earned_ids: Vec<Uuid> = earned.iter().map(|b| b.badge_id).collect();
    let now = Utc::now();
    for badge in evaluate_new_badges(
        &all_badges,
        &earned_ids,
        explore_count,
        learn_count,
        solve_count,
        cycle_count,
    ) {
        g.badges.award_badge(child_id, badge.id, now).await?;
    }
    let badges = g.badges.child_badges(child_id).await?;

    Ok(ProgressResponse {
        xp_total: total,
        level,
        rank: rank.as_str().to_owned(),
        explore_count,
        learn_count,
        solve_count,
        medals: MedalsResponse {
            explore: medal_str(&medal_from_count(explore_count)),
            learn: medal_str(&medal_from_count(learn_count)),
            solve: medal_str(&medal_from_count(solve_count)),
        },
        creative_cycles_completed: cycle_count,
        badges: badges
            .into_iter()
            .map(|b| BadgeResponse {
                badge_id: b.badge_id,
                slug: b.badge_slug,
                name: b.badge_name,
                icon_url: b.icon_url,
                awarded_at: b.awarded_at.to_rfc3339(),
            })
            .collect(),
    })
}

// ── POST /progress/video-view ─────────────────────────────────────────────────

#[utoipa::path(
    post, path = "/progress/video-view", tag = "progress",
    request_body = VideoViewRequest,
    responses(
        (status = 200, description = "XP awarded (or 0 if already viewed)", body = XpAwardResponse),
        (status = 403, description = "Non-kid token rejected", body = crate::ProblemDetail),
    )
)]
pub async fn post_video_view(
    KidAuth { child_id, .. }: KidAuth,
    State(state): State<AppState>,
    Json(body): Json<VideoViewRequest>,
) -> Result<Json<XpAwardResponse>, ApiError> {
    let g = &state.gamification;
    let now = Utc::now();

    let is_new = g
        .progress
        .record_video_view(child_id, body.video_id, now)
        .await?;
    let mut xp_earned: i16 = 0;
    let mut cycle_bonus_earned = false;

    if is_new {
        let event = XpEvent {
            id: Uuid::new_v4(),
            child_id,
            source_type: XpSourceType::Explore,
            source_id: body.video_id,
            amount: idea_pop_domain::XP_EXPLORE,
            created_at: now,
        };
        g.xp.append_event(&event).await?;
        xp_earned += idea_pop_domain::XP_EXPLORE;

        let iw = now.date_naive().iso_week();
        if let CycleActivityResult::CycleCompleted(cycle_id) = g
            .progress
            .update_cycle_activity(child_id, iw.year(), iw.week(), &XpSourceType::Explore)
            .await?
        {
            g.xp.append_event(&award_cycle_bonus(child_id, cycle_id, now))
                .await?;
            xp_earned += idea_pop_domain::XP_CYCLE_BONUS;
            cycle_bonus_earned = true;
        }

        g.analytics
            .emit(&AnalyticsEvent {
                id: Uuid::new_v4(),
                child_id,
                kind: AnalyticsEventKind::VideoViewed {
                    video_id: body.video_id,
                },
                created_at: now,
            })
            .await?;
    }

    let events = g.xp.list_events(child_id).await?;
    let total = xp_total(&events);
    let level = level_from_xp(total);
    let rank = rank_from_level(level);
    g.xp.upsert_progress(child_id, total, level, rank.as_str())
        .await?;

    Ok(Json(XpAwardResponse {
        xp_earned,
        xp_total: total,
        level,
        rank: rank.as_str().to_owned(),
        is_new,
        cycle_bonus_earned,
    }))
}

// ── POST /challenges/{id}/define-bonus ───────────────────────────────────────

/// +5 XP, once per mission, when the kid has defined the mission's problem with
/// the 5W1H questions. The answers themselves stay on the kid's device; only the
/// fact of finishing is recorded.
#[utoipa::path(
    post, path = "/challenges/{id}/define-bonus", tag = "progress",
    params(("id" = Uuid, Path, description = "Challenge UUID")),
    responses(
        (status = 200, description = "XP awarded (or 0 if already awarded)", body = XpAwardResponse),
        (status = 403, description = "Non-kid token rejected", body = crate::ProblemDetail),
        (status = 404, description = "Challenge not found", body = crate::ProblemDetail),
    )
)]
pub async fn post_define_bonus(
    KidAuth { child_id, .. }: KidAuth,
    State(state): State<AppState>,
    Path(challenge_id): Path<Uuid>,
) -> Result<Json<XpAwardResponse>, ApiError> {
    if state.challenge.find_by_id(challenge_id).await?.is_none() {
        return Err(ApiError::Domain(idea_pop_domain::DomainError::NotFound));
    }
    let g = &state.gamification;
    let now = Utc::now();

    let events = g.xp.list_events(child_id).await?;
    let award = award_define_bonus(child_id, challenge_id, now, &events);
    let is_new = award.is_some();
    let mut xp_earned: i16 = 0;
    if let Some(event) = award {
        g.xp.append_event(&event).await?;
        xp_earned = event.amount;
    }

    let events = g.xp.list_events(child_id).await?;
    let total = xp_total(&events);
    let level = level_from_xp(total);
    let rank = rank_from_level(level);
    g.xp.upsert_progress(child_id, total, level, rank.as_str())
        .await?;

    Ok(Json(XpAwardResponse {
        xp_earned,
        xp_total: total,
        level,
        rank: rank.as_str().to_owned(),
        is_new,
        cycle_bonus_earned: false,
    }))
}

// ── POST /challenges/{id}/sketch-bonus ───────────────────────────────────────

/// +10 XP, once per mission, when the kid solves the problem with a first
/// sketched idea (the "you solved it!" moment after the Sketch step).
#[utoipa::path(
    post, path = "/challenges/{id}/sketch-bonus", tag = "progress",
    params(("id" = Uuid, Path, description = "Challenge UUID")),
    responses(
        (status = 200, description = "XP awarded (or 0 if already awarded)", body = XpAwardResponse),
        (status = 403, description = "Non-kid token rejected", body = crate::ProblemDetail),
        (status = 404, description = "Challenge not found", body = crate::ProblemDetail),
    )
)]
pub async fn post_sketch_bonus(
    KidAuth { child_id, .. }: KidAuth,
    State(state): State<AppState>,
    Path(challenge_id): Path<Uuid>,
) -> Result<Json<XpAwardResponse>, ApiError> {
    if state.challenge.find_by_id(challenge_id).await?.is_none() {
        return Err(ApiError::Domain(idea_pop_domain::DomainError::NotFound));
    }
    let g = &state.gamification;
    let now = Utc::now();

    let events = g.xp.list_events(child_id).await?;
    let award = award_sketch_bonus(child_id, challenge_id, now, &events);
    let is_new = award.is_some();
    let mut xp_earned: i16 = 0;
    if let Some(event) = award {
        g.xp.append_event(&event).await?;
        xp_earned = event.amount;
    }

    let events = g.xp.list_events(child_id).await?;
    let total = xp_total(&events);
    let level = level_from_xp(total);
    let rank = rank_from_level(level);
    g.xp.upsert_progress(child_id, total, level, rank.as_str())
        .await?;

    Ok(Json(XpAwardResponse {
        xp_earned,
        xp_total: total,
        level,
        rank: rank.as_str().to_owned(),
        is_new,
        cycle_bonus_earned: false,
    }))
}

// ── POST /progress/lesson-complete ───────────────────────────────────────────

#[utoipa::path(
    post, path = "/progress/lesson-complete", tag = "progress",
    request_body = LessonCompleteRequest,
    responses(
        (status = 200, description = "XP awarded (or 0 if already completed)", body = XpAwardResponse),
        (status = 403, description = "Non-kid token rejected", body = crate::ProblemDetail),
    )
)]
pub async fn post_lesson_complete(
    KidAuth { child_id, .. }: KidAuth,
    State(state): State<AppState>,
    Json(body): Json<LessonCompleteRequest>,
) -> Result<Json<XpAwardResponse>, ApiError> {
    let g = &state.gamification;
    let now = Utc::now();

    let is_new = g
        .progress
        .record_lesson_complete(child_id, body.lesson_id, now)
        .await?;
    let mut xp_earned: i16 = 0;
    let mut cycle_bonus_earned = false;

    if is_new {
        let event = XpEvent {
            id: Uuid::new_v4(),
            child_id,
            source_type: XpSourceType::Learn,
            source_id: body.lesson_id,
            amount: idea_pop_domain::XP_LEARN,
            created_at: now,
        };
        g.xp.append_event(&event).await?;
        xp_earned += idea_pop_domain::XP_LEARN;

        let iw = now.date_naive().iso_week();
        if let CycleActivityResult::CycleCompleted(cycle_id) = g
            .progress
            .update_cycle_activity(child_id, iw.year(), iw.week(), &XpSourceType::Learn)
            .await?
        {
            g.xp.append_event(&award_cycle_bonus(child_id, cycle_id, now))
                .await?;
            xp_earned += idea_pop_domain::XP_CYCLE_BONUS;
            cycle_bonus_earned = true;
        }

        g.analytics
            .emit(&AnalyticsEvent {
                id: Uuid::new_v4(),
                child_id,
                kind: AnalyticsEventKind::LessonCompleted {
                    lesson_id: body.lesson_id,
                },
                created_at: now,
            })
            .await?;
    }

    let events = g.xp.list_events(child_id).await?;
    let total = xp_total(&events);
    let level = level_from_xp(total);
    let rank = rank_from_level(level);
    g.xp.upsert_progress(child_id, total, level, rank.as_str())
        .await?;

    Ok(Json(XpAwardResponse {
        xp_earned,
        xp_total: total,
        level,
        rank: rank.as_str().to_owned(),
        is_new,
        cycle_bonus_earned,
    }))
}

// ── POST /challenges/:id/attempts ─────────────────────────────────────────────

#[utoipa::path(
    post, path = "/challenges/{id}/attempts", tag = "progress",
    params(("id" = Uuid, Path, description = "Challenge ID")),
    responses(
        (status = 200, description = "Existing in-progress attempt resumed", body = StartAttemptResponse),
        (status = 201, description = "Attempt started", body = StartAttemptResponse),
        (status = 403, description = "Non-kid token rejected", body = crate::ProblemDetail),
    )
)]
pub async fn start_attempt(
    KidAuth { child_id, .. }: KidAuth,
    Path(challenge_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    // Verify challenge exists
    state
        .challenge
        .find_by_id(challenge_id)
        .await?
        .ok_or(ApiError::Domain(DomainError::NotFound))?;

    // Idempotent start: re-opening a mission RESUMES the newest in-progress
    // attempt instead of piling up duplicate step-1 rows (which skewed the
    // teacher/parent progress reports).
    if let Some(existing) = state
        .gamification
        .progress
        .find_in_progress_attempt(child_id, challenge_id)
        .await?
    {
        return Ok((
            StatusCode::OK,
            Json(StartAttemptResponse {
                attempt_id: existing.id,
                challenge_id: existing.challenge_id,
                current_step: existing.current_step,
                status: existing.status.as_str().to_owned(),
            }),
        ));
    }

    let attempt = ChallengeAttempt {
        id: Uuid::new_v4(),
        child_id,
        challenge_id,
        current_step: 1,
        status: AttemptStatus::InProgress,
        started_at: Utc::now(),
        completed_at: None,
    };
    state.gamification.progress.create_attempt(&attempt).await?;

    Ok((
        StatusCode::CREATED,
        Json(StartAttemptResponse {
            attempt_id: attempt.id,
            challenge_id: attempt.challenge_id,
            current_step: attempt.current_step,
            status: attempt.status.as_str().to_owned(),
        }),
    ))
}

// ── PATCH /attempts/:id/step ─────────────────────────────────────────────────

#[utoipa::path(
    patch, path = "/attempts/{id}/step", tag = "progress",
    params(("id" = Uuid, Path, description = "Attempt ID")),
    request_body = AdvanceStepRequest,
    responses(
        (status = 200, description = "Step advanced", body = AdvanceStepResponse),
        (status = 403, description = "Non-kid token or not the owner", body = crate::ProblemDetail),
        (status = 404, description = "Attempt not found", body = crate::ProblemDetail),
    )
)]
pub async fn advance_step(
    KidAuth { child_id, .. }: KidAuth,
    Path(attempt_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(body): Json<AdvanceStepRequest>,
) -> Result<Json<AdvanceStepResponse>, ApiError> {
    if body.step < 1 || body.step > 8 {
        return Err(ApiError::Domain(DomainError::Validation(
            "step must be between 1 and 8".into(),
        )));
    }

    let g = &state.gamification;
    let now = Utc::now();

    let attempt = g
        .progress
        .find_attempt(attempt_id)
        .await?
        .ok_or(ApiError::Domain(DomainError::NotFound))?;

    // Ownership: a child can only advance their own attempt.
    if attempt.child_id != child_id {
        return Err(ApiError::Domain(DomainError::Forbidden(
            "This attempt belongs to another child".into(),
        )));
    }

    if attempt.status == AttemptStatus::Completed {
        return Err(ApiError::Domain(DomainError::Validation(
            "attempt is already completed".into(),
        )));
    }

    let new_status = if body.step == 8 {
        AttemptStatus::Completed
    } else {
        AttemptStatus::InProgress
    };
    let completed_at = if new_status == AttemptStatus::Completed {
        Some(now)
    } else {
        None
    };

    // Check for a prior completion BEFORE marking this attempt done, so we
    // don't count the current attempt as "already earned".
    let already_solved = if new_status == AttemptStatus::Completed {
        g.progress
            .has_completed_challenge(child_id, attempt.challenge_id)
            .await?
    } else {
        false
    };

    g.progress
        .update_attempt(attempt_id, body.step, &new_status, completed_at)
        .await?;

    // Analytics on every step
    let from_step = attempt.current_step;
    g.analytics
        .emit(&AnalyticsEvent {
            id: Uuid::new_v4(),
            child_id,
            kind: AnalyticsEventKind::ChallengeStepAdvanced {
                challenge_id: attempt.challenge_id,
                attempt_id,
                from_step,
                to_step: body.step,
            },
            created_at: now,
        })
        .await?;

    let mut xp_earned: i16 = 0;
    let mut cycle_bonus_earned = false;

    // Award +20 XP on first-ever completion of this challenge
    if new_status == AttemptStatus::Completed {
        g.analytics
            .emit(&AnalyticsEvent {
                id: Uuid::new_v4(),
                child_id,
                kind: AnalyticsEventKind::ChallengeCompleted {
                    challenge_id: attempt.challenge_id,
                    attempt_id,
                },
                created_at: now,
            })
            .await?;

        if !already_solved {
            let event = XpEvent {
                id: Uuid::new_v4(),
                child_id,
                source_type: XpSourceType::Solve,
                source_id: attempt.challenge_id,
                amount: idea_pop_domain::XP_SOLVE,
                created_at: now,
            };
            g.xp.append_event(&event).await?;
            xp_earned += idea_pop_domain::XP_SOLVE;

            let iw = now.date_naive().iso_week();
            if let CycleActivityResult::CycleCompleted(cycle_id) = g
                .progress
                .update_cycle_activity(child_id, iw.year(), iw.week(), &XpSourceType::Solve)
                .await?
            {
                g.xp.append_event(&award_cycle_bonus(child_id, cycle_id, now))
                    .await?;
                xp_earned += idea_pop_domain::XP_CYCLE_BONUS;
                cycle_bonus_earned = true;
            }

            let events = g.xp.list_events(child_id).await?;
            let total = xp_total(&events);
            let level = level_from_xp(total);
            let rank = rank_from_level(level);
            g.xp.upsert_progress(child_id, total, level, rank.as_str())
                .await?;
        }
    }

    Ok(Json(AdvanceStepResponse {
        attempt_id,
        current_step: body.step,
        status: new_status.as_str().to_owned(),
        xp_earned,
        cycle_bonus_earned,
    }))
}

// ── GET /me/progress ──────────────────────────────────────────────────────────

#[utoipa::path(
    get, path = "/me/progress", tag = "progress",
    responses(
        (status = 200, description = "Full progress summary", body = ProgressResponse),
        (status = 403, description = "Non-kid token rejected", body = crate::ProblemDetail),
    )
)]
pub async fn get_me_progress(
    KidAuth { child_id, .. }: KidAuth,
    State(state): State<AppState>,
) -> Result<Json<ProgressResponse>, ApiError> {
    Ok(Json(refresh_progress(&state, child_id).await?))
}
