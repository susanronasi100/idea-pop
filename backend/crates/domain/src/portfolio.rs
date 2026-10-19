//! Portfolio, sharing, moderation, and reporting domain.
//!
//! Non-negotiable safety invariants (CLAUDE.md):
//! - Projects are PRIVATE by default. Class/Public promotion REQUIRES a recorded human approval.
//! - Effective visibility stays Private until a reviewer approves the moderation item.
//! - Demotion to Private is immediate, needs no approval.
//! - Shared content identity is ONLY avatar + nickname; never account_id or PII.
//! - A child acts on its OWN content only (enforced in API handlers).
//! - The Ideas Wall is locked until a kid submits their own idea for that challenge.

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::DomainError;

// ── OriginType ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OriginType {
    Challenge,
    Lesson,
    QuickMake,
}

impl OriginType {
    pub fn as_str(&self) -> &'static str {
        match self {
            OriginType::Challenge => "challenge",
            OriginType::Lesson => "lesson",
            OriginType::QuickMake => "quick_make",
        }
    }

    pub fn from_db(s: &str) -> Option<Self> {
        match s {
            "challenge" => Some(OriginType::Challenge),
            "lesson" => Some(OriginType::Lesson),
            "quick_make" => Some(OriginType::QuickMake),
            _ => None,
        }
    }
}

// ── Visibility ────────────────────────────────────────────────────────────────

/// Content visibility level. All child-created content starts Private.
///
/// Safety invariant: promotion to Class or Public REQUIRES a recorded human
/// approval via the moderation queue. Effective visibility stays Private until
/// Approved. Demotion to Private is immediate and needs no approval.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Visibility {
    Private,
    Class,
    Public,
}

impl Visibility {
    pub fn as_str(&self) -> &'static str {
        match self {
            Visibility::Private => "private",
            Visibility::Class => "class",
            Visibility::Public => "public",
        }
    }

    pub fn from_db(s: &str) -> Option<Self> {
        match s {
            "private" => Some(Visibility::Private),
            "class" => Some(Visibility::Class),
            "public" => Some(Visibility::Public),
            _ => None,
        }
    }

    pub fn requires_moderation(&self) -> bool {
        matches!(self, Visibility::Class | Visibility::Public)
    }
}

// ── Project ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct Project {
    pub id: Uuid,
    pub child_id: Uuid,
    pub origin_type: OriginType,
    pub origin_id: Uuid,
    pub title: String,
    pub description: String,
    pub materials: String,
    pub what_was_hard: String,
    pub what_to_improve: String,
    pub photo_keys: Vec<String>,
    /// What the child is requesting (may differ from effective while pending).
    pub requested_visibility: Visibility,
    /// The actually-visible level: Private until a moderation Approval lands.
    pub effective_visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Project {
    /// Create a new project. Visibility always starts as Private (both fields).
    pub fn new(
        child_id: Uuid,
        origin_type: OriginType,
        origin_id: Uuid,
        title: String,
        now: DateTime<Utc>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            child_id,
            origin_type,
            origin_id,
            title,
            description: String::new(),
            materials: String::new(),
            what_was_hard: String::new(),
            what_to_improve: String::new(),
            photo_keys: Vec::new(),
            requested_visibility: Visibility::Private,
            effective_visibility: Visibility::Private,
            created_at: now,
            updated_at: now,
        }
    }
}

/// Outcome of requesting a visibility change.
#[derive(Debug, PartialEq, Eq)]
pub enum VisibilityChangeResult {
    /// Applied immediately — only demotion to Private takes this path.
    Immediate(Visibility),
    /// A moderation item must be created; effective_visibility stays Private.
    PendingModeration(Visibility),
}

/// Compute the outcome of a visibility request.
/// Callers are responsible for creating the ModerationItem when PendingModeration.
pub fn request_visibility_change(target: Visibility) -> VisibilityChangeResult {
    if target == Visibility::Private {
        VisibilityChangeResult::Immediate(Visibility::Private)
    } else {
        VisibilityChangeResult::PendingModeration(target)
    }
}

