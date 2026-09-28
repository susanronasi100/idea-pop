//! Handlers for GET /challenges and GET /challenges/:id.
//!
//! Challenges are readable by any authenticated principal (including restricted
//! children). The sharing step in the challenge UI is consent-gated on the
//! frontend; the API surfaces the full payload.

use axum::{
    extract::{Path, Query, State},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use idea_pop_domain::{
    challenge::{Challenge, ChallengeFilter},
    is_premium, AgeMode,
};

use crate::{error::ApiError, extractor::AuthToken, state::AppState};

// ── DTOs ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, ToSchema)]
pub struct AgeTierVariantResponse {
    pub age_tier: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title_override: Option<String>,
    pub summary: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ToolResponse {
    pub kind: String,
    pub age_mode: String,
}

/// A nature clue flattened for the mission player, mapped from the domain
/// `Inspiration` (text/image_url/habitat). Emoji/title derive from the
/// habitat; every clue awards the canonical Explore +5 XP.
#[derive(Debug, Serialize, ToSchema)]
pub struct NatureClueResponse {
    pub emoji: String,
    pub title: String,
    pub description: String,
    pub image_url: Option<String>,
    /// Reserved: clues will link Explore clips once authored.
    pub explore_video_id: Option<Uuid>,
    pub xp_reward: i16,
}

/// A single challenge step — the `step` field names the kind; remaining fields
/// carry the typed payload. Serialised directly from the domain enum so the
/// client receives the full, structured JSON without a separate schema per step.
pub type ChallengeStepValue = serde_json::Value;

#[derive(Debug, Serialize, ToSchema)]
pub struct ChallengeResponse {
    pub id: Uuid,
    pub title: String,
    pub slug: String,
    pub season: i16,
    pub week_number: i16,
    pub xp_reward: i16,
    /// 8 steps in canonical order. Each object has a `"step"` discriminant field.
    pub steps: Vec<ChallengeStepValue>,
    /// The Skill step's "Need a hint?" ladder, flattened for the mission UI
    /// (matches the `skill_hints` field the frontend ChallengeDetail reads).
    pub skill_hints: Vec<String>,
    /// The Build & test step's hint ladder (frontend `build_hints`).
    pub build_hints: Vec<String>,
    // ── Flattened step fields the mission player reads directly ──────────────
    /// The Brief step's story.
    pub brief: String,
    /// Display emoji for the mission header (no authored source yet).
    pub emoji: String,
    /// Alias of xp_reward under the name the player uses.
    pub completion_xp: i16,
    /// The Design-secret step's secret text.
    pub design_secret: String,
    /// The Sketch step's own prompt/guidance (frontend `sketch_prompt` etc.).
    pub sketch_prompt: String,
    pub sketch_guidance: String,
    /// The Design-secret step's reveal hint (teaser shown to older kids).
    pub design_secret_story: Option<String>,
    /// The Nature-clues step's clues, flattened for the player.
    pub nature_clues: Vec<NatureClueResponse>,
    /// First library lesson linked from the Skill step, if any.
    pub skill_lesson_id: Option<Uuid>,
    /// The Skill step's own authored instructions text, if any (the mission
    /// player shows this above the hints; empty authored text → null).
    pub skill_instructions: Option<String>,
    /// Alias of related_video_ids under the name the frontend type uses.
    pub related_explore_ids: Vec<Uuid>,
    pub tools: Vec<ToolResponse>,
    pub age_tier_variants: Vec<AgeTierVariantResponse>,
    pub related_video_ids: Vec<Uuid>,
    /// True when this mission needs a family subscription to play.
    pub is_premium: bool,
    /// True when `is_premium` and the caller's family has no active subscription.
    /// The kid UI shows an "ask a grown-up to upgrade" card for locked missions.
    pub locked: bool,
    /// The mission's story layer (Story Spine chapters, Popi's lines, the
    /// per-step games, the sticker). Null for missions without a story.
    #[schema(value_type = Option<Object>)]
    pub story: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ChallengePageResponse {
    pub items: Vec<ChallengeResponse>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

// ── Query params ──────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, IntoParams)]
pub struct ChallengeQuery {
    pub season: Option<i16>,
    pub week: Option<i16>,
    pub age_mode: Option<String>,
    /// UI language ("en", "fa"). Kid-facing text comes back in it when a
    /// translation exists; otherwise the authored English is returned.
    pub lang: Option<String>,
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_per_page")]
    pub per_page: i64,
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct LangQuery {
    /// UI language ("en", "fa"). Falls back to English when untranslated.
    pub lang: Option<String>,
}

fn default_page() -> i64 {
    1
}
fn default_per_page() -> i64 {
    20
}

// ── Mappers ───────────────────────────────────────────────────────────────────

/// Habitat → (emoji, kid-facing label) for the flattened clue cards.
fn habitat_display(habitat: &str, persian: bool) -> (&'static str, &'static str) {
    match (habitat, persian) {
        ("jungle", false) => ("🌿", "From the jungle"),
        ("jungle", true) => ("🌿", "از جنگل"),
        ("ocean", false) => ("🌊", "From the ocean"),
        ("ocean", true) => ("🌊", "از اقیانوس"),
        ("desert", false) => ("🏜️", "From the desert"),
        ("desert", true) => ("🏜️", "از بیابان"),
        ("sky", false) => ("☁️", "From the sky"),
        ("sky", true) => ("☁️", "از آسمان"),
        (_, false) => ("✨", "From nature"),
        (_, true) => ("✨", "از طبیعت"),
    }
}

fn challenge_to_dto(c: Challenge, has_premium: bool, lang: Option<&str>) -> ChallengeResponse {
    let lang = lang.unwrap_or("en");
    let persian = lang.starts_with("fa");
    let c = c.localized(lang);
    let steps: Vec<serde_json::Value> = c
        .steps
        .iter()
        .map(|s| serde_json::to_value(s).unwrap_or(serde_json::Value::Null))
        .collect();

    // Flatten the step payloads onto the fields the mission player reads.
    use idea_pop_domain::challenge::ChallengeStep;
    let mut skill_hints = Vec::new();
    let mut build_hints = Vec::new();
    let mut brief = String::new();
    let mut design_secret = String::new();
    let mut design_secret_story = None;
    let mut nature_clues = Vec::new();
    let mut sketch_prompt = String::new();
    let mut sketch_guidance = String::new();
    let mut skill_lesson_id = None;
    let mut skill_instructions = None;
    for step in &c.steps {
        match step {
            ChallengeStep::Brief { story, .. } => brief = story.clone(),
            ChallengeStep::DesignSecret {
                secret,
                reveal_hint,
            } => {
                design_secret = secret.clone();
                design_secret_story = Some(reveal_hint.clone()).filter(|h| !h.trim().is_empty());
            }
            ChallengeStep::NatureClues { clues, .. } => {
                nature_clues = clues
                    .iter()
                    .map(|clue| {
                        let (emoji, title) =
                            habitat_display(clue.habitat.as_deref().unwrap_or(""), persian);
                        NatureClueResponse {
                            emoji: emoji.to_owned(),
                            title: title.to_owned(),
                            description: clue.text.clone(),
                            image_url: clue.image_url.clone(),
                            explore_video_id: None,
                            // Canonical Explore reward (CLAUDE.md gamification).
                            xp_reward: 5,
                        }
                    })
                    .collect();
            }
            ChallengeStep::Skill {
                hints,
                skill_refs,
                instructions,
                ..
            } => {
                skill_hints = hints.clone();
                skill_lesson_id = skill_refs.first().copied();
                let trimmed = instructions.trim();
                skill_instructions = (!trimmed.is_empty()).then(|| trimmed.to_owned());
            }
            ChallengeStep::Sketch { prompt, guidance } => {
                sketch_prompt = prompt.clone();
                sketch_guidance = guidance.clone();
            }
            ChallengeStep::BuildAndTest { hints, .. } => build_hints = hints.clone(),
            _ => {}
        }
    }

    let tools = c
        .tools
        .iter()
        .map(|t| ToolResponse {
            kind: t.kind.as_str().to_owned(),
            age_mode: t.age_mode.as_str().to_owned(),
        })
        .collect();

    let age_tier_variants = c
        .age_tier_variants
        .iter()
        .map(|v| AgeTierVariantResponse {
            age_tier: v.age_tier.as_str().to_owned(),
            title_override: v.title_override.clone(),
            summary: v.summary.clone(),
        })
        .collect();

    let emoji = c
        .story
        .as_ref()
        .map(|s| s.hero.emoji.clone())
        .unwrap_or_else(|| "🚀".to_owned());
    let story = c.story.as_ref().and_then(|s| serde_json::to_value(s).ok());

    ChallengeResponse {
        id: c.id,
        title: c.title,
        slug: c.slug,
        season: c.season,
        week_number: c.week_number,
        xp_reward: c.xp_reward,
        steps,
        skill_hints,
        build_hints,
        brief,
        emoji,
        completion_xp: c.xp_reward,
        design_secret,
        design_secret_story,
        sketch_prompt,
        sketch_guidance,
        nature_clues,
        skill_lesson_id,
        skill_instructions,
        related_explore_ids: c.related_video_ids.clone(),
        tools,
        age_tier_variants,
        related_video_ids: c.related_video_ids,
        is_premium: c.is_premium,
        locked: c.is_premium && !has_premium,
        story,
        created_at: c.created_at,
    }
}

/// Does the authenticated caller's family have an active (or in-grace) subscription?
/// Kid tokens carry the parent's `account_id`, so this is always a family-level check.
async fn caller_has_premium(state: &AppState, auth: &AuthToken) -> Result<bool, ApiError> {
    let sub = state
        .billing
        .subscriptions
        .find_by_account(auth.0.account_id)
        .await?;
    Ok(match sub {
        Some(s) => is_premium(&s.status, s.current_period_end, Utc::now()),
        None => false,
    })
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/// List challenges — paginated; optional season, week, and age_mode filters.
#[utoipa::path(
    get, path = "/challenges",
    tag = "challenges",
    params(ChallengeQuery),
    responses(
        (status = 200, description = "Paginated challenge list", body = ChallengePageResponse),
        (status = 401, description = "Unauthenticated",          body = crate::ProblemDetail),
        (status = 422, description = "Validation error",          body = crate::ProblemDetail),
    )
)]
pub async fn list_challenges(
    _auth: AuthToken,
    State(state): State<AppState>,
    Query(q): Query<ChallengeQuery>,
) -> Result<Json<ChallengePageResponse>, ApiError> {
    let age_mode: Option<AgeMode> = q
        .age_mode
        .as_deref()
        .map(|s| {
            AgeMode::from_slug(s).ok_or_else(|| {
                idea_pop_domain::DomainError::Validation(format!(
                    "unknown age_mode '{s}'; expected 'young' or 'older'"
                ))
            })
        })
        .transpose()?;

    let filter = ChallengeFilter {
        season: q.season,
        week: q.week,
        age_mode,
        page: q.page,
        per_page: q.per_page,
    };
    filter.validate()?;

    let has_premium = caller_has_premium(&state, &_auth).await?;

    let page = state.challenge.list(&filter).await?;
    Ok(Json(ChallengePageResponse {
        items: page
            .items
            .into_iter()
            .map(|c| challenge_to_dto(c, has_premium, q.lang.as_deref()))
            .collect(),
        total: page.total,
        page: page.page,
        per_page: page.per_page,
    }))
}

/// Get a single challenge by ID — full 8-step structured payload.
#[utoipa::path(
    get, path = "/challenges/{id}",
    tag = "challenges",
    params(("id" = Uuid, Path, description = "Challenge UUID"), LangQuery),
    responses(
        (status = 200, description = "Challenge detail", body = ChallengeResponse),
        (status = 401, description = "Unauthenticated",  body = crate::ProblemDetail),
        (status = 404, description = "Not found",        body = crate::ProblemDetail),
    )
)]
pub async fn get_challenge(
    _auth: AuthToken,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<LangQuery>,
) -> Result<Json<ChallengeResponse>, ApiError> {
    let has_premium = caller_has_premium(&state, &_auth).await?;
    match state.challenge.find_by_id(id).await? {
        Some(c) => Ok(Json(challenge_to_dto(c, has_premium, q.lang.as_deref()))),
        None => Err(ApiError::Domain(idea_pop_domain::DomainError::NotFound)),
    }
}
