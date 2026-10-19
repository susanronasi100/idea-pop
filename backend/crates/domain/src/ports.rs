//! Port traits (interfaces) for infrastructure adapters.
//!
//! Concrete implementations live in `idea-pop-infra`. These traits use
//! `async_trait` so they can be stored as `dyn Trait` objects while keeping
//! async method signatures.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::{
    billing::{CheckoutResult, Plan, Subscription},
    challenge::{Challenge, ChallengeFilter},
    content::{
        Course, CourseSummary, Creator, ExploreFilter, ExploreVideo, Lesson, Page, QuickMake,
        QuickMakeFilter, StudioCount,
    },
    portfolio::{
        ChallengeIdea, ModerationContentType, ModerationItem, ModerationStatus, Project,
        ReactionCounts, ReactionType, Report, Visibility,
    },
    progress::{
        AnalyticsEvent, AttemptStatus, BadgeDefinition, ChallengeAttempt, ChildBadge,
        CycleActivityResult, XpEvent, XpSourceType,
    },
    Account, ChildProfile, Class, ConsentStatus, DomainError, ParentalConsent, RefreshSession,
    Role, TokenClaims, TokenPair,
};

#[async_trait]
pub trait AccountRepo: Send + Sync {
    async fn find_by_email(&self, email: &str) -> Result<Option<Account>, DomainError>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Account>, DomainError>;
    async fn find_by_verification_token_hash(
        &self,
        hash: &str,
    ) -> Result<Option<Account>, DomainError>;
    async fn create(&self, account: &Account) -> Result<(), DomainError>;
    async fn update(&self, account: &Account) -> Result<(), DomainError>;
    async fn create_refresh_session(&self, session: &RefreshSession) -> Result<(), DomainError>;
    async fn find_refresh_session_by_hash(
        &self,
        hash: &str,
    ) -> Result<Option<RefreshSession>, DomainError>;
    async fn revoke_refresh_session(&self, session_id: Uuid) -> Result<(), DomainError>;
    /// Shorten a session's lifetime (rotation grace tail).
    async fn expire_refresh_session(
        &self,
        session_id: Uuid,
        expires_at: chrono::DateTime<chrono::Utc>,
    ) -> Result<(), DomainError>;
}

#[async_trait]
pub trait PasswordHasher: Send + Sync {
    async fn hash(&self, password: &str) -> Result<String, DomainError>;
    async fn verify(&self, password: &str, hash: &str) -> Result<bool, DomainError>;
}

/// Issues and verifies JWTs, and manages opaque refresh-token lifecycle.
#[async_trait]
pub trait TokenIssuer: Send + Sync {
    /// Create an access + refresh token pair for an adult account.
    async fn issue(&self, account_id: Uuid, role: &Role) -> Result<TokenPair, DomainError>;
    /// Create a kid-scoped access token (no refresh token — parent revokes via consent).
    async fn issue_kid(
        &self,
        child_id: Uuid,
        parent_account_id: Uuid,
    ) -> Result<String, DomainError>;
    /// Verify an access JWT and return its decoded claims.
    async fn verify_access(&self, token: &str) -> Result<TokenClaims, DomainError>;
    /// SHA-256 hex digest of an opaque token — stored in DB, never the raw token.
    fn hash_token(&self, raw: &str) -> String;
    /// Generate a cryptographically random opaque token (hex-encoded 32 bytes).
    fn generate_opaque_token(&self) -> String;
}

// ── Child & consent ports ─────────────────────────────────────────────────────

#[async_trait]
pub trait ChildRepo: Send + Sync {
    async fn create(&self, profile: &ChildProfile) -> Result<(), DomainError>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<ChildProfile>, DomainError>;
    async fn find_by_parent(&self, parent_id: Uuid) -> Result<Vec<ChildProfile>, DomainError>;
}