// ── Moderation ────────────────────────────────────────────────────────────────

/// 24-hour SLA for moderation items.
pub const MODERATION_SLA_HOURS: i64 = 24;

pub fn moderation_due_at(created_at: DateTime<Utc>) -> DateTime<Utc> {
    created_at + Duration::hours(MODERATION_SLA_HOURS)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModerationStatus {
    Pending,
    Approved,
    Rejected,
}

impl ModerationStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ModerationStatus::Pending => "pending",
            ModerationStatus::Approved => "approved",
            ModerationStatus::Rejected => "rejected",
        }
    }

    pub fn from_db(s: &str) -> Option<Self> {
        match s {
            "pending" => Some(ModerationStatus::Pending),
            "approved" => Some(ModerationStatus::Approved),
            "rejected" => Some(ModerationStatus::Rejected),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModerationContentType {
    Project,
    Idea,
}

impl ModerationContentType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ModerationContentType::Project => "project",
            ModerationContentType::Idea => "idea",
        }
    }

    pub fn from_db(s: &str) -> Option<Self> {
        match s {
            "project" => Some(ModerationContentType::Project),
            "idea" => Some(ModerationContentType::Idea),
            _ => None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ModerationItem {
    pub id: Uuid,
    pub content_type: ModerationContentType,
    pub content_id: Uuid,
    pub status: ModerationStatus,
    pub reason: Option<String>,
    pub reviewer_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub due_at: DateTime<Utc>,
}

impl ModerationItem {
    pub fn new(content_type: ModerationContentType, content_id: Uuid, now: DateTime<Utc>) -> Self {
        Self {
            id: Uuid::new_v4(),
            content_type,
            content_id,
            status: ModerationStatus::Pending,
            reason: None,
            reviewer_id: None,
            created_at: now,
            reviewed_at: None,
            due_at: moderation_due_at(now),
        }
    }
}

// ── ChallengeIdea ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ChallengeIdea {
    pub id: Uuid,
    pub child_id: Uuid,
    pub challenge_id: Uuid,
    pub text: String,
    pub photo_key: Option<String>,
    pub remix_of: Option<Uuid>,
    pub moderation_status: ModerationStatus,
    pub created_at: DateTime<Utc>,
}

impl ChallengeIdea {
    pub fn new(
        child_id: Uuid,
        challenge_id: Uuid,
        text: String,
        photo_key: Option<String>,
        remix_of: Option<Uuid>,
        now: DateTime<Utc>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            child_id,
            challenge_id,
            text,
            photo_key,
            remix_of,
            moderation_status: ModerationStatus::Pending,
            created_at: now,
        }
    }
}

// ── Reactions ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReactionType {
    Claps,
    Stars,
    Lightbulbs,
}

impl ReactionType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ReactionType::Claps => "claps",
            ReactionType::Stars => "stars",
            ReactionType::Lightbulbs => "lightbulbs",
        }
    }

    pub fn from_db(s: &str) -> Option<Self> {
        match s {
            "claps" => Some(ReactionType::Claps),
            "stars" => Some(ReactionType::Stars),
            "lightbulbs" => Some(ReactionType::Lightbulbs),
            _ => None,
        }
    }

    pub fn from_str_validated(s: &str) -> Option<Self> {
        Self::from_db(s)
    }
}

#[derive(Debug, Clone, Default)]
pub struct ReactionCounts {
    pub claps: u32,
    pub stars: u32,
    pub lightbulbs: u32,
}

// ── Report ────────────────────────────────────────────────────────────────────

pub const REPORT_SLA_HOURS: i64 = 24;

