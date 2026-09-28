//! Persian (fa) translations of the Season 1 and Season 2 missions.
//!
//! Each slug has two files under `backend/content/fa/`: `challenges/<slug>.json`
//! (title, the 8 steps, the age-tier variants) and `stories/<slug>.json` (the
//! story layer). They mirror the English shape exactly; only kid-facing text
//! differs. The seed stores them in `challenges.translations.fa` BY SLUG, after
//! the English rows and stories exist.

use sqlx::PgPool;

macro_rules! fa {
    ($slug:literal) => {
        (
            $slug,
            include_str!(concat!("../../../content/fa/challenges/", $slug, ".json")),
            include_str!(concat!("../../../content/fa/stories/", $slug, ".json")),
        )
    };
}

/// (slug, challenge JSON, story JSON) for every translated mission.
pub const FA: &[(&str, &str, &str)] = &[
    fa!("help-max-cross-the-river"),
    fa!("the-forest-picnic-problem"),
    fa!("now-you-see-it"),
    fa!("water-from-thin-air"),
    fa!("save-the-egg"),
    fa!("clean-the-pond"),
    fa!("stop-the-beach-washing-away"),
    fa!("keep-the-ice-pop-frozen"),
    fa!("the-backpack-that-wont-stay-shut"),
    fa!("the-train-that-went-boom"),
    fa!("a-cool-house-for-grandma"),
    fa!("tobys-kite-is-stuck"),
    fa!("special-delivery-from-the-treehouse"),
    fa!("the-shelf-that-keeps-falling-down"),
    fa!("will-it-rain-today"),
    fa!("the-guess-who-tree"),
    fa!("teach-the-machine-to-see"),
    fa!("spot-the-fake"),
    fa!("train-your-pet-algorithm"),
    fa!("bring-it-to-life"),
    fa!("light-the-way-home"),
    fa!("the-tower-that-wont-fall"),
    fa!("the-too-hot-slide"),
    fa!("the-waggle-dance-treasure-hunt"),
    fa!("a-helping-hand-for-grandma"),
    fa!("dive-and-rise"),
    fa!("the-jumping-grasshopper-toy"),
    fa!("the-lunch-trash-mountain"),
    fa!("the-stuck-ketchup-bottle"),
    fa!("the-holiday-plant-sitter"),
    fa!("the-bat-detective"),
    fa!("the-spinning-seed-helicopter"),
    fa!("the-new-kid-cant-find-the-way"),
    fa!("the-slippery-floor"),
    fa!("the-hallway-traffic-jam"),
    fa!("the-tent-in-a-pocket"),
    fa!("a-doorbell-grandpa-can-feel"),
    fa!("the-sunflower-solar-garden"),
    fa!("the-squirrel-proof-bird-feeder"),
    fa!("the-tightrope-circus"),
    fa!("cool-the-city-block"),
    fa!("the-whale-fin-fan"),
    fa!("the-slime-mold-map"),
    fa!("the-lightest-strongest-bridge"),
    fa!("the-octopus-gripper"),
    fa!("fresh-water-from-the-sea"),
    fa!("colours-without-paint"),
    fa!("the-flock-algorithm"),
    fa!("the-self-healing-tyre"),
    fa!("the-inventors-fair"),
];

/// Merge one mission's challenge + story files into the stored translation.
pub fn translation_value(challenge: &str, story: &str) -> anyhow::Result<serde_json::Value> {
    let mut value: serde_json::Value = serde_json::from_str(challenge)?;
    let story: serde_json::Value = serde_json::from_str(story)?;
    value
        .as_object_mut()
        .ok_or_else(|| anyhow::anyhow!("challenge translation must be an object"))?
        .insert("story".into(), story);
    idea_pop_infra::challenge_repo::translation_from_value(value.clone())
        .map_err(|e| anyhow::anyhow!(e))?;
    Ok(value)
}

pub async fn seed_translations(pool: &PgPool) -> anyhow::Result<()> {
    let mut applied = 0;
    for (slug, challenge, story) in FA {
        let value = translation_value(challenge, story)
            .map_err(|e| anyhow::anyhow!("fa for {slug}: {e}"))?;
        let res = sqlx::query(
            "UPDATE challenges SET translations = translations || jsonb_build_object('fa', $1::jsonb) \
             WHERE slug = $2",
        )
        .bind(sqlx::types::Json(&value))
        .bind(slug)
        .execute(pool)
        .await?;
        if res.rows_affected() == 0 {
            println!("fa for {slug}: no challenge row yet, skipped");
        } else {
            applied += 1;
        }
    }
    println!("persian translations seeded ({applied} of {})", FA.len());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{translation_value, FA};

    /// Every translation parses, has 8 steps and a valid story.
    #[test]
    fn every_translation_is_valid() {
        for (slug, challenge, story) in FA {
            if let Err(e) = translation_value(challenge, story) {
                panic!("{slug}: {e}");
            }
        }
    }

    /// Every translated story lines up with its English story, and every
    /// English story has a translation.
    #[test]
    fn every_story_is_translated() {
        for (slug, english) in crate::seed_stories::STORIES {
            let (_, _, story) = FA
                .iter()
                .find(|(s, _, _)| s == slug)
                .unwrap_or_else(|| panic!("{slug}: add it to FA"));
            let en: serde_json::Value = serde_json::from_str(english).expect("english story");
            let fa: serde_json::Value = serde_json::from_str(story).expect("fa story");
            assert_eq!(
                en["chapters"].as_array().map(Vec::len),
                fa["chapters"].as_array().map(Vec::len),
                "{slug}: chapters"
            );
            assert_eq!(
                en["quick_check"]["answer"], fa["quick_check"]["answer"],
                "{slug}"
            );
        }
    }
}
