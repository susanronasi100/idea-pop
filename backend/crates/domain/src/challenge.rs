//! Challenge aggregate — the canonical 8-step design-thinking mission.
//!
//! A Challenge is pure data: every engine decision (step order, fork routing,
//! age-tier copy) is encoded in the JSON payload, not in code.  One generic
//! renderer serves any challenge; new missions require zero code changes.

use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{story::MissionStory, AgeMode, DomainError};

// ── AgeTier ──────────────────────────────────────────────────────────────────

/// Age bracket for a challenge variant. The challenge engine selects the
/// appropriate copy for each child based on their birth year.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgeTier {
    #[serde(rename = "8-10")]
    Young,
    #[serde(rename = "10-12")]
    Middle,
    #[serde(rename = "12-18")]
    Teen,
}

impl AgeTier {
    pub fn as_str(&self) -> &'static str {
        match self {
            AgeTier::Young => "8-10",
            AgeTier::Middle => "10-12",
            AgeTier::Teen => "12-18",
        }
    }

    pub fn from_slug(s: &str) -> Option<Self> {
        match s {
            "8-10" => Some(AgeTier::Young),
            "10-12" => Some(AgeTier::Middle),
            "12-18" => Some(AgeTier::Teen),
            _ => None,
        }
    }

    /// Map the coarser child AgeMode to the closest AgeTier for content selection.
    pub fn from_age_mode(mode: &AgeMode) -> AgeTier {
        match mode {
            AgeMode::Young => AgeTier::Young,
            AgeMode::Older => AgeTier::Teen,
        }
    }

    /// All tiers that are appropriate for a given AgeMode.
    pub fn tiers_for_age_mode(mode: &AgeMode) -> &'static [AgeTier] {
        match mode {
            AgeMode::Young => &[AgeTier::Young, AgeTier::Middle],
            AgeMode::Older => &[AgeTier::Middle, AgeTier::Teen],
        }
    }
}

// ── AgeTierVariant ────────────────────────────────────────────────────────────

/// Age-appropriate framing of a challenge for one bracket.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AgeTierVariant {
    pub age_tier: AgeTier,
    /// Optionally override the challenge title for this age group.
    pub title_override: Option<String>,
    /// Brief summary of what this age group is expected to focus on.
    pub summary: String,
}

// ── Tool ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolKind {
    FiveWhys,
    Scamper,
    MindMap,
    Brainstorm,
    /// Says / Thinks / Does / Feels about the person you design for (K12 Lab).
    EmpathyMap,
    /// User + Need + Insight turned into a "How might we…?" question (K12 Lab).
    HowMightWe,
    /// "I like / I wish / What if" feedback on a prototype (K12 Lab).
    LikeWishWhatIf,
    /// Function → nature question → strategy → design principle (Biomimicry
    /// Toolbox "Biologize", Asteria's challenge-to-biology translation).
    NatureTranslator,
    /// The six-step Biomimicry Design Spiral (13+ track).
    DesignSpiral,
}

impl ToolKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            ToolKind::FiveWhys => "five_whys",
            ToolKind::Scamper => "scamper",
            ToolKind::MindMap => "mind_map",
            ToolKind::Brainstorm => "brainstorm",
            ToolKind::EmpathyMap => "empathy_map",
            ToolKind::HowMightWe => "how_might_we",
            ToolKind::LikeWishWhatIf => "like_wish_what_if",
            ToolKind::NatureTranslator => "nature_translator",
            ToolKind::DesignSpiral => "design_spiral",
        }
    }
}

/// A thinking tool recommended for a specific age mode.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Tool {
    pub kind: ToolKind,
    pub age_mode: AgeMode,
}

// ── Inspiration (nature clue) ─────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Inspiration {
    pub text: String,
    pub image_url: Option<String>,
    pub habitat: Option<String>,
}

// ── ChallengeStep ─────────────────────────────────────────────────────────────