pub fn report_due_at(created_at: DateTime<Utc>) -> DateTime<Utc> {
    created_at + Duration::hours(REPORT_SLA_HOURS)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReportStatus {
    Pending,
    Resolved,
}

impl ReportStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ReportStatus::Pending => "pending",
            ReportStatus::Resolved => "resolved",
        }
    }

    pub fn from_db(s: &str) -> Option<Self> {
        match s {
            "pending" => Some(ReportStatus::Pending),
            "resolved" => Some(ReportStatus::Resolved),
            _ => None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct Report {
    pub id: Uuid,
    pub reporter_id: Uuid,
    pub content_type: ModerationContentType,
    pub content_id: Uuid,
    pub reason: String,
    pub status: ReportStatus,
    pub created_at: DateTime<Utc>,
    pub due_at: DateTime<Utc>,
}

impl Report {
    pub fn new(
        reporter_id: Uuid,
        content_type: ModerationContentType,
        content_id: Uuid,
        reason: String,
        now: DateTime<Utc>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            reporter_id,
            content_type,
            content_id,
            reason,
            status: ReportStatus::Pending,
            created_at: now,
            due_at: report_due_at(now),
        }
    }
}

// ── Project photos ────────────────────────────────────────────────────────────

/// Largest project photo a child can add (8 MB).
pub const MAX_PHOTO_BYTES: usize = 8 * 1024 * 1024;
/// Photos kept per project.
pub const MAX_PHOTOS_PER_PROJECT: usize = 5;
/// Longest text kept in one project field (what I made, what I used, …).
pub const MAX_PROJECT_TEXT: usize = 2000;

/// Checks a project photo before it is stored, and returns its file extension.
/// Photos are "project, not face": they stay as private as the project they belong to.
pub fn check_project_photo(
    content_type: &str,
    size: usize,
    photos_already: usize,
) -> Result<&'static str, DomainError> {
    let ext = match content_type {
        "image/jpeg" | "image/jpg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        _ => {
            return Err(DomainError::Validation(
                "photo must be a JPEG, PNG or WebP image".into(),
            ))
        }
    };
    if size == 0 || size > MAX_PHOTO_BYTES {
        return Err(DomainError::Validation("photo must be under 8 MB".into()));
    }
    if photos_already >= MAX_PHOTOS_PER_PROJECT {
        return Err(DomainError::Validation(
            "this project already has the most photos it can hold".into(),
        ));
    }
    Ok(ext)
}

