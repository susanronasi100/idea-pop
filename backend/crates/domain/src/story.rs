//! Mission story — the storytelling + gamified-instructor layer on a challenge.
//!
//! Every mission is framed as a Story Spine ("Once upon a time… Every day…
//! Until one day… Because of that… Until finally… And ever since then…").
//! Popi (the one penguin) is the story guide who narrates each step, and each
//! step carries a small game. Like the 8 steps, this is DATA, not code: one
//! generic player renders any mission's story from this shape.
//!
//! The story is optional so older missions without one keep working.

use serde::{Deserialize, Serialize};

use crate::DomainError;

/// The mission steps a chapter can belong to, in play order. `tool` is the
/// creativity-tool power-up that sits inside step 5, between Skill and Sketch.
pub const CHAPTER_STEPS: [&str; 9] = [
    "brief",
    "your_idea",
    "nature_clues",
    "design_secret",
    "skill",
    "tool",
    "sketch",
    "build_and_test",
    "celebrate_and_share",
];

/// A character drawn as one of the app's 3D renders (`image` is a path under
/// the frontend's public folder, e.g. `/landing/hero/measure-boy.webp`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StoryCharacter {
    pub name: String,
    pub role: String,
    pub image: Option<String>,
    /// Fallback shown when no render exists yet.
    pub emoji: String,
}

/// One opening storybook page (the first three Story Spine beats).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StoryPage {
    pub beat: String,
    pub emoji: String,
    pub text: String,
}

/// The story card that defines the project on the Brief screen.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StoryCard {
    pub hero: String,
    pub place: String,
    pub problem: String,
    pub goal: String,
    pub rules: String,
    pub helpers: String,
}

/// A chapter banner: one per entry in [`CHAPTER_STEPS`].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Chapter {
    pub step: String,
    /// Chapter label, e.g. "Chapter 3".
    pub label: String,
    /// Story Spine beat, e.g. "Because of that…".
    pub beat: String,
    pub title: String,
    pub line: String,
}

/// What Popi says at each step.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GuideLines {
    pub brief: String,
    pub your_idea: String,
    pub nature_clues: String,
    pub design_secret: String,
    pub skill: String,
    pub sketch: String,
    pub build_and_test: String,
    /// The "change ONE thing and test again" nudge between rounds.
    pub retry_tip: String,
    /// "And ever since then…" — the ending Popi tells on step 8.
    pub ending: String,
}

/// A one-tap check on the Brief screen.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct QuickCheck {
    pub question: String,
    pub options: Vec<String>,
    /// Index into `options`.
    pub answer: usize,
    pub right: String,
    pub wrong: String,
}

/// A flip card on the Nature clues step: organism → trick → what it does.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ClueCard {
    pub name: String,
    pub emoji: String,
    pub image: Option<String>,
    pub tagline: String,
    pub trick: String,
    pub does: String,
    /// Key of the [`MatchGroup`] this clue belongs to in the match game.
    pub group: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MatchGroup {
    pub key: String,
    pub label: String,
}

/// "Predict first" game on the Design secret step.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PredictGame {
    pub prompt: String,
    /// The answer buttons every item shares, e.g. ["Sink", "Float"].
    pub choices: Vec<String>,
    pub items: Vec<PredictItem>,
    /// Shown once every item is answered.
    pub explain: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PredictItem {
    pub emoji: String,
    pub label: String,
    /// Index into `PredictGame::choices`.
    pub answer: usize,
}

/// The Skill step's mini experiment: predict which option wins, then record
/// one number per option.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Lab {
    pub title: String,
    pub predict: String,
    pub options: Vec<String>,
    /// What each number means, e.g. "coins before it sinks".
    pub measure: String,
    /// When false, the smallest number wins (e.g. seconds to spot).
    pub higher_is_better: bool,
}

/// One piece of a creativity tool taught in this mission (a SCAMPER letter,
/// a mind-map branch, a "why", a brainstorm rule…).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolPart {
    pub key: String,
    pub name: String,
    pub what: String,
    pub example: String,
    pub starter: String,
}

/// The creativity-tool power-up, taught in three easy moves: Learn it, See it
/// (Popi's example on an everyday object), Try it (sentence starters).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolLesson {
    /// `scamper` | `mind_map` | `five_whys` | `brainstorm`.
    pub kind: String,
    pub name: String,
    pub intro: String,
    pub example_object: String,
    pub parts: Vec<ToolPart>,
    /// Letters/pieces still to come in later missions (shown locked).
    #[serde(default)]
    pub locked: Vec<String>,
    pub badge: String,
}

