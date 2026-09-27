//! Mission stories — the Story Spine + Popi instructor layer for Season 1.
//!
//! One JSON file per challenge slug lives in `backend/content/stories/`. The
//! seed writes each into `challenges.story` BY SLUG, after the challenge rows
//! exist, so the story layer never touches the authored step content. A slug
//! with no row yet is skipped and lands on the next seed run.

use sqlx::PgPool;

/// (slug, story JSON) for every authored mission story, in season order.
pub const STORIES: &[(&str, &str)] = &[(
    "help-max-cross-the-river",
    include_str!("../../../content/stories/help-max-cross-the-river.json"),
)];

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

    #[test]
    fn slugs_are_unique() {
        let mut slugs: Vec<_> = STORIES.iter().map(|(s, _)| *s).collect();
        slugs.sort_unstable();
        let n = slugs.len();
        slugs.dedup();
        assert_eq!(n, slugs.len());
    }
}