/// One of the canonical 8 steps in every challenge.
///
/// The tag field `"step"` carries the step kind so the UI can render the
/// correct template without branching on array index.
///
/// The idea fork (`YourIdea.fork_to_step`) is data, not code — the engine
/// reads the number and navigates; all 8 steps remain reachable via the
/// mission menu regardless.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "step", rename_all = "snake_case")]
pub enum ChallengeStep {
    /// Step 1 — sets the scene with a story and optional image.
    Brief {
        title: String,
        story: String,
        image_url: Option<String>,
    },
    /// Step 2 — the idea fork. `fork_to_step` must always be 6 (Sketch).
    YourIdea {
        prompt: String,
        /// Always 6 — data, not logic. "Yes, I have an idea" → jump to step 6.
        fork_to_step: u8,
    },
    /// Step 3 — nature clues (Inspirations) to seed divergent thinking.
    NatureClues {
        intro: String,
        clues: Vec<Inspiration>,
    },
    /// Step 4 — the design secret revealed from the natural world.
    DesignSecret { secret: String, reveal_hint: String },
    /// Step 5 — a skill mini-lesson; references optional library lessons.
    Skill {
        instructions: String,
        skill_refs: Vec<Uuid>,
        /// Progressive "Need a hint?" ladder; the LAST entry is the give-away.
        /// Defaulted so pre-hints JSONB rows still deserialize.
        #[serde(default)]
        hints: Vec<String>,
    },
    /// Step 6 — sketch the solution concept.
    Sketch { prompt: String, guidance: String },
    /// Step 7 — build a prototype and test it.
    BuildAndTest {
        instructions: String,
        test_criteria: Vec<String>,
        /// Progressive "Need a hint?" ladder; the LAST entry is the give-away.
        /// Defaulted so pre-hints JSONB rows still deserialize.
        #[serde(default)]
        hints: Vec<String>,
    },
    /// Step 8 — celebrate the build and share it (consent-gated in the UI).
    CelebrateAndShare {
        celebration_text: String,
        share_prompt: String,
    },
}

impl ChallengeStep {
    pub fn kind_str(&self) -> &'static str {
        match self {
            ChallengeStep::Brief { .. } => "brief",
            ChallengeStep::YourIdea { .. } => "your_idea",
            ChallengeStep::NatureClues { .. } => "nature_clues",
            ChallengeStep::DesignSecret { .. } => "design_secret",
            ChallengeStep::Skill { .. } => "skill",
            ChallengeStep::Sketch { .. } => "sketch",
            ChallengeStep::BuildAndTest { .. } => "build_and_test",
            ChallengeStep::CelebrateAndShare { .. } => "celebrate_and_share",
        }
    }
}

// ── ChallengeTranslation ──────────────────────────────────────────────────────

/// One locale's copy of a challenge's kid-facing text. It has the same shape
/// as the authored English, so the one generic player renders either.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChallengeTranslation {
    pub title: String,
    pub steps: Vec<ChallengeStep>,
    pub age_tier_variants: Vec<AgeTierVariant>,
    #[serde(default)]
    pub story: Option<MissionStory>,
}

// ── Challenge ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Challenge {
    pub id: Uuid,
    pub title: String,
    pub slug: String,
    pub season: i16,
    pub week_number: i16,
    pub xp_reward: i16,
    /// Exactly 8 steps in canonical order.
    pub steps: Vec<ChallengeStep>,
    pub tools: Vec<Tool>,
    /// At least one age-tier variant is required.
    pub age_tier_variants: Vec<AgeTierVariant>,
    pub related_video_ids: Vec<Uuid>,
    pub skill_refs: Vec<Uuid>,
    /// True when the mission requires a family subscription to play.
    pub is_premium: bool,
    /// The storytelling + gamified-instructor layer (Popi's story, chapters,
    /// games). Optional: missions without one play the classic way.
    pub story: Option<MissionStory>,
    /// Kid-facing text in other locales, keyed by language code (e.g. "fa").
    /// English is the authored copy above.
    #[serde(default)]
    pub translations: BTreeMap<String, ChallengeTranslation>,
    pub created_at: DateTime<Utc>,
}