/// Trims a child's project text and caps its length (by characters, so Persian is safe).
pub fn clean_project_text(text: &str) -> String {
    text.trim().chars().take(MAX_PROJECT_TEXT).collect()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn photo_types_and_sizes_are_checked() {
        assert_eq!(check_project_photo("image/jpeg", 10, 0).unwrap(), "jpg");
        assert_eq!(check_project_photo("image/png", 10, 0).unwrap(), "png");
        assert_eq!(check_project_photo("image/webp", 10, 4).unwrap(), "webp");
        assert!(check_project_photo("image/gif", 10, 0).is_err());
        assert!(check_project_photo("image/jpeg", 0, 0).is_err());
        assert!(check_project_photo("image/jpeg", MAX_PHOTO_BYTES + 1, 0).is_err());
        assert!(check_project_photo("image/jpeg", 10, MAX_PHOTOS_PER_PROJECT).is_err());
    }

    #[test]
    fn project_text_is_trimmed_and_capped() {
        assert_eq!(clean_project_text("  raft  "), "raft");
        let long = "ب".repeat(MAX_PROJECT_TEXT + 50);
        assert_eq!(clean_project_text(&long).chars().count(), MAX_PROJECT_TEXT);
    }

    #[test]
    fn project_starts_private_by_default() {
        let now = Utc::now();
        let p = Project::new(
            Uuid::new_v4(),
            OriginType::Challenge,
            Uuid::new_v4(),
            "Bridge Builder".into(),
            now,
        );
        assert_eq!(p.requested_visibility, Visibility::Private);
        assert_eq!(p.effective_visibility, Visibility::Private);
    }

    #[test]
    fn demotion_to_private_is_immediate() {
        match request_visibility_change(Visibility::Private) {
            VisibilityChangeResult::Immediate(v) => assert_eq!(v, Visibility::Private),
            VisibilityChangeResult::PendingModeration(_) => {
                panic!("demotion must be immediate, not moderated")
            }
        }
    }

    #[test]
    fn promotion_to_class_requires_moderation() {
        match request_visibility_change(Visibility::Class) {
            VisibilityChangeResult::PendingModeration(v) => assert_eq!(v, Visibility::Class),
            VisibilityChangeResult::Immediate(_) => {
                panic!("class promotion must require moderation")
            }
        }
    }

    #[test]
    fn promotion_to_public_requires_moderation() {
        match request_visibility_change(Visibility::Public) {
            VisibilityChangeResult::PendingModeration(v) => assert_eq!(v, Visibility::Public),
            VisibilityChangeResult::Immediate(_) => {
                panic!("public promotion must require moderation")
            }
        }
    }

    #[test]
    fn visibility_requires_moderation_flags() {
        assert!(Visibility::Class.requires_moderation());
        assert!(Visibility::Public.requires_moderation());
        assert!(!Visibility::Private.requires_moderation());
    }

    #[test]
    fn moderation_item_starts_pending_with_24h_sla() {
        let now = Utc::now();
        let item = ModerationItem::new(ModerationContentType::Project, Uuid::new_v4(), now);
        assert_eq!(item.status, ModerationStatus::Pending);
        assert!(item.reviewer_id.is_none());
        assert!(item.reason.is_none());
        let expected = now + Duration::hours(24);
        assert_eq!(item.due_at, expected);
    }

    #[test]
    fn idea_starts_pending_moderation() {
        let now = Utc::now();
        let idea = ChallengeIdea::new(
            Uuid::new_v4(),
            Uuid::new_v4(),
            "Use a leaf!".into(),
            None,
            None,
            now,
        );
        assert_eq!(idea.moderation_status, ModerationStatus::Pending);
    }

    #[test]
    fn report_starts_pending_with_24h_sla() {
        let now = Utc::now();
        let r = Report::new(
            Uuid::new_v4(),
            ModerationContentType::Idea,
            Uuid::new_v4(),
            "inappropriate content".into(),
            now,
        );
        assert_eq!(r.status, ReportStatus::Pending);
        assert_eq!(r.due_at, now + Duration::hours(24));
    }

    #[test]
    fn reaction_type_round_trips() {
        for s in ["claps", "stars", "lightbulbs"] {
            let rt = ReactionType::from_db(s).unwrap();
            assert_eq!(rt.as_str(), s);
        }
        assert!(ReactionType::from_db("invalid").is_none());
    }

    #[test]
    fn origin_type_round_trips() {
        for (s, v) in [
            ("challenge", OriginType::Challenge),
            ("lesson", OriginType::Lesson),
            ("quick_make", OriginType::QuickMake),
        ] {
            assert_eq!(OriginType::from_db(s).unwrap(), v);
            assert_eq!(v.as_str(), s);
        }
        assert!(OriginType::from_db("other").is_none());
    }

    #[test]
    fn moderation_content_type_round_trips() {
        assert_eq!(
            ModerationContentType::from_db("project").unwrap(),
            ModerationContentType::Project
        );
        assert_eq!(
            ModerationContentType::from_db("idea").unwrap(),
            ModerationContentType::Idea
        );
    }

    #[test]
    fn visibility_round_trips() {
        for (s, v) in [
            ("private", Visibility::Private),
            ("class", Visibility::Class),
            ("public", Visibility::Public),
        ] {
            assert_eq!(Visibility::from_db(s).unwrap(), v);
            assert_eq!(v.as_str(), s);
        }
    }
}
