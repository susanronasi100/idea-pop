//! Explore & Library content entities: ExploreVideo, Creator, Course, Lesson, QuickMake.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::{AgeMode, DomainError};

// ── Studio ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Studio {
    Craft,
    Art,
    Music,
    Code,
    Science,
    Nature,
}

impl Studio {
    pub fn as_str(self) -> &'static str {
        match self {
            Studio::Craft => "craft",
            Studio::Art => "art",
            Studio::Music => "music",
            Studio::Code => "code",
            Studio::Science => "science",
            Studio::Nature => "nature",
        }
    }

    pub fn from_slug(s: &str) -> Option<Self> {
        match s {
            "craft" => Some(Studio::Craft),
            "art" => Some(Studio::Art),
            "music" => Some(Studio::Music),
            "code" => Some(Studio::Code),
            "science" => Some(Studio::Science),
            "nature" => Some(Studio::Nature),
            _ => None,
        }
    }

    pub fn all() -> [Studio; 6] {
        [
            Studio::Craft,
            Studio::Art,
            Studio::Music,
            Studio::Code,
            Studio::Science,
            Studio::Nature,
        ]
    }
}

// ── SuperpowerCategory ────────────────────────────────────────────────────────

/// Edition-2 grouping for Explore videos by animal superpower, not by habitat.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SuperpowerCategory {
    MastersOfDisguise,
    SoftEngineers,
    SpeedChampions,
    MasterBuilders,
}

impl SuperpowerCategory {
    pub fn as_str(self) -> &'static str {
        match self {
            SuperpowerCategory::MastersOfDisguise => "masters_of_disguise",
            SuperpowerCategory::SoftEngineers => "soft_engineers",
            SuperpowerCategory::SpeedChampions => "speed_champions",
            SuperpowerCategory::MasterBuilders => "master_builders",
        }
    }

    pub fn from_slug(s: &str) -> Option<Self> {
        match s {
            "masters_of_disguise" => Some(SuperpowerCategory::MastersOfDisguise),
            "soft_engineers" => Some(SuperpowerCategory::SoftEngineers),
            "speed_champions" => Some(SuperpowerCategory::SpeedChampions),
            "master_builders" => Some(SuperpowerCategory::MasterBuilders),
            _ => None,
        }
    }

    /// Short marketing tagline shown under each category in the UI.
    pub fn tagline(self) -> &'static str {
        match self {
            SuperpowerCategory::MastersOfDisguise => "change to survive",
            SuperpowerCategory::SoftEngineers => "bodies that think",
            SuperpowerCategory::SpeedChampions => "built for speed",
            SuperpowerCategory::MasterBuilders => "nature's architects",
        }
    }

    pub fn all() -> [SuperpowerCategory; 4] {
        [
            SuperpowerCategory::MastersOfDisguise,
            SuperpowerCategory::SoftEngineers,
            SuperpowerCategory::SpeedChampions,
            SuperpowerCategory::MasterBuilders,
        ]
    }
}

// ── Entities ──────────────────────────────────────────────────────────────────

pub struct ExploreVideo {
    pub id: Uuid,
    pub title: String,
    pub slug: String,
    pub superpower_category: SuperpowerCategory,
    pub taxonomy: String,
    pub video_url: String,
    pub duration_s: i32,
    pub design_secret: String,
    pub sticker_id: String,
    /// XP awarded when a child watches this video; default 5.
    pub xp_reward: i16,
    /// True when this content was AI-generated. Always surfaced in API responses per CLAUDE.md.
    pub ai_generated: bool,
    /// Age brackets this video is suitable for. May contain both Young and Older.
    pub age_modes: Vec<AgeMode>,
    pub created_at: DateTime<Utc>,
}

pub struct Creator {
    pub id: Uuid,
    pub display_name: String,
    pub bio: String,
    pub studio: Studio,
    pub avatar_url: String,
    pub created_at: DateTime<Utc>,
}