#[async_trait]
pub trait ConsentRepo: Send + Sync {
    async fn create(&self, consent: &ParentalConsent) -> Result<(), DomainError>;
    async fn find_by_token_hash(&self, hash: &str) -> Result<Option<ParentalConsent>, DomainError>;
    async fn find_latest_by_child(
        &self,
        child_id: Uuid,
    ) -> Result<Option<ParentalConsent>, DomainError>;
    async fn update_status(
        &self,
        id: Uuid,
        status: ConsentStatus,
        now: DateTime<Utc>,
    ) -> Result<(), DomainError>;
}

#[async_trait]
pub trait ClassRepo: Send + Sync {
    async fn create(&self, class: &Class) -> Result<(), DomainError>;
    async fn find_by_code(&self, code: &str) -> Result<Option<Class>, DomainError>;
    /// Add child to class; returns Err(Conflict) if already a member.
    async fn add_member(&self, class_id: Uuid, child_id: Uuid) -> Result<(), DomainError>;
}

#[async_trait]
pub trait ConsentEmailSender: Send + Sync {
    async fn send_consent_request(
        &self,
        parent_email: &str,
        child_nickname: &str,
        token: &str,
    ) -> Result<(), DomainError>;
}

#[async_trait]
pub trait EmailSender: Send + Sync {
    async fn send_verification_email(
        &self,
        to: &str,
        token: &str,
        locale: &str,
    ) -> Result<(), DomainError>;
}

pub trait Clock: Send + Sync {
    fn now(&self) -> DateTime<Utc>;
}

// ── Content ports ─────────────────────────────────────────────────────────────

#[async_trait]
pub trait ExploreRepo: Send + Sync {
    async fn list(&self, filter: &ExploreFilter) -> Result<Page<ExploreVideo>, DomainError>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<ExploreVideo>, DomainError>;
}

// ── Challenge port ────────────────────────────────────────────────────────────

#[async_trait]
pub trait ChallengeRepo: Send + Sync {
    async fn list(&self, filter: &ChallengeFilter) -> Result<Page<Challenge>, DomainError>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Challenge>, DomainError>;
}

// ── Gamification ports ────────────────────────────────────────────────────────

#[async_trait]
pub trait XpRepo: Send + Sync {
    /// Returns true if an XP event already exists for this (child, source_type, source_id).
    async fn has_event(
        &self,
        child_id: Uuid,
        source_type: &XpSourceType,
        source_id: Uuid,
    ) -> Result<bool, DomainError>;
    /// Append a new XP event. The DB UNIQUE index guards against duplicates.
    async fn append_event(&self, event: &XpEvent) -> Result<(), DomainError>;
    /// Fetch all XP events for replay and total derivation.
    async fn list_events(&self, child_id: Uuid) -> Result<Vec<XpEvent>, DomainError>;
    /// Upsert the materialized progress cache (optimisation for GET /me/progress).
    async fn upsert_progress(
        &self,
        child_id: Uuid,
        xp: i32,
        level: u32,
        rank: &str,
    ) -> Result<(), DomainError>;
}

