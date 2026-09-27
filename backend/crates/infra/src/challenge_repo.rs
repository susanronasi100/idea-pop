//! SQLx implementation of ChallengeRepo.
//!
//! All queries use `sqlx::query` (runtime, non-macro) because the JSONB columns
//! require serde_json deserialization which is handled in Rust after fetching.
//! No offline cache entries are needed.

use async_trait::async_trait;
use serde_json::Value as JsonValue;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use idea_pop_domain::{
    challenge::{AgeTier, AgeTierVariant, Challenge, ChallengeFilter, ChallengeStep, Tool},
    content::Page,
    story::MissionStory,
    AgeMode, ChallengeRepo, DomainError,
};

pub struct SqlxChallengeRepo {
    pool: PgPool,
}

impl SqlxChallengeRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

// ── Row → domain ──────────────────────────────────────────────────────────────

fn row_to_challenge(row: &sqlx::postgres::PgRow) -> Result<Challenge, DomainError> {
    let steps_val: JsonValue = row
        .try_get("steps")
        .map_err(|e| DomainError::Internal(e.to_string()))?;
    let steps: Vec<ChallengeStep> = serde_json::from_value(steps_val)
        .map_err(|e| DomainError::Internal(format!("steps: {e}")))?;

    let tools_val: JsonValue = row
        .try_get("tools")
        .map_err(|e| DomainError::Internal(e.to_string()))?;
    let tools: Vec<Tool> = serde_json::from_value(tools_val)
        .map_err(|e| DomainError::Internal(format!("tools: {e}")))?;

    let atv_val: JsonValue = row
        .try_get("age_tier_variants")
        .map_err(|e| DomainError::Internal(e.to_string()))?;
    let age_tier_variants: Vec<AgeTierVariant> = serde_json::from_value(atv_val)
        .map_err(|e| DomainError::Internal(format!("age_tier_variants: {e}")))?;

    let story_val: Option<JsonValue> = row
        .try_get("story")
        .map_err(|e| DomainError::Internal(e.to_string()))?;
    let story: Option<MissionStory> = story_val
        .map(serde_json::from_value)
        .transpose()
        .map_err(|e| DomainError::Internal(format!("story: {e}")))?;

    Ok(Challenge {
        id: row
            .try_get("id")
            .map_err(|e| DomainError::Internal(e.to_string()))?,
        title: row
            .try_get("title")
            .map_err(|e| DomainError::Internal(e.to_string()))?,
        slug: row
            .try_get("slug")
            .map_err(|e| DomainError::Internal(e.to_string()))?,
        season: row
            .try_get("season")
            .map_err(|e| DomainError::Internal(e.to_string()))?,
        week_number: row
            .try_get("week_number")
            .map_err(|e| DomainError::Internal(e.to_string()))?,
        xp_reward: row
            .try_get("xp_reward")
            .map_err(|e| DomainError::Internal(e.to_string()))?,
        steps,
        tools,
        age_tier_variants,
        related_video_ids: row
            .try_get("related_video_ids")
            .map_err(|e| DomainError::Internal(e.to_string()))?,
        skill_refs: row
            .try_get("skill_refs")
            .map_err(|e| DomainError::Internal(e.to_string()))?,
        is_premium: row
            .try_get("is_premium")
            .map_err(|e| DomainError::Internal(e.to_string()))?,
        story,
        created_at: row
            .try_get("created_at")
            .map_err(|e| DomainError::Internal(e.to_string()))?,
    })
}

// ── Filter helpers ────────────────────────────────────────────────────────────

/// Returns true if the challenge has at least one age_tier_variant suitable
/// for the requested AgeMode.  Young maps to 8-10 or 10-12; Older to 10-12
/// or 12-18.
fn matches_age_mode(challenge: &Challenge, mode: &AgeMode) -> bool {
    let tiers = AgeTier::tiers_for_age_mode(mode);
    challenge
        .age_tier_variants
        .iter()
        .any(|v| tiers.contains(&v.age_tier))
}

#[async_trait]
impl ChallengeRepo for SqlxChallengeRepo {
    async fn list(&self, filter: &ChallengeFilter) -> Result<Page<Challenge>, DomainError> {
        // Fetch all rows matching the SQL-level filters (season + week).
        // age_mode is applied in Rust because it requires JSONB introspection.
        let rows = sqlx::query(
            "SELECT id, title, slug, season, week_number, xp_reward, steps, tools, \
             age_tier_variants, related_video_ids, skill_refs, is_premium, story, created_at \
             FROM challenges \
             WHERE ($1::smallint IS NULL OR season = $1) \
               AND ($2::smallint IS NULL OR week_number = $2) \
             ORDER BY season, week_number, id",
        )
        .bind(filter.season)
        .bind(filter.week)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(e.to_string()))?;

        let mut all: Vec<Challenge> = rows
            .iter()
            .map(row_to_challenge)
            .collect::<Result<_, _>>()?;

        if let Some(ref mode) = filter.age_mode {
            all.retain(|c| matches_age_mode(c, mode));
        }

        let total = all.len() as i64;
        let offset = ((filter.page - 1) * filter.per_page) as usize;
        let items: Vec<Challenge> = all
            .into_iter()
            .skip(offset)
            .take(filter.per_page as usize)
            .collect();

        Ok(Page::new(items, total, filter.page, filter.per_page))
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<Challenge>, DomainError> {
        let row = sqlx::query(
            "SELECT id, title, slug, season, week_number, xp_reward, steps, tools, \
             age_tier_variants, related_video_ids, skill_refs, is_premium, story, created_at \
             FROM challenges WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(e.to_string()))?;

        match row {
            Some(r) => Ok(Some(row_to_challenge(&r)?)),
            None => Ok(None),
        }
    }
}

// ── Re-export seed helpers ────────────────────────────────────────────────────

/// Deserialize a `Vec<ChallengeStep>` from a `serde_json::Value` — used by the
/// seed binary to validate steps before insertion.
pub fn steps_from_value(v: JsonValue) -> Result<Vec<ChallengeStep>, serde_json::Error> {
    serde_json::from_value(v)
}

/// Deserialize a `Vec<AgeTierVariant>` from a `serde_json::Value`.
pub fn variants_from_value(v: JsonValue) -> Result<Vec<AgeTierVariant>, serde_json::Error> {
    serde_json::from_value(v)
}

/// Deserialize a `Vec<Tool>` from a `serde_json::Value`.
pub fn tools_from_value(v: JsonValue) -> Result<Vec<Tool>, serde_json::Error> {
    serde_json::from_value(v)
}

/// Deserialize and validate a `MissionStory` — used by the seed binary before
/// writing a story file into `challenges.story`.
pub fn story_from_value(v: JsonValue) -> Result<MissionStory, String> {
    let story: MissionStory = serde_json::from_value(v).map_err(|e| e.to_string())?;
    story.validate().map_err(|e| e.to_string())?;
    Ok(story)
}