impl Challenge {
    /// The challenge as a kid reading `lang` sees it. Accepts a bare language
    /// or a region tag ("fa", "fa-IR"). Each part of a translation replaces
    /// the English only when it lines up with it (same step kinds, same
    /// age tiers), so a stale or partial translation falls back to English
    /// instead of breaking play.
    pub fn localized(mut self, lang: &str) -> Self {
        let lang = lang
            .split(['-', '_'])
            .next()
            .unwrap_or("")
            .to_ascii_lowercase();
        let Some(t) = self.translations.remove(&lang) else {
            return self;
        };
        let steps_match = t.steps.len() == self.steps.len()
            && t.steps
                .iter()
                .zip(&self.steps)
                .all(|(a, b)| a.kind_str() == b.kind_str());
        if steps_match {
            self.steps = t.steps;
        }
        let tiers_match = t.age_tier_variants.len() == self.age_tier_variants.len()
            && t.age_tier_variants
                .iter()
                .zip(&self.age_tier_variants)
                .all(|(a, b)| a.age_tier == b.age_tier);
        if tiers_match {
            self.age_tier_variants = t.age_tier_variants;
        }
        if !t.title.trim().is_empty() {
            self.title = t.title;
        }
        if self.story.is_some() && t.story.is_some() {
            self.story = t.story;
        }
        self
    }

    /// Enforce the two structural invariants:
    /// 1. Exactly 8 steps.
    /// 2. At least one age-tier variant.
    ///
    /// Also checks that the `YourIdea` fork always points to step 6.
    pub fn validate(&self) -> Result<(), DomainError> {
        if self.steps.len() != 8 {
            return Err(DomainError::Validation(format!(
                "challenge must have exactly 8 steps, got {}",
                self.steps.len()
            )));
        }
        if self.age_tier_variants.is_empty() {
            return Err(DomainError::Validation(
                "challenge must have at least one age-tier variant".into(),
            ));
        }
        if let Some(ChallengeStep::YourIdea { fork_to_step, .. }) = self.steps.get(1) {
            if *fork_to_step != 6 {
                return Err(DomainError::Validation(format!(
                    "YourIdea.fork_to_step must be 6 (Sketch), got {fork_to_step}"
                )));
            }
        }
        Ok(())
    }

    /// Return the age-tier variant best matching the given tier.
    /// Falls back to the first variant when no exact match exists.
    pub fn variant_for_tier(&self, tier: &AgeTier) -> Option<&AgeTierVariant> {
        self.age_tier_variants
            .iter()
            .find(|v| &v.age_tier == tier)
            .or_else(|| self.age_tier_variants.first())
    }

    /// Convenience: select via coarser AgeMode (Young → 8-10, Older → 12-18).
    pub fn variant_for_age_mode(&self, mode: &AgeMode) -> Option<&AgeTierVariant> {
        let preferred = AgeTier::from_age_mode(mode);
        self.variant_for_tier(&preferred)
    }
}

// ── ChallengeFilter ───────────────────────────────────────────────────────────

#[derive(Debug, Default)]
pub struct ChallengeFilter {
    pub season: Option<i16>,
    pub week: Option<i16>,
    pub age_mode: Option<AgeMode>,
    pub page: i64,
    pub per_page: i64,
}