pub struct Course {
    pub id: Uuid,
    pub title: String,
    pub slug: String,
    pub studio: Studio,
    pub creator_id: Uuid,
    pub summary: String,
    /// Skill difficulty: 1 (easy), 2 (medium), 3 (hard).
    pub difficulty: i16,
    /// Minimum recommended age.
    pub age_min: i16,
    /// Materials needed across the course (e.g. "laptop", "internet").
    pub materials: Vec<String>,
    /// Own price in Toman for a special expert course sold one by one, outside
    /// the monthly plans. `None` = included in Plus / Family.
    pub price_toman: Option<i32>,
    pub created_at: DateTime<Utc>,
}

/// Lightweight course row for the Library index (no lessons; includes the
/// creator's display name and a lesson count for progress denominators).
pub struct CourseSummary {
    pub id: Uuid,
    pub title: String,
    pub slug: String,
    pub studio: Studio,
    pub creator_id: Uuid,
    pub creator_name: String,
    pub difficulty: i16,
    pub age_min: i16,
    /// Own price in Toman for a special expert course sold one by one, outside
    /// the monthly plans. `None` = included in Plus / Family.
    pub price_toman: Option<i32>,
    pub lesson_count: i64,
}

pub struct Lesson {
    pub id: Uuid,
    pub course_id: Uuid,
    /// 1-based display order within the course.
    pub ordinal: i16,
    pub title: String,
    pub video_url: String,
    pub duration_s: i32,
    /// XP awarded for completing this lesson; default 10.
    pub xp_reward: i16,
}

pub struct QuickMake {
    pub id: Uuid,
    pub title: String,
    pub slug: String,
    pub studio: Studio,
    /// Skill difficulty: 1 (easy), 2 (medium), 3 (hard).
    pub difficulty: i16,
    pub time_minutes: i16,
    pub materials: Vec<String>,
    /// Mess level: 1 (tidy), 2 (moderate), 3 (messy).
    pub mess_level: i16,
    pub video_url: String,
    /// XP awarded for completing this make; default 5.
    pub xp_reward: i16,
    /// True when AI-generated. Always surfaced per CLAUDE.md.
    pub ai_generated: bool,
    pub created_at: DateTime<Utc>,
}

// ── Pagination ────────────────────────────────────────────────────────────────

pub struct Page<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

impl<T> Page<T> {
    pub fn new(items: Vec<T>, total: i64, page: i64, per_page: i64) -> Self {
        Self {
            items,
            total,
            page,
            per_page,
        }
    }
}

// ── Filters ───────────────────────────────────────────────────────────────────

pub struct ExploreFilter {
    pub superpower_category: Option<SuperpowerCategory>,
    pub age_mode: Option<AgeMode>,
    pub page: i64,
    pub per_page: i64,
}

impl ExploreFilter {
    pub fn validate(&self) -> Result<(), DomainError> {
        if self.page < 1 {
            return Err(DomainError::Validation("page must be ≥ 1".into()));
        }
        if self.per_page < 1 || self.per_page > 100 {
            return Err(DomainError::Validation("per_page must be 1–100".into()));
        }
        Ok(())
    }
}

impl Default for ExploreFilter {
    fn default() -> Self {
        Self {
            superpower_category: None,
            age_mode: None,
            page: 1,
            per_page: 20,
        }
    }
}

pub struct QuickMakeFilter {
    pub studio: Option<Studio>,
    pub page: i64,
    pub per_page: i64,
}

impl QuickMakeFilter {
    pub fn validate(&self) -> Result<(), DomainError> {
        if self.page < 1 {
            return Err(DomainError::Validation("page must be ≥ 1".into()));
        }
        if self.per_page < 1 || self.per_page > 100 {
            return Err(DomainError::Validation("per_page must be 1–100".into()));
        }
        Ok(())
    }
}

impl Default for QuickMakeFilter {
    fn default() -> Self {
        Self {
            studio: None,
            page: 1,
            per_page: 20,
        }
    }
}

