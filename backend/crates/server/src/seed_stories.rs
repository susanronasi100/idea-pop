//! Mission stories — the Story Spine + Popi instructor layer for Season 1.
//!
//! One JSON file per challenge slug lives in `backend/content/stories/`. The
//! seed writes each into `challenges.story` BY SLUG, after the challenge rows
//! exist, so the story layer never touches the authored step content. A slug
//! with no row yet is skipped and lands on the next seed run.

use sqlx::PgPool;

/// (slug, story JSON) for every authored mission story, in season order:
/// weeks 1-15 nature challenges, weeks 16-20 the AI basics track.
pub const STORIES: &[(&str, &str)] = &[
    (
        "help-max-cross-the-river",
        include_str!("../../../content/stories/help-max-cross-the-river.json"),
    ),
    (
        "the-forest-picnic-problem",
        include_str!("../../../content/stories/the-forest-picnic-problem.json"),
    ),
    (
        "now-you-see-it",
        include_str!("../../../content/stories/now-you-see-it.json"),
    ),
    (
        "water-from-thin-air",
        include_str!("../../../content/stories/water-from-thin-air.json"),
    ),
    (
        "save-the-egg",
        include_str!("../../../content/stories/save-the-egg.json"),
    ),
    (
        "clean-the-pond",
        include_str!("../../../content/stories/clean-the-pond.json"),
    ),
    (
        "stop-the-beach-washing-away",
        include_str!("../../../content/stories/stop-the-beach-washing-away.json"),
    ),
    (
        "keep-the-ice-pop-frozen",
        include_str!("../../../content/stories/keep-the-ice-pop-frozen.json"),
    ),
    (
        "the-backpack-that-wont-stay-shut",
        include_str!("../../../content/stories/the-backpack-that-wont-stay-shut.json"),
    ),
    (
        "the-train-that-went-boom",
        include_str!("../../../content/stories/the-train-that-went-boom.json"),
    ),
    (
        "a-cool-house-for-grandma",
        include_str!("../../../content/stories/a-cool-house-for-grandma.json"),
    ),
    (
        "tobys-kite-is-stuck",
        include_str!("../../../content/stories/tobys-kite-is-stuck.json"),
    ),
    (
        "special-delivery-from-the-treehouse",
        include_str!("../../../content/stories/special-delivery-from-the-treehouse.json"),
    ),
    (
        "the-shelf-that-keeps-falling-down",
        include_str!("../../../content/stories/the-shelf-that-keeps-falling-down.json"),
    ),
    (
        "will-it-rain-today",
        include_str!("../../../content/stories/will-it-rain-today.json"),
    ),
    (
        "the-guess-who-tree",
        include_str!("../../../content/stories/the-guess-who-tree.json"),
    ),
    (
        "teach-the-machine-to-see",
        include_str!("../../../content/stories/teach-the-machine-to-see.json"),
    ),
    (
        "spot-the-fake",
        include_str!("../../../content/stories/spot-the-fake.json"),
    ),
    (
        "train-your-pet-algorithm",
        include_str!("../../../content/stories/train-your-pet-algorithm.json"),
    ),
    (
        "bring-it-to-life",
        include_str!("../../../content/stories/bring-it-to-life.json"),
    ),
];

pub async fn seed_stories(pool: &PgPool) -> anyhow::Result<()> {
    let mut applied = 0;
    for (slug, json) in STORIES {
        let value: serde_json::Value = serde_json::from_str(json)?;
        idea_pop_infra::challenge_repo::story_from_value(value.clone())
            .map_err(|e| anyhow::anyhow!("story for {slug}: {e}"))?;
        let res = sqlx::query("UPDATE challenges SET story = $1 WHERE slug = $2")
            .bind(sqlx::types::Json(&value))
            .bind(slug)
            .execute(pool)
            .await?;
        if res.rows_affected() == 0 {
            println!("story for {slug}: no challenge row yet, skipped");
        } else {
            applied += 1;
        }
    }
    println!("mission stories seeded ({applied} of {})", STORIES.len());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::STORIES;

    /// Every authored story parses and passes the domain's structural rules.
    #[test]
    fn every_story_file_is_valid() {
        for (slug, json) in STORIES {
            let value: serde_json::Value =
                serde_json::from_str(json).unwrap_or_else(|e| panic!("{slug}: {e}"));
            if let Err(e) = idea_pop_infra::challenge_repo::story_from_value(value) {
                panic!("{slug}: {e}");
            }
        }
    }

    /// Every file in content/stories is valid AND registered in STORIES, so a
    /// new story can't be written and then forgotten by the seed.
    #[test]
    fn every_story_file_on_disk_is_valid_and_registered() {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../content/stories");
        for entry in std::fs::read_dir(&dir).expect("content/stories exists") {
            let path = entry.expect("dir entry").path();
            let slug = path
                .file_stem()
                .and_then(|s| s.to_str())
                .expect("file name");
            let json = std::fs::read_to_string(&path).expect("readable");
            let value: serde_json::Value =
                serde_json::from_str(&json).unwrap_or_else(|e| panic!("{slug}: {e}"));
            if let Err(e) = idea_pop_infra::challenge_repo::story_from_value(value) {
                panic!("{slug}: {e}");
            }
            assert!(
                STORIES.iter().any(|(s, _)| *s == slug),
                "{slug}: add it to STORIES"
            );
        }
    }

    #[test]
    fn slugs_are_unique() {
        let mut slugs: Vec<_> = STORIES.iter().map(|(s, _)| *s).collect();
        slugs.sort_unstable();
        let n = slugs.len();
        slugs.dedup();
        assert_eq!(n, slugs.len());
    }
}
