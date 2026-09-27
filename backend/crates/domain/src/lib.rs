//! Idea Pop core domain: entities, value objects, services, and ports (traits).
//!
//! This crate is intentionally pure — no database, no HTTP, no IO. Business
//! rules live here and are unit-tested in isolation against in-memory fakes.

#![forbid(unsafe_code)]

pub mod account;
pub mod auth_service;
pub mod billing;
pub mod challenge;
pub mod child;
pub mod consent_service;
pub mod content;
pub mod help;
pub mod portfolio;
pub mod ports;
pub mod progress;
pub mod story;

pub use account::{Account, RefreshSession, Role, TokenClaims, TokenPair};
pub use auth_service::AuthService;
pub use billing::{
    apply_webhook_event, is_premium, CheckoutResult, Plan, Subscription, SubscriptionStatus,
    WebhookEventKind, GRACE_PERIOD_HOURS,
};
pub use challenge::{
    AgeTier, AgeTierVariant, Challenge, ChallengeFilter, ChallengeStep, Inspiration, Tool, ToolKind,
};
pub use child::{
    AgeMode, ChildProfile, Class, ConsentGate, ConsentStatus, GatedAction, ParentalConsent,
};
pub use consent_service::ConsentService;
pub use content::{
    Course, CourseSummary, Creator, ExploreFilter, ExploreVideo, Lesson, Page, QuickMake,
    QuickMakeFilter, Studio, StudioCount, SuperpowerCategory,
};
pub use portfolio::{
    moderation_due_at, report_due_at, request_visibility_change, ChallengeIdea,
    ModerationContentType, ModerationItem, ModerationStatus, OriginType, Project, ReactionCounts,
    ReactionType, Report, ReportStatus, Visibility, VisibilityChangeResult, MODERATION_SLA_HOURS,
    REPORT_SLA_HOURS,
};
pub use ports::{
    AccountRepo, AnalyticsSink, BadgeRepo, ChallengeRepo, ChildRepo, ClassRepo, Clock,
    ConsentEmailSender, ConsentRepo, EmailSender, ExploreRepo, IdeaRepo, LibraryRepo,
    MissionHelperProvider, ModerationRepo, PasswordHasher, PaymentGateway, PhotoStore,
    ProgressRepo, ProjectRepo, ReportRepo, SubscriptionRepo, TokenIssuer, WebhookEventLog, XpRepo,
};
pub use progress::{
    award_cycle_bonus, award_explore, award_learn, award_solve, compute_snapshot,
    evaluate_new_badges, level_from_xp, medal_from_count, rank_from_level, xp_total,
    AnalyticsEvent, AnalyticsEventKind, AttemptStatus, BadgeCriteria, BadgeDefinition,
    ChallengeAttempt, ChildBadge, CycleActivityResult, Medal, ProgressSnapshot, Rank, XpEvent,
    XpSourceType, XP_CYCLE_BONUS, XP_EXPLORE, XP_LEARN, XP_SOLVE,
};

use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum DomainError {
    #[error("not found")]
    NotFound,
    #[error("validation error: {0}")]
    Validation(String),
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("unauthorized: {0}")]
    Unauthorized(String),
    #[error("forbidden: {0}")]
    Forbidden(String),
    #[error("internal error: {0}")]
    Internal(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn domain_errors_format() {
        assert_eq!(DomainError::NotFound.to_string(), "not found");
        assert_eq!(
            DomainError::Validation("birth_year out of range".into()).to_string(),
            "validation error: birth_year out of range"
        );
        assert_eq!(
            DomainError::Conflict("email already registered".into()).to_string(),
            "conflict: email already registered"
        );
        assert_eq!(
            DomainError::Forbidden("not the parent".into()).to_string(),
            "forbidden: not the parent"
        );
    }
}