// ── Studio overview ───────────────────────────────────────────────────────────

pub struct StudioCount {
    pub studio: Studio,
    pub quick_make_count: i64,
    pub course_count: i64,
}

// ── Domain validation ─────────────────────────────────────────────────────────

pub fn validate_quick_make_difficulty(d: i16) -> Result<(), DomainError> {
    if !(1..=3).contains(&d) {
        return Err(DomainError::Validation(format!(
            "difficulty must be 1–3, got {d}"
        )));
    }
    Ok(())
}

pub fn validate_mess_level(m: i16) -> Result<(), DomainError> {
    if !(1..=3).contains(&m) {
        return Err(DomainError::Validation(format!(
            "mess_level must be 1–3, got {m}"
        )));
    }
    Ok(())
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn studio_round_trips() {
        for s in Studio::all() {
            assert_eq!(Studio::from_slug(s.as_str()), Some(s));
        }
        assert_eq!(Studio::from_slug("unknown"), None);
    }

    #[test]
    fn superpower_category_round_trips() {
        for c in SuperpowerCategory::all() {
            assert_eq!(SuperpowerCategory::from_slug(c.as_str()), Some(c));
        }
        assert_eq!(SuperpowerCategory::from_slug("habitat"), None);
        assert_eq!(SuperpowerCategory::from_slug("ocean"), None);
    }

    #[test]
    fn superpower_category_all_has_four_variants() {
        let all = SuperpowerCategory::all();
        assert_eq!(all.len(), 4);
        assert!(all.contains(&SuperpowerCategory::MastersOfDisguise));
        assert!(all.contains(&SuperpowerCategory::SoftEngineers));
        assert!(all.contains(&SuperpowerCategory::SpeedChampions));
        assert!(all.contains(&SuperpowerCategory::MasterBuilders));
    }

    #[test]
    fn superpower_category_taglines_are_nonempty() {
        for c in SuperpowerCategory::all() {
            assert!(!c.tagline().is_empty(), "{:?} tagline must not be empty", c);
        }
    }

    #[test]
    fn age_mode_round_trips() {
        assert_eq!(AgeMode::from_slug("young"), Some(AgeMode::Young));
        assert_eq!(AgeMode::from_slug("older"), Some(AgeMode::Older));
        assert_eq!(AgeMode::from_slug("teen"), None);
        assert_eq!(AgeMode::Young.as_str(), "young");
        assert_eq!(AgeMode::Older.as_str(), "older");
    }

    #[test]
    fn explore_filter_validation() {
        let ok = ExploreFilter::default();
        assert!(ok.validate().is_ok());

        let with_category = ExploreFilter {
            superpower_category: Some(SuperpowerCategory::MastersOfDisguise),
            ..ExploreFilter::default()
        };
        assert!(with_category.validate().is_ok());

        let bad_page = ExploreFilter {
            page: 0,
            ..ExploreFilter::default()
        };
        assert!(bad_page.validate().is_err());

        let bad_per_page = ExploreFilter {
            per_page: 101,
            ..ExploreFilter::default()
        };
        assert!(bad_per_page.validate().is_err());
    }

    #[test]
    fn quick_make_difficulty_validation() {
        assert!(validate_quick_make_difficulty(1).is_ok());
        assert!(validate_quick_make_difficulty(3).is_ok());
        assert!(validate_quick_make_difficulty(0).is_err());
        assert!(validate_quick_make_difficulty(4).is_err());
    }

    #[test]
    fn mess_level_validation() {
        assert!(validate_mess_level(1).is_ok());
        assert!(validate_mess_level(3).is_ok());
        assert!(validate_mess_level(4).is_err());
    }

    #[test]
    fn studio_all_covers_six_variants() {
        let all = Studio::all();
        assert_eq!(all.len(), 6);
        let slugs: Vec<_> = all.iter().map(|s| s.as_str()).collect();
        assert!(slugs.contains(&"craft"));
        assert!(slugs.contains(&"nature"));
    }
}