/// The two-round fair test on Build & test.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FairTest {
    /// e.g. "coins before it sinks".
    pub measure: String,
    pub higher_is_better: bool,
    pub check_question: String,
    pub check_options: Vec<String>,
    pub change_prompt: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Reflection {
    pub question: String,
    pub options: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Sticker {
    pub name: String,
    pub emoji: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MissionStory {
    pub hero: StoryCharacter,
    pub scene_image: Option<String>,
    /// Exactly 3: Once upon a time / Every day / Until one day.
    pub opening: Vec<StoryPage>,
    pub card: StoryCard,
    /// Exactly one per [`CHAPTER_STEPS`] entry, in that order.
    pub chapters: Vec<Chapter>,
    pub guide: GuideLines,
    pub quick_check: QuickCheck,
    pub clue_cards: Vec<ClueCard>,
    pub match_groups: Vec<MatchGroup>,
    pub predict: PredictGame,
    pub lab: Lab,
    pub tool: ToolLesson,
    pub sketch_checklist: Vec<String>,
    pub test: FairTest,
    pub reflection: Reflection,
    pub sticker: Sticker,
}

fn invalid(msg: impl Into<String>) -> DomainError {
    DomainError::Validation(format!("story: {}", msg.into()))
}

impl MissionStory {
    /// Structural rules the player relies on. Content is authored as JSON, so
    /// these catch authoring slips before they reach a kid's screen.
    pub fn validate(&self) -> Result<(), DomainError> {
        if self.opening.len() != 3 {
            return Err(invalid("opening must have exactly 3 pages"));
        }
        if self.chapters.len() != CHAPTER_STEPS.len() {
            return Err(invalid(format!(
                "expected {} chapters, got {}",
                CHAPTER_STEPS.len(),
                self.chapters.len()
            )));
        }
        for (chapter, step) in self.chapters.iter().zip(CHAPTER_STEPS) {
            if chapter.step != step {
                return Err(invalid(format!(
                    "chapter for '{step}' is out of order (found '{}')",
                    chapter.step
                )));
            }
        }
        let qc = &self.quick_check;
        if qc.options.len() < 2 || qc.answer >= qc.options.len() {
            return Err(invalid("quick_check needs 2+ options and a valid answer"));
        }
        if self.clue_cards.len() < 2 {
            return Err(invalid("at least 2 clue cards"));
        }
        if self.match_groups.len() < 2 {
            return Err(invalid("at least 2 match groups"));
        }
        for card in &self.clue_cards {
            if !self.match_groups.iter().any(|g| g.key == card.group) {
                return Err(invalid(format!(
                    "clue '{}' names unknown group '{}'",
                    card.name, card.group
                )));
            }
        }
        for group in &self.match_groups {
            if !self.clue_cards.iter().any(|c| c.group == group.key) {
                return Err(invalid(format!("match group '{}' has no clue", group.key)));
            }
        }
        let p = &self.predict;
        if p.choices.len() < 2 || p.items.is_empty() {
            return Err(invalid("predict needs 2+ choices and 1+ items"));
        }
        if p.items.iter().any(|i| i.answer >= p.choices.len()) {
            return Err(invalid("predict item answer out of range"));
        }
        if self.lab.options.len() < 2 {
            return Err(invalid("lab needs 2+ options"));
        }
        if !(1..=7).contains(&self.tool.parts.len()) {
            return Err(invalid("tool lesson teaches 1 to 7 parts"));
        }
        if !matches!(
            self.tool.kind.as_str(),
            "scamper" | "mind_map" | "five_whys" | "brainstorm"
        ) {
            return Err(invalid(format!("unknown tool kind '{}'", self.tool.kind)));
        }
        if self.sketch_checklist.is_empty() {
            return Err(invalid("sketch checklist is empty"));
        }
        if self.test.check_options.len() < 2 {
            return Err(invalid("test check needs 2+ options"));
        }
        if self.reflection.options.len() < 2 {
            return Err(invalid("reflection needs 2+ options"));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    pub(crate) fn sample() -> MissionStory {
        let chapter = |step: &str| Chapter {
            step: step.into(),
            label: "Chapter".into(),
            beat: "Because of that…".into(),
            title: "T".into(),
            line: "L".into(),
        };
        MissionStory {
            hero: StoryCharacter {
                name: "Max".into(),
                role: "student".into(),
                image: None,
                emoji: "🧒".into(),
            },
            scene_image: None,
            opening: vec![
                StoryPage {
                    beat: "Once upon a time…".into(),
                    emoji: "🏡".into(),
                    text: "a".into(),
                };
                3
            ],
            card: StoryCard {
                hero: "h".into(),
                place: "p".into(),
                problem: "pr".into(),
                goal: "g".into(),
                rules: "r".into(),
                helpers: "he".into(),
            },
            chapters: CHAPTER_STEPS.iter().map(|s| chapter(s)).collect(),
            guide: GuideLines {
                brief: "b".into(),
                your_idea: "y".into(),
                nature_clues: "n".into(),
                design_secret: "d".into(),
                skill: "s".into(),
                sketch: "sk".into(),
                build_and_test: "bt".into(),
                retry_tip: "rt".into(),
                ending: "e".into(),
            },
            quick_check: QuickCheck {
                question: "q".into(),
                options: vec!["a".into(), "b".into()],
                answer: 1,
                right: "yes".into(),
                wrong: "no".into(),
            },
            clue_cards: vec![
                ClueCard {
                    name: "Strider".into(),
                    emoji: "🦟".into(),
                    image: None,
                    tagline: "t".into(),
                    trick: "t".into(),
                    does: "d".into(),
                    group: "weight".into(),
                },
                ClueCard {
                    name: "Coconut".into(),
                    emoji: "🥥".into(),
                    image: None,
                    tagline: "t".into(),
                    trick: "t".into(),
                    does: "d".into(),
                    group: "air".into(),
                },
            ],
            match_groups: vec![
                MatchGroup {
                    key: "weight".into(),
                    label: "Spreads weight".into(),
                },
                MatchGroup {
                    key: "air".into(),
                    label: "Traps air".into(),
                },
            ],
            predict: PredictGame {
                prompt: "p".into(),
                choices: vec!["Sink".into(), "Float".into()],
                items: vec![PredictItem {
                    emoji: "🚢".into(),
                    label: "Ship".into(),
                    answer: 1,
                }],
                explain: "e".into(),
            },
            lab: Lab {
                title: "Lab".into(),
                predict: "Which?".into(),
                options: vec!["a".into(), "b".into()],
                measure: "coins".into(),
                higher_is_better: true,
            },
            tool: ToolLesson {
                kind: "scamper".into(),
                name: "SCAMPER".into(),
                intro: "i".into(),
                example_object: "umbrella".into(),
                parts: vec![ToolPart {
                    key: "s".into(),
                    name: "Substitute".into(),
                    what: "w".into(),
                    example: "e".into(),
                    starter: "s".into(),
                }],
                locked: vec!["M".into()],
                badge: "SCAMPER Starter".into(),
            },
            sketch_checklist: vec!["labels".into()],
            test: FairTest {
                measure: "coins".into(),
                higher_is_better: true,
                check_question: "Stable?".into(),
                check_options: vec!["Steady".into(), "Wobbly".into()],
                change_prompt: "What did you change?".into(),
            },
            reflection: Reflection {
                question: "Which trick?".into(),
                options: vec!["a".into(), "b".into()],
            },
            sticker: Sticker {
                name: "River Crosser".into(),
                emoji: "🌉".into(),
            },
        }
    }

    #[test]
    fn sample_story_is_valid() {
        assert!(sample().validate().is_ok());
    }

    #[test]
    fn opening_needs_three_pages() {
        let mut s = sample();
        s.opening.pop();
        assert!(s.validate().unwrap_err().to_string().contains("3 pages"));
    }

    #[test]
    fn chapters_must_follow_the_play_order() {
        let mut s = sample();
        s.chapters.swap(0, 1);
        assert!(s
            .validate()
            .unwrap_err()
            .to_string()
            .contains("out of order"));
    }

    #[test]
    fn quick_check_answer_must_exist() {
        let mut s = sample();
        s.quick_check.answer = 5;
        assert!(s.validate().is_err());
    }

    #[test]
    fn clue_must_name_a_known_group() {
        let mut s = sample();
        s.clue_cards[0].group = "nope".into();
        assert!(s
            .validate()
            .unwrap_err()
            .to_string()
            .contains("unknown group"));
    }

    #[test]
    fn every_group_needs_a_clue() {
        let mut s = sample();
        s.match_groups.push(MatchGroup {
            key: "rim".into(),
            label: "Rim".into(),
        });
        assert!(s
            .validate()
            .unwrap_err()
            .to_string()
            .contains("has no clue"));
    }

    #[test]
    fn predict_answer_must_be_a_choice() {
        let mut s = sample();
        s.predict.items[0].answer = 9;
        assert!(s.validate().is_err());
    }

    #[test]
    fn tool_kind_is_checked() {
        let mut s = sample();
        s.tool.kind = "doodle".into();
        assert!(s
            .validate()
            .unwrap_err()
            .to_string()
            .contains("unknown tool"));
    }

    #[test]
    fn tool_teaches_at_most_seven_parts() {
        let mut s = sample();
        let part = s.tool.parts[0].clone();
        s.tool.parts = vec![part; 8];
        assert!(s.validate().is_err());
    }

    #[test]
    fn story_round_trips_through_json() {
        let s = sample();
        let v = serde_json::to_value(&s).unwrap();
        let back: MissionStory = serde_json::from_value(v).unwrap();
        assert_eq!(s, back);
    }
}