#[async_trait]
pub trait ProgressRepo: Send + Sync {
    /// Record a video view. Returns true = first view (new); false = already viewed.
    async fn record_video_view(
        &self,
        child_id: Uuid,
        video_id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<bool, DomainError>;
    async fn count_video_views(&self, child_id: Uuid) -> Result<u32, DomainError>;

    /// Record a lesson completion. Returns true = first completion; false = duplicate.
    async fn record_lesson_complete(
        &self,
        child_id: Uuid,
        lesson_id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<bool, DomainError>;
    async fn count_lesson_completions(&self, child_id: Uuid) -> Result<u32, DomainError>;

    async fn create_attempt(&self, attempt: &ChallengeAttempt) -> Result<(), DomainError>;
    async fn find_attempt(&self, id: Uuid) -> Result<Option<ChallengeAttempt>, DomainError>;
    /// The child's newest in-progress attempt for a challenge, if any —
    /// starting a mission reuses it instead of piling up duplicates.
    async fn find_in_progress_attempt(
        &self,
        child_id: Uuid,
        challenge_id: Uuid,
    ) -> Result<Option<ChallengeAttempt>, DomainError>;
    async fn update_attempt(
        &self,
        id: Uuid,
        step: i16,
        status: &AttemptStatus,
        completed_at: Option<DateTime<Utc>>,
    ) -> Result<(), DomainError>;
    async fn count_completed_challenges(&self, child_id: Uuid) -> Result<u32, DomainError>;
    /// True if this child has already completed this challenge (used for XP idempotency).
    async fn has_completed_challenge(
        &self,
        child_id: Uuid,
        challenge_id: Uuid,
    ) -> Result<bool, DomainError>;

    /// Atomically update the creative-cycle row for the given ISO week.
    /// Returns CycleCompleted(cycle_id) when all three activities are now recorded
    /// for this week and the bonus has been claimed for the first time.
    async fn update_cycle_activity(
        &self,
        child_id: Uuid,
        iso_year: i32,
        iso_week: u32,
        source: &XpSourceType,
    ) -> Result<CycleActivityResult, DomainError>;
    async fn count_completed_cycles(&self, child_id: Uuid) -> Result<u32, DomainError>;
}

#[async_trait]
pub trait BadgeRepo: Send + Sync {
    async fn all_definitions(&self) -> Result<Vec<BadgeDefinition>, DomainError>;
    async fn child_badges(&self, child_id: Uuid) -> Result<Vec<ChildBadge>, DomainError>;
    /// Award a badge to a child. Returns true = newly awarded; false = already had it.
    async fn award_badge(
        &self,
        child_id: Uuid,
        badge_id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<bool, DomainError>;
}

#[async_trait]
pub trait AnalyticsSink: Send + Sync {
    async fn emit(&self, event: &AnalyticsEvent) -> Result<(), DomainError>;
}

// ── Portfolio ports ───────────────────────────────────────────────────────────

#[async_trait]
pub trait ProjectRepo: Send + Sync {
    async fn create(&self, project: &Project) -> Result<(), DomainError>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Project>, DomainError>;
    async fn list_by_child(&self, child_id: Uuid) -> Result<Vec<Project>, DomainError>;
    /// Update both requested and effective visibility.
    async fn set_visibility(
        &self,
        id: Uuid,
        requested: &Visibility,
        effective: &Visibility,
        now: DateTime<Utc>,
    ) -> Result<(), DomainError>;
    /// Adds a stored photo's key to a project.
    async fn add_photo_key(
        &self,
        id: Uuid,
        key: &str,
        now: DateTime<Utc>,
    ) -> Result<(), DomainError>;
}

#[async_trait]
pub trait PhotoStore: Send + Sync {
    /// Returns a presigned PUT URL for a photo upload (expires_in_secs).
    async fn presign_upload(&self, key: &str, expires_in_secs: u64) -> Result<String, DomainError>;
    /// Stores a photo the server received (private; never served publicly).
    async fn put(&self, key: &str, bytes: Vec<u8>, content_type: &str) -> Result<(), DomainError>;
}

#[async_trait]
pub trait ModerationRepo: Send + Sync {
    async fn enqueue(&self, item: &ModerationItem) -> Result<(), DomainError>;
    async fn pending_queue(&self) -> Result<Vec<ModerationItem>, DomainError>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<ModerationItem>, DomainError>;
    async fn approve(
        &self,
        id: Uuid,
        reviewer_id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<Option<ModerationItem>, DomainError>;
    async fn reject(
        &self,
        id: Uuid,
        reviewer_id: Uuid,
        reason: String,
        now: DateTime<Utc>,
    ) -> Result<Option<ModerationItem>, DomainError>;
    async fn find_pending_for_content(
        &self,
        content_type: &ModerationContentType,
        content_id: Uuid,
    ) -> Result<Option<ModerationItem>, DomainError>;
}

#[async_trait]
pub trait IdeaRepo: Send + Sync {
    async fn submit(&self, idea: &ChallengeIdea) -> Result<(), DomainError>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<ChallengeIdea>, DomainError>;
    async fn list_approved(&self, challenge_id: Uuid) -> Result<Vec<ChallengeIdea>, DomainError>;
    async fn has_submitted(&self, child_id: Uuid, challenge_id: Uuid) -> Result<bool, DomainError>;
    async fn update_moderation_status(
        &self,
        id: Uuid,
        status: &ModerationStatus,
    ) -> Result<(), DomainError>;
    async fn add_reaction(
        &self,
        idea_id: Uuid,
        child_id: Uuid,
        reaction_type: &ReactionType,
    ) -> Result<(), DomainError>;
    async fn count_reactions(&self, idea_id: Uuid) -> Result<ReactionCounts, DomainError>;
}

#[async_trait]
pub trait ReportRepo: Send + Sync {
    async fn create(&self, report: &Report) -> Result<(), DomainError>;
    async fn list_pending(&self) -> Result<Vec<Report>, DomainError>;
}

// ── Library ───────────────────────────────────────────────────────────────────

#[async_trait]
pub trait LibraryRepo: Send + Sync {
    async fn list_quick_makes(
        &self,
        filter: &QuickMakeFilter,
    ) -> Result<Page<QuickMake>, DomainError>;
    async fn list_courses(&self) -> Result<Vec<CourseSummary>, DomainError>;
    async fn find_course_with_lessons(
        &self,
        id: Uuid,
    ) -> Result<Option<(Course, Vec<Lesson>)>, DomainError>;
    async fn find_creator(&self, id: Uuid) -> Result<Option<Creator>, DomainError>;
    async fn studio_counts(&self) -> Result<Vec<StudioCount>, DomainError>;
}

// ── Billing ports ─────────────────────────────────────────────────────────────

#[async_trait]
pub trait SubscriptionRepo: Send + Sync {
    async fn find_by_account(&self, account_id: Uuid) -> Result<Option<Subscription>, DomainError>;
    async fn find_by_provider_subscription(
        &self,
        provider_subscription_id: &str,
    ) -> Result<Option<Subscription>, DomainError>;
    async fn find_by_provider_customer(
        &self,
        provider_customer_id: &str,
    ) -> Result<Option<Subscription>, DomainError>;
    /// Insert or update a subscription row keyed by provider_subscription_id.
    async fn upsert(&self, sub: &Subscription) -> Result<(), DomainError>;
}

#[async_trait]
pub trait WebhookEventLog: Send + Sync {
    /// Attempt to record a webhook event. Returns Ok(true) = newly recorded;
    /// Ok(false) = already processed (duplicate); the caller should skip processing.
    async fn try_record(
        &self,
        provider_event_id: &str,
        event_type: &str,
        now: DateTime<Utc>,
    ) -> Result<bool, DomainError>;
}

#[async_trait]
pub trait PaymentGateway: Send + Sync {
    /// Create a Stripe Checkout Session for the given plan; returns the
    /// hosted URL to redirect the user to.
    async fn create_checkout_session(
        &self,
        account_id: Uuid,
        plan: &Plan,
        success_url: &str,
        cancel_url: &str,
        customer_email: Option<&str>,
    ) -> Result<CheckoutResult, DomainError>;

    /// Create a Stripe Billing Portal session; returns the hosted URL.
    async fn create_portal_session(
        &self,
        provider_customer_id: &str,
        return_url: &str,
    ) -> Result<String, DomainError>;

    /// Verify a Stripe webhook signature (HMAC-SHA256).
    /// Returns Ok(()) if valid, Err(Unauthorized) if invalid.
    fn verify_webhook_signature(
        &self,
        payload: &[u8],
        signature_header: &str,
    ) -> Result<(), DomainError>;
}

/// LLM provider for the scoped mission helper (AI-helper-spec.md).
///
/// Implementations MUST keep the API key server-side; the browser never
/// talks to the model provider. `moderate` returns `true` when the text is
/// SAFE for an 8–12 audience; implementations must fail CLOSED (unsafe)
/// when the verdict cannot be determined.
#[async_trait]
pub trait MissionHelperProvider: Send + Sync {
    /// One scoped exchange: constrained system prompt + the child's question.
    async fn answer(&self, system_prompt: &str, question: &str) -> Result<String, DomainError>;
    /// Safety classification: Ok(true) = safe, Ok(false) = block.
    async fn moderate(&self, text: &str) -> Result<bool, DomainError>;
}
