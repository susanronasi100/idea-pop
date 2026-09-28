//! Season 2 missions (weeks 21-50): weeks 21-40 for kids 10+, weeks 41-50 the
//! harder 13+ track.
//!
//! Unlike Season 1, whose steps are inlined in `seed.rs`, each Season 2 mission
//! is one JSON file in `backend/content/challenges/<slug>.json` holding the
//! title, season, week, the 8 steps, tools and age tiers. Stories and Persian
//! translations are registered in `seed_stories.rs` and `seed_translations.rs`
//! like Season 1's.

use serde::Deserialize;
use sqlx::PgPool;

macro_rules! s2 {
    ($slug:literal) => {
        (
            $slug,
            include_str!(concat!("../../../content/challenges/", $slug, ".json")),
        )
    };
}

/// (slug, challenge JSON) for every Season 2 mission, in week order.
pub const SEASON_2: &[(&str, &str)] = &[
    s2!("light-the-way-home"),
    s2!("the-tower-that-wont-fall"),
    s2!("the-too-hot-slide"),
    s2!("the-waggle-dance-treasure-hunt"),
    s2!("a-helping-hand-for-grandma"),
    s2!("dive-and-rise"),
    s2!("the-jumping-grasshopper-toy"),
    s2!("the-lunch-trash-mountain"),
    s2!("the-stuck-ketchup-bottle"),
    s2!("the-holiday-plant-sitter"),
    s2!("the-bat-detective"),
    s2!("the-spinning-seed-helicopter"),
    s2!("the-new-kid-cant-find-the-way"),
    s2!("the-slippery-floor"),
    s2!("the-hallway-traffic-jam"),
    s2!("the-tent-in-a-pocket"),
    s2!("a-doorbell-grandpa-can-feel"),
    s2!("the-sunflower-solar-garden"),
    s2!("the-squirrel-proof-bird-feeder"),
    s2!("the-tightrope-circus"),
    s2!("cool-the-city-block"),
    s2!("the-whale-fin-fan"),
    s2!("the-slime-mold-map"),
    s2!("the-lightest-strongest-bridge"),
    s2!("the-octopus-gripper"),
    s2!("fresh-water-from-the-sea"),
    s2!("colours-without-paint"),
    s2!("the-flock-algorithm"),
    s2!("the-self-healing-tyre"),
    s2!("the-inventors-fair"),
];

/// One authored mission file.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AuthoredChallenge {
    pub title: String,
    pub season: i16,
    pub week: i16,
    pub is_premium: bool,
    pub steps: serde_json::Value,
    pub tools: serde_json::Value,
    pub age_tier_variants: serde_json::Value,
}

const STEP_ORDER: [&str; 8] = [
    "brief",
    "your_idea",
    "nature_clues",
    "design_secret",
    "skill",
    "sketch",
    "build_and_test",
    "celebrate_and_share",
];

/// Parse a mission file and check it the way the engine needs it: the 8 steps
/// in canonical order, "I have an idea" forking to step 6, known tool kinds and
/// at least one age tier.
pub fn parse(json: &str) -> anyhow::Result<AuthoredChallenge> {
    use idea_pop_domain::challenge::ChallengeStep;
    use idea_pop_infra::challenge_repo::{steps_from_value, tools_from_value, variants_from_value};

    let c: AuthoredChallenge = serde_json::from_str(json)?;
    anyhow::ensure!(!c.title.trim().is_empty(), "title is empty");
    let steps = steps_from_value(c.steps.clone())?;
    let kinds: Vec<_> = steps.iter().map(ChallengeStep::kind_str).collect();
    anyhow::ensure!(kinds == STEP_ORDER, "steps out of order: {kinds:?}");
    if let Some(ChallengeStep::YourIdea { fork_to_step, .. }) = steps.get(1) {
        anyhow::ensure!(*fork_to_step == 6, "fork_to_step must be 6");
    }
    anyhow::ensure!(!tools_from_value(c.tools.clone())?.is_empty(), "no tools");
    anyhow::ensure!(
        !variants_from_value(c.age_tier_variants.clone())?.is_empty(),
        "no age tiers"
    );
    Ok(c)
}

pub async fn seed_season_2(pool: &PgPool) -> anyhow::Result<()> {
    for (slug, json) in SEASON_2 {
        let c = parse(json).map_err(|e| anyhow::anyhow!("challenge {slug}: {e}"))?;
        sqlx::query(
            r#"INSERT INTO challenges
               (title, slug, season, week_number, xp_reward, steps, tools, age_tier_variants, is_premium)
               VALUES ($1, $2, $3, $4, 20, $5, $6, $7, $8)
               ON CONFLICT (slug) DO UPDATE
               SET title = EXCLUDED.title,
                   season = EXCLUDED.season,
                   week_number = EXCLUDED.week_number,
                   xp_reward = EXCLUDED.xp_reward,
                   steps = EXCLUDED.steps,
                   tools = EXCLUDED.tools,
                   age_tier_variants = EXCLUDED.age_tier_variants,
                   is_premium = EXCLUDED.is_premium"#,
        )
        .bind(&c.title)
        .bind(slug)
        .bind(c.season)
        .bind(c.week)
        .bind(sqlx::types::Json(&c.steps))
        .bind(sqlx::types::Json(&c.tools))
        .bind(sqlx::types::Json(&c.age_tier_variants))
        .bind(c.is_premium)
        .execute(pool)
        .await?;
    }
    println!("season 2 challenges seeded ({} entries)", SEASON_2.len());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{parse, SEASON_2};

    #[test]
    fn every_mission_file_is_valid() {
        for (slug, json) in SEASON_2 {
            parse(json).unwrap_or_else(|e| panic!("{slug}: {e}"));
        }
    }

    /// Weeks 21-50 each have exactly one mission, listed in week order.
    #[test]
    fn weeks_run_21_to_50_in_order() {
        let weeks: Vec<i16> = SEASON_2
            .iter()
            .map(|(_, json)| parse(json).unwrap().week)
            .collect();
        assert_eq!(weeks, (21..=50).collect::<Vec<i16>>());
    }

    /// New challenges are free for now (product decision, 2026-09).
    #[test]
    fn season_2_is_free() {
        for (slug, json) in SEASON_2 {
            let c = parse(json).unwrap();
            assert_eq!(c.season, 2, "{slug}");
            assert!(!c.is_premium, "{slug}");
        }
    }

    /// Every file in content/challenges is registered, and every Season 2
    /// mission also has a story and a Persian translation.
    #[test]
    fn every_mission_is_registered_with_a_story_and_persian() {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../content/challenges");
        for entry in std::fs::read_dir(&dir).expect("content/challenges exists") {
            let path = entry.expect("dir entry").path();
            let slug = path.file_stem().and_then(|s| s.to_str()).expect("name");
            assert!(
                SEASON_2.iter().any(|(s, _)| *s == slug),
                "{slug}: add it to SEASON_2"
            );
        }
        for (slug, _) in SEASON_2 {
            assert!(
                crate::seed_stories::STORIES.iter().any(|(s, _)| s == slug),
                "{slug}: no story"
            );
            assert!(
                crate::seed_translations::FA
                    .iter()
                    .any(|(s, _, _)| s == slug),
                "{slug}: no Persian translation"
            );
        }
    }
}