impl ChallengeFilter {
    pub fn validate(&self) -> Result<(), DomainError> {
        if self.page < 1 {
            return Err(DomainError::Validation("page must be ≥ 1".into()));
        }
        if !(1..=100).contains(&self.per_page) {
            return Err(DomainError::Validation(
                "per_page must be between 1 and 100".into(),
            ));
        }
        Ok(())
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn minimal_challenge(steps: Vec<ChallengeStep>, variants: Vec<AgeTierVariant>) -> Challenge {
        Challenge {
            id: Uuid::new_v4(),
            title: "Test".into(),
            slug: "test".into(),
            season: 1,
            week_number: 1,
            xp_reward: 20,
            steps,
            tools: vec![],
            age_tier_variants: variants,
            related_video_ids: vec![],
            skill_refs: vec![],
            is_premium: false,
            story: None,
            translations: BTreeMap::new(),
            created_at: Utc::now(),
        }
    }

    fn canonical_steps() -> Vec<ChallengeStep> {
        vec![
            ChallengeStep::Brief {
                title: "Brief".into(),
                story: "A story".into(),
                image_url: None,
            },
            ChallengeStep::YourIdea {
                prompt: "Got an idea?".into(),
                fork_to_step: 6,
            },
            ChallengeStep::NatureClues {
                intro: "Look at nature".into(),
                clues: vec![],
            },
            ChallengeStep::DesignSecret {
                secret: "Secret".into(),
                reveal_hint: "Hint".into(),
            },
            ChallengeStep::Skill {
                instructions: "Do this".into(),
                skill_refs: vec![],
                hints: vec![],
            },
            ChallengeStep::Sketch {
                prompt: "Sketch it".into(),
                guidance: "Guidance".into(),
            },
            ChallengeStep::BuildAndTest {
                instructions: "Build it".into(),
                test_criteria: vec!["It works".into()],
                hints: vec![],
            },
            ChallengeStep::CelebrateAndShare {
                celebration_text: "Well done!".into(),
                share_prompt: "Share your creation!".into(),
            },
        ]
    }

    fn one_variant() -> Vec<AgeTierVariant> {
        vec![AgeTierVariant {
            age_tier: AgeTier::Young,
            title_override: None,
            summary: "Entry level".into(),
        }]
    }

    #[test]
    fn valid_challenge_passes() {
        let c = minimal_challenge(canonical_steps(), one_variant());
        assert!(c.validate().is_ok());
    }

    #[test]
    fn eight_step_invariant_enforced() {
        let mut steps = canonical_steps();
        steps.pop();
        let c = minimal_challenge(steps, one_variant());
        let err = c.validate().unwrap_err();
        assert!(err.to_string().contains("exactly 8 steps"));
    }

    #[test]
    fn empty_age_tier_variants_rejected() {
        let c = minimal_challenge(canonical_steps(), vec![]);
        let err = c.validate().unwrap_err();
        assert!(err.to_string().contains("age-tier variant"));
    }

    #[test]
    fn fork_to_wrong_step_rejected() {
        let mut steps = canonical_steps();
        steps[1] = ChallengeStep::YourIdea {
            prompt: "Got an idea?".into(),
            fork_to_step: 5, // wrong — must be 6
        };
        let c = minimal_challenge(steps, one_variant());
        let err = c.validate().unwrap_err();
        assert!(err.to_string().contains("fork_to_step must be 6"));
    }

    #[test]
    fn fork_routing_is_data_not_code() {
        // The fork is just a u8 field; the engine reads it without branching.
        let steps = canonical_steps();
        if let ChallengeStep::YourIdea { fork_to_step, .. } = &steps[1] {
            assert_eq!(
                *fork_to_step, 6,
                "YourIdea always routes to step 6 (Sketch)"
            );
        } else {
            panic!("step[1] must be YourIdea");
        }
        // All 8 steps remain reachable — indices 0-7 cover the full mission.
        assert_eq!(steps.len(), 8);
    }

    #[test]
    fn age_tier_selection_falls_back_to_first() {
        let variants = vec![
            AgeTierVariant {
                age_tier: AgeTier::Young,
                title_override: None,
                summary: "young".into(),
            },
            AgeTierVariant {
                age_tier: AgeTier::Teen,
                title_override: None,
                summary: "teen".into(),
            },
        ];
        let c = minimal_challenge(canonical_steps(), variants);

        // Exact match
        assert_eq!(c.variant_for_tier(&AgeTier::Teen).unwrap().summary, "teen");
        // No Middle variant → falls back to first (Young)
        assert_eq!(
            c.variant_for_tier(&AgeTier::Middle).unwrap().summary,
            "young"
        );
    }

    #[test]
    fn age_mode_maps_to_tier() {
        assert_eq!(AgeTier::from_age_mode(&AgeMode::Young), AgeTier::Young);
        assert_eq!(AgeTier::from_age_mode(&AgeMode::Older), AgeTier::Teen);
    }

    #[test]
    fn step_serde_round_trip() {
        let step = ChallengeStep::YourIdea {
            prompt: "Got an idea?".into(),
            fork_to_step: 6,
        };
        let json = serde_json::to_string(&step).unwrap();
        assert!(json.contains("\"step\":\"your_idea\""));
        assert!(json.contains("\"fork_to_step\":6"));
        let back: ChallengeStep = serde_json::from_str(&json).unwrap();
        assert_eq!(back, step);
    }

    #[test]
    fn hints_round_trip_on_skill_and_build_steps() {
        let steps = vec![
            ChallengeStep::Skill {
                instructions: "Do this".into(),
                skill_refs: vec![],
                hints: vec!["Nudge".into(), "The give-away".into()],
            },
            ChallengeStep::BuildAndTest {
                instructions: "Build it".into(),
                test_criteria: vec!["It works".into()],
                hints: vec!["Try smaller".into()],
            },
        ];
        for step in steps {
            let json = serde_json::to_string(&step).unwrap();
            assert!(json.contains("\"hints\":["));
            let back: ChallengeStep = serde_json::from_str(&json).unwrap();
            assert_eq!(back, step);
        }
    }

    #[test]
    fn steps_without_hints_key_still_deserialize() {
        // The legacy-JSONB guarantee: rows seeded before the hints field
        // existed have no "hints" key and must default to an empty vec.
        let skill: ChallengeStep =
            serde_json::from_str(r#"{"step":"skill","instructions":"Do this","skill_refs":[]}"#)
                .unwrap();
        assert!(matches!(skill, ChallengeStep::Skill { ref hints, .. } if hints.is_empty()));

        let build: ChallengeStep = serde_json::from_str(
            r#"{"step":"build_and_test","instructions":"Build it","test_criteria":["It works"]}"#,
        )
        .unwrap();
        assert!(matches!(build, ChallengeStep::BuildAndTest { ref hints, .. } if hints.is_empty()));
    }

    #[test]
    fn tool_kind_serde() {
        let t = Tool {
            kind: ToolKind::FiveWhys,
            age_mode: AgeMode::Young,
        };
        let json = serde_json::to_string(&t).unwrap();
        assert!(json.contains("five_whys"));
    }

    #[test]
    fn filter_validates_page_bounds() {
        let bad = ChallengeFilter {
            page: 0,
            per_page: 20,
            ..Default::default()
        };
        assert!(bad.validate().is_err());
        let bad2 = ChallengeFilter {
            page: 1,
            per_page: 101,
            ..Default::default()
        };
        assert!(bad2.validate().is_err());
        let ok = ChallengeFilter {
            page: 1,
            per_page: 20,
            ..Default::default()
        };
        assert!(ok.validate().is_ok());
    }

    fn persian() -> ChallengeTranslation {
        let mut steps = canonical_steps();
        if let ChallengeStep::Brief { title, .. } = &mut steps[0] {
            *title = "مأموریت".into();
        }
        ChallengeTranslation {
            title: "آزمایش".into(),
            steps,
            age_tier_variants: vec![AgeTierVariant {
                age_tier: AgeTier::Young,
                title_override: None,
                summary: "سطح شروع".into(),
            }],
            story: None,
        }
    }

    #[test]
    fn localized_swaps_in_the_translation() {
        let mut c = minimal_challenge(canonical_steps(), one_variant());
        c.translations.insert("fa".into(), persian());
        let fa = c.localized("fa-IR");
        assert_eq!(fa.title, "آزمایش");
        assert_eq!(fa.age_tier_variants[0].summary, "سطح شروع");
        assert!(matches!(&fa.steps[0], ChallengeStep::Brief { title, .. } if title == "مأموریت"));
        assert!(fa.validate().is_ok());
    }

    #[test]
    fn localized_keeps_english_for_unknown_locale() {
        let mut c = minimal_challenge(canonical_steps(), one_variant());
        c.translations.insert("fa".into(), persian());
        let en = c.localized("en");
        assert_eq!(en.title, "Test");
        assert_eq!(en.age_tier_variants[0].summary, "Entry level");
    }

    #[test]
    fn localized_ignores_steps_that_do_not_line_up() {
        let mut c = minimal_challenge(canonical_steps(), one_variant());
        let mut t = persian();
        t.steps.swap(0, 1);
        t.age_tier_variants[0].age_tier = AgeTier::Teen;
        c.translations.insert("fa".into(), t);
        let fa = c.localized("fa");
        assert_eq!(fa.title, "آزمایش");
        assert!(matches!(&fa.steps[0], ChallengeStep::Brief { title, .. } if title == "Brief"));
        assert_eq!(fa.age_tier_variants[0].summary, "Entry level");
    }
}
