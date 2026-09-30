//! HTTP layer — Axum router, handlers, DTOs, middleware, and OpenAPI.

#![forbid(unsafe_code)]

pub mod billing;
mod error;
pub mod extractor;
pub mod portfolio;
pub mod progress;
pub mod state;

mod account;
mod auth;
pub mod challenges;
mod children;
mod classes;
mod consents;
pub mod explore;
mod help;
pub use help::purge_expired_help_messages;
pub mod library;
mod me;
mod parent;
mod teacher;

pub use error::{ApiError, ProblemDetail};
pub use state::{
    create_auth_rate_limiter, AppState, AuthRateLimiter, BillingRepos, GamificationRepos,
    HelperConfig, PortfolioRepos,
};

use std::{net::IpAddr, sync::Arc, time::Duration};

pub use metrics_exporter_prometheus;

use axum::{
    extract::{ConnectInfo, Request, State},
    http::{HeaderName, HeaderValue, StatusCode},
    middleware::{self, Next},
    response::{Html, IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use idea_pop_domain::{DomainError, GatedAction, Role};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tower_http::{
    cors::CorsLayer,
    request_id::{MakeRequestId, PropagateRequestIdLayer, RequestId, SetRequestIdLayer},
    set_header::SetResponseHeaderLayer,
    trace::TraceLayer,
};
use utoipa::{OpenApi, ToSchema};
use uuid::Uuid;

use crate::{
    account::{EmailPreferencesResponse, UpdateEmailPreferencesRequest},
    auth::{
        AuthResponse, LoginRequest, RefreshRequest, RegisterRequest, TokenResponse,
        VerifyEmailRequest,
    },
    challenges::{
        AgeTierVariantResponse, ChallengePageResponse, ChallengeResponse, NatureClueResponse,
        ToolResponse,
    },
    children::{
        ChildLoginRequest, ChildLoginResponse, CreateChildRequest, CreateChildResponse,
        UpgradeRequestResponse,
    },
    classes::{
        ClassLoginRequest, ClassLoginResponse, ClassRosterItem, CreateClassRequest,
        CreateClassResponse, JoinClassResponse,
    },
    explore::{ExplorePageResponse, ExploreVideoResponse},
    help::{
        HelpMessageResponse, HelpRequest, HelpResponse, HelperEnabledResponse,
        UpdateHelperEnabledRequest,
    },
    library::{
        CourseDetailResponse, CourseSummaryResponse, CreatorResponse, LessonResponse,
        QuickMakePageResponse, QuickMakeResponse, StudioCountResponse,
    },
    me::{ClassMissionResponse, MeResponse},
    parent::{
        ChildReportResponse, DisplayModeResponse, ParentApprovalResponse, ParentChildResponse,
        ParentProjectSummary, ResetChildPinResponse, ResolveApprovalRequest,
        ResolveApprovalResponse, UpdateDisplayModeRequest,
    },
    portfolio::{
        CreateProjectRequest, CreateReportRequest, IdeaListResponse, IdeaResponse,
        ModerationItemResponse, ModerationQueueResponse, PresignResponse, ProjectListResponse,
        ProjectResponse, ReactRequest, ReactionCountsDto, RejectRequest, RemixRequest,
        ReportListResponse, ReportResponse, SubmitIdeaRequest, UpdateVisibilityRequest,
        UpdateVisibilityResponse,
    },
    progress::{
        AdvanceStepRequest, AdvanceStepResponse, BadgeResponse, LessonCompleteRequest,
        MedalsResponse, ProgressResponse, StartAttemptResponse, VideoViewRequest, XpAwardResponse,
    },
    teacher::{
        AssignMissionRequest, ClassGalleryItemResponse, ClassReportQuery, ClassReportResponse,
        ClassReportStudent, ClassReportSummary, CreateStudentRequest, CreateStudentResponse,
        ResetPinResponse, StudentRosterItem, TeacherClassResponse,
    },
};

// ── Request-ID ────────────────────────────────────────────────────────────────

#[derive(Clone)]
struct MakeRequestUuid;

impl MakeRequestId for MakeRequestUuid {
    fn make_request_id<B>(&mut self, _req: &axum::http::Request<B>) -> Option<RequestId> {
        let id = Uuid::new_v4().to_string();
        HeaderValue::from_str(&id).ok().map(RequestId::new)
    }
}

// ── Request metrics middleware ────────────────────────────────────────────────

/// Records `http_requests_total` (counter) and `http_request_duration_seconds`
/// (histogram) for every request.  Labels: method, path pattern, status.
async fn metrics_middleware(req: Request, next: Next) -> Response {
    let method = req.method().as_str().to_owned();
    // Use a coarse path (first two segments) to avoid high cardinality.
    let path = {
        let p = req.uri().path();
        let parts: Vec<&str> = p.splitn(4, '/').collect();
        parts[..parts.len().min(3)].join("/")
    };
    let start = std::time::Instant::now();
    let res = next.run(req).await;
    let elapsed = start.elapsed().as_secs_f64();
    let status = res.status().as_u16().to_string();
    metrics::counter!("http_requests_total", "method" => method.clone(), "path" => path.clone(), "status" => status.clone()).increment(1);
    metrics::histogram!("http_request_duration_seconds", "method" => method, "path" => path, "status" => status).record(elapsed);
    res
}

// ── Timeout ───────────────────────────────────────────────────────────────────

async fn timeout_middleware(req: Request, next: Next) -> Response {
    match tokio::time::timeout(Duration::from_secs(30), next.run(req)).await {
        Ok(res) => res,
        Err(_) => StatusCode::REQUEST_TIMEOUT.into_response(),
    }
}

// ── Consent-gating middleware ─────────────────────────────────────────────────

/// Middleware that blocks RESTRICTED children from gated routes.
///
/// Applied to route groups that contain sharing/social/extra-data endpoints.
/// Kid tokens with Pending or Revoked consent receive 403; all adult tokens
/// and Granted/ClassGranted kids pass through.
async fn consent_gate(
    tokens: Arc<dyn idea_pop_domain::TokenIssuer>,
    consent: Arc<idea_pop_domain::ConsentService>,
    req: Request,
    next: Next,
) -> Response {
    use crate::error::problem;

    let bearer = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "));

    // Not authenticated or not a kid → let the handler decide.
    let Some(raw) = bearer else {
        return next.run(req).await;
    };
    let Ok(claims) = tokens.verify_access(raw).await else {
        return next.run(req).await;
    };

    if claims.role == Role::Kid {
        let Some(child_id) = claims.child_id else {
            return problem(
                StatusCode::FORBIDDEN,
                "consent-required",
                "Parental consent required",
            );
        };
        match consent.check_gate(child_id, &GatedAction::Share).await {
            Ok(()) => {}
            Err(DomainError::Forbidden(_)) => {
                return problem(
                    StatusCode::FORBIDDEN,
                    "consent-required",
                    "Parental consent is required before sharing or social features can be used",
                );
            }
            Err(_) => {}
        }
    }

    next.run(req).await
}

// ── Health-log DTOs (Phase 1) ─────────────────────────────────────────────────

#[derive(Debug, Serialize, ToSchema)]
pub struct Health {
    pub status: String,
    pub service: String,
}

#[derive(Debug, Serialize, sqlx::FromRow, ToSchema)]
pub struct HealthLogEntry {
    pub id: Uuid,
    pub message: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateHealthLogRequest {
    pub message: String,
}

// ── OpenAPI ───────────────────────────────────────────────────────────────────

#[derive(OpenApi)]
#[openapi(
    paths(
        health, readyz, example_gated_share,
        create_health_log, list_health_log,
        auth::register, auth::login, auth::refresh, auth::logout, auth::verify_email,
        me::me, me::class_mission,
        account::get_email_preferences, account::put_email_preferences,
        children::create_child, children::child_login, children::request_premium_unlock,
        parent::list_children, parent::reset_child_pin, parent::child_report,
        parent::set_display_mode, parent::list_approvals,
        parent::approve_approval, parent::dismiss_approval,
        consents::grant_consent, consents::revoke_consent,
        consents::grant_consent_in_app, consents::revoke_consent_in_app,
        classes::create_class, classes::join_class,
        classes::class_roster, classes::class_login,
        teacher::get_class, teacher::assign_mission, teacher::class_gallery,
        teacher::create_student, teacher::list_students, teacher::reset_student_pin,
        teacher::class_report, teacher::class_report_csv,
        explore::list_explore, explore::get_explore,
        library::list_studios, library::list_courses, library::list_quick_makes,
        library::get_course, library::get_creator,
        challenges::list_challenges, challenges::get_challenge,
        help::ask_helper, help::parent_help_messages,
        help::teacher_help_messages, help::set_helper_enabled,
        progress::post_video_view, progress::post_lesson_complete,
        progress::start_attempt, progress::advance_step,
        progress::get_me_progress,
        portfolio::create_project, portfolio::list_my_projects,
        portfolio::presign_photo_upload, portfolio::update_project_visibility,
        portfolio::submit_idea, portfolio::list_ideas,
        portfolio::react_to_idea, portfolio::remix_idea,
        portfolio::list_moderation_queue, portfolio::approve_item, portfolio::reject_item,
        portfolio::create_report, portfolio::list_reports,
    ),
    components(schemas(
        Health, HealthLogEntry, CreateHealthLogRequest, ProblemDetail,
        RegisterRequest, LoginRequest, RefreshRequest, VerifyEmailRequest,
        AuthResponse, TokenResponse, MeResponse, ClassMissionResponse,
        EmailPreferencesResponse, UpdateEmailPreferencesRequest,
        CreateChildRequest, CreateChildResponse, UpgradeRequestResponse,
        ChildLoginRequest, ChildLoginResponse, ResetChildPinResponse,
        ParentChildResponse, ChildReportResponse, ParentProjectSummary,
        UpdateDisplayModeRequest, DisplayModeResponse,
        ParentApprovalResponse, ResolveApprovalRequest, ResolveApprovalResponse,
        CreateClassRequest, CreateClassResponse, JoinClassResponse,
        ClassRosterItem, ClassLoginRequest, ClassLoginResponse,
        CreateStudentRequest, CreateStudentResponse, StudentRosterItem, ResetPinResponse,
        ClassReportResponse, ClassReportSummary, ClassReportStudent, ClassReportQuery,
        consents::ConsentToggleRequest,
        TeacherClassResponse, ClassGalleryItemResponse, AssignMissionRequest,
        ExploreVideoResponse, ExplorePageResponse,
        StudioCountResponse, CourseSummaryResponse, QuickMakeResponse, QuickMakePageResponse,
        LessonResponse, CourseDetailResponse, CreatorResponse,
        ChallengeResponse, ChallengePageResponse, AgeTierVariantResponse, ToolResponse,
        NatureClueResponse,
        HelpRequest, HelpResponse, HelpMessageResponse,
        UpdateHelperEnabledRequest, HelperEnabledResponse,
        VideoViewRequest, LessonCompleteRequest, XpAwardResponse,
        StartAttemptResponse, AdvanceStepRequest, AdvanceStepResponse,
        ProgressResponse, MedalsResponse, BadgeResponse,
        CreateProjectRequest, ProjectResponse, ProjectListResponse,
        PresignResponse, UpdateVisibilityRequest, UpdateVisibilityResponse,
        SubmitIdeaRequest, IdeaResponse, IdeaListResponse, ReactionCountsDto,
        ReactRequest, RemixRequest,
        ModerationItemResponse, ModerationQueueResponse, RejectRequest,
        CreateReportRequest, ReportResponse, ReportListResponse,
    )),
    tags(
        (name = "ops",       description = "Operational endpoints"),
        (name = "health-log", description = "Phase 1 pipeline-validation resource"),
        (name = "auth",      description = "Authentication"),
        (name = "accounts",  description = "Account management"),
        (name = "children",  description = "Child profiles (COPPA)"),
        (name = "consents",  description = "Parental consent grant/revoke"),
        (name = "classes",   description = "Classroom management"),
        (name = "explore",     description = "Explore section — nature videos"),
        (name = "library",     description = "Library section — courses, quick-makes, creators"),
        (name = "challenges",  description = "Challenge engine — data-driven 8-step missions"),
        (name = "progress",    description = "Progress & gamification — kid-owned XP and badges"),
        (name = "portfolio",   description = "Portfolio — child projects and photo uploads"),
        (name = "moderation",  description = "Moderation queue, reports (reviewer/admin only for queue/reports)"),
    ),
    info(
        title = "Idea Pop API",
        description = "Backend API for the Idea Pop kids learning platform.",
        version = "0.1.0",
    )
)]
pub struct ApiDoc;

// ── Handlers ─────────────────────────────────────────────────────────────────

#[utoipa::path(get, path = "/health", tag = "ops",
    responses((status = 200, description = "Healthy", body = Health)))]
async fn health() -> Json<Health> {
    Json(Health {
        status: "ok".to_owned(),
        service: "idea-pop-api".to_owned(),
    })
}

#[utoipa::path(get, path = "/readyz", tag = "ops",
    responses((status = 200, description = "Ready")))]
async fn readyz() -> &'static str {
    "ready"
}

async fn openapi_json() -> Json<serde_json::Value> {
    Json(serde_json::to_value(ApiDoc::openapi()).expect("openapi serialize"))
}

async fn swagger_ui() -> Html<&'static str> {
    Html(
        r##"<!DOCTYPE html>
<html>
  <head>
    <title>Idea Pop API — Docs</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css">
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => SwaggerUIBundle({
        url: "/api-docs/openapi.json",
        dom_id: "#swagger-ui",
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: "BaseLayout",
      });
    </script>
  </body>
</html>"##,
    )
}

#[utoipa::path(post, path = "/api/health-log", tag = "health-log",
    request_body = CreateHealthLogRequest,
    responses(
        (status = 201, description = "Created", body = HealthLogEntry),
        (status = 422, description = "Validation error", body = ProblemDetail),
    ))]
async fn create_health_log(
    State(state): State<AppState>,
    Json(body): Json<CreateHealthLogRequest>,
) -> Result<(StatusCode, Json<HealthLogEntry>), ApiError> {
    if body.message.trim().is_empty() {
        return Err(ApiError::Domain(DomainError::Validation(
            "message must not be blank".into(),
        )));
    }
    let entry = sqlx::query_as!(
        HealthLogEntry,
        r#"INSERT INTO health_log (message) VALUES ($1) RETURNING id, message, created_at"#,
        body.message,
    )
    .fetch_one(&state.db)
    .await?;
    Ok((StatusCode::CREATED, Json(entry)))
}

#[utoipa::path(get, path = "/api/health-log", tag = "health-log",
    responses((status = 200, description = "Success", body = [HealthLogEntry])))]
async fn list_health_log(
    State(state): State<AppState>,
) -> Result<Json<Vec<HealthLogEntry>>, ApiError> {
    let entries = sqlx::query_as!(
        HealthLogEntry,
        r#"SELECT id, message, created_at FROM health_log ORDER BY created_at DESC LIMIT 20"#,
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(entries))
}

/// Example gated sharing route — blocked for RESTRICTED children.
#[utoipa::path(get, path = "/api/my-shares", tag = "children",
    responses(
        (status = 200, description = "Allowed (consent granted)"),
        (status = 403, description = "Blocked — parental consent required", body = ProblemDetail),
    ))]
async fn example_gated_share() -> &'static str {
    "sharing allowed"
}

// ── Router ────────────────────────────────────────────────────────────────────

/// Build the application router.
///
/// `metrics_handle` is `Some` in production (passed from server startup after
/// installing the Prometheus recorder); `None` in tests (metrics are no-ops).
pub fn router(state: AppState, rate_limiter: Option<Arc<AuthRateLimiter>>) -> Router {
    router_with_metrics(state, rate_limiter, None)
}

pub fn router_with_metrics(
    state: AppState,
    rate_limiter: Option<Arc<AuthRateLimiter>>,
    metrics_handle: Option<metrics_exporter_prometheus::PrometheusHandle>,
) -> Router {
    let x_req_id = HeaderName::from_static("x-request-id");

    let auth_routes = {
        let r = Router::new()
            .route("/auth/register", post(auth::register))
            .route("/auth/login", post(auth::login))
            .route("/auth/refresh", post(auth::refresh))
            .route("/auth/logout", post(auth::logout))
            .route("/auth/verify-email", post(auth::verify_email))
            .with_state(state.clone());
        if let Some(limiter) = rate_limiter {
            r.layer(middleware::from_fn(move |req: Request, next: Next| {
                let lim = Arc::clone(&limiter);
                async move {
                    let ip: IpAddr = req
                        .extensions()
                        .get::<ConnectInfo<std::net::SocketAddr>>()
                        .map(|ci| ci.0.ip())
                        .unwrap_or(IpAddr::from([127, 0, 0, 1]));
                    if lim.check_key(&ip).is_err() {
                        return (StatusCode::TOO_MANY_REQUESTS, "rate limit exceeded")
                            .into_response();
                    }
                    next.run(req).await
                }
            }))
        } else {
            r
        }
    };

    // Consent-gated routes: blocked for RESTRICTED children.
    // Use route_layer (not layer) so the middleware stays scoped to only
    // these routes after Router::merge; layer() would wrap the entire merged
    // service and leak the gate to unrelated routes like /classes/{code}/join.
    let tokens_cap = Arc::clone(&state.tokens);
    let consent_cap = Arc::clone(&state.consent);
    let gated_routes = Router::new()
        .route("/api/my-shares", get(example_gated_share))
        // Sharing requires active parental consent for kid accounts
        .route(
            "/projects/:id/visibility",
            axum::routing::patch(portfolio::update_project_visibility),
        )
        .route("/challenges/:id/ideas", post(portfolio::submit_idea))
        .route("/ideas/:id/remix", post(portfolio::remix_idea))
        .route_layer(middleware::from_fn(move |req: Request, next: Next| {
            let tokens = Arc::clone(&tokens_cap);
            let consent = Arc::clone(&consent_cap);
            async move { consent_gate(tokens, consent, req, next).await }
        }))
        .with_state(state.clone());

    // /metrics endpoint — renders Prometheus text if handle is available.
    let metrics_router = if let Some(handle) = metrics_handle {
        Router::new().route(
            "/metrics",
            get(move || {
                let h = handle.clone();
                async move {
                    axum::response::Response::builder()
                        .header("content-type", "text/plain; version=0.0.4; charset=utf-8")
                        .body(axum::body::Body::from(h.render()))
                        .unwrap()
                }
            }),
        )
    } else {
        Router::new()
    };

    // Security headers applied to every response.
    let security_headers = tower::ServiceBuilder::new()
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::HeaderName::from_static("x-frame-options"),
            HeaderValue::from_static("DENY"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::HeaderName::from_static("x-content-type-options"),
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::HeaderName::from_static("x-xss-protection"),
            HeaderValue::from_static("0"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::HeaderName::from_static("permissions-policy"),
            HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
        ));

    Router::new()
        .route("/health", get(health))
        .route("/readyz", get(readyz))
        .route("/docs", get(swagger_ui))
        .route("/api-docs/openapi.json", get(openapi_json))
        .route(
            "/api/health-log",
            post(create_health_log).get(list_health_log),
        )
        .route("/me", get(me::me))
        .route("/me/class-mission", get(me::class_mission))
        // Account settings — adult-only (AdultAuth rejects kid tokens)
        .route(
            "/account/email-preferences",
            get(account::get_email_preferences).put(account::put_email_preferences),
        )
        // Child profiles & consent
        .route("/children", post(children::create_child))
        .route("/children/login", post(children::child_login))
        // Kid asks parent to unlock premium (kid-scoped; NO billing capability)
        .route(
            "/me/upgrade-request",
            post(children::request_premium_unlock),
        )
        .route("/parent/children", get(parent::list_children))
        .route(
            "/parent/children/:id/reset-pin",
            post(parent::reset_child_pin),
        )
        .route("/parent/children/:id/report", get(parent::child_report))
        .route(
            "/parent/children/:id/display-mode",
            axum::routing::put(parent::set_display_mode),
        )
        // "Needs your OK" queue (adult-only via AdultAuth)
        .route("/parent/approvals", get(parent::list_approvals))
        .route(
            "/parent/approvals/:id/approve",
            post(parent::approve_approval),
        )
        .route(
            "/parent/approvals/:id/dismiss",
            post(parent::dismiss_approval),
        )
        // In-app parent toggles (static segments — no clash with :token/:child_id)
        .route("/consents/grant", post(consents::grant_consent_in_app))
        .route("/consents/revoke", post(consents::revoke_consent_in_app))
        .route("/consents/:token/grant", post(consents::grant_consent))
        .route("/consents/:child_id/revoke", post(consents::revoke_consent))
        // Classes
        .route("/classes", post(classes::create_class))
        .route("/classes/:code/join", post(classes::join_class))
        // Kid PIN login for teacher-created students (public — kid isn't signed in yet)
        .route("/classes/:code/roster", get(classes::class_roster))
        .route("/classes/:code/login", post(classes::class_login))
        // Teacher class dashboard
        .route("/teacher/class", get(teacher::get_class))
        .route("/teacher/class/assign", post(teacher::assign_mission))
        .route("/teacher/class/gallery", get(teacher::class_gallery))
        .route(
            "/teacher/class/students",
            get(teacher::list_students).post(teacher::create_student),
        )
        .route(
            "/teacher/class/students/:id/reset-pin",
            post(teacher::reset_student_pin),
        )
        .route("/teacher/class/report", get(teacher::class_report))
        .route("/teacher/class/report.csv", get(teacher::class_report_csv))
        // Explore (any authenticated principal; restricted kids CAN read)
        .route("/explore", get(explore::list_explore))
        .route("/explore/:id", get(explore::get_explore))
        // Library (any authenticated principal; restricted kids CAN read)
        .route("/library/studios", get(library::list_studios))
        .route("/library/courses", get(library::list_courses))
        .route("/library/quick-makes", get(library::list_quick_makes))
        .route("/courses/:id", get(library::get_course))
        .route("/creators/:id", get(library::get_creator))
        // Challenges (any authenticated principal; restricted kids CAN read)
        .route("/challenges", get(challenges::list_challenges))
        .route("/challenges/:id", get(challenges::get_challenge))
        // Scoped AI mission helper (kid-scoped; flag+consent+opt-in gated)
        .route("/challenges/:id/steps/:step/help", post(help::ask_helper))
        .route(
            "/parent/children/:id/help-messages",
            get(help::parent_help_messages),
        )
        .route(
            "/parent/children/:id/helper",
            axum::routing::put(help::set_helper_enabled),
        )
        .route("/teacher/help-messages", get(help::teacher_help_messages))
        // Progress (kid-scoped tokens only — child_id derived from JWT)
        .route("/progress/video-view", post(progress::post_video_view))
        .route(
            "/progress/lesson-complete",
            post(progress::post_lesson_complete),
        )
        .route("/challenges/:id/attempts", post(progress::start_attempt))
        .route(
            "/attempts/:id/step",
            axum::routing::patch(progress::advance_step),
        )
        .route("/me/progress", get(progress::get_me_progress))
        // Portfolio (kid-owned; child_id from JWT)
        .route("/projects", post(portfolio::create_project))
        .route("/me/projects", get(portfolio::list_my_projects))
        .route(
            "/projects/:id/photos/presign",
            post(portfolio::presign_photo_upload),
        )
        // Moderation queue & reports (reviewer-only reads; any-auth writes)
        .route("/moderation/queue", get(portfolio::list_moderation_queue))
        .route("/moderation/:id/approve", post(portfolio::approve_item))
        .route("/moderation/:id/reject", post(portfolio::reject_item))
        .route(
            "/reports",
            post(portfolio::create_report).get(portfolio::list_reports),
        )
        // Ideas Wall — GET is any-auth; locked-until-submit for kids
        .route("/challenges/:id/ideas", get(portfolio::list_ideas))
        // React to an idea (kid-owned)
        .route("/ideas/:id/react", post(portfolio::react_to_idea))
        // Billing — adult-only (AdultAuth extractor rejects kid tokens)
        .route("/billing/checkout", post(billing::create_checkout))
        .route("/billing/portal", post(billing::create_portal))
        .route("/billing/subscription", get(billing::get_subscription))
        .route("/billing/premium-check", get(billing::premium_check))
        // Stripe webhook — NO auth, raw body
        .route("/webhooks/stripe", post(billing::stripe_webhook))
        .with_state(state)
        .merge(auth_routes)
        .merge(gated_routes)
        .merge(metrics_router)
        .layer(middleware::from_fn(metrics_middleware))
        .layer(middleware::from_fn(timeout_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(PropagateRequestIdLayer::new(x_req_id.clone()))
        .layer(SetRequestIdLayer::new(x_req_id, MakeRequestUuid))
        .layer(CorsLayer::permissive())
        .layer(security_headers)
}

// ── Null adapters for tests that only need the health-log routes ──────────────

use async_trait::async_trait;
use idea_pop_domain::{
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
    Account, AccountRepo, AnalyticsSink, BadgeRepo, ChallengeRepo, ChildProfile, ChildRepo, Class,
    ClassRepo, Clock, ConsentEmailSender, ConsentRepo, ConsentStatus, EmailSender, ExploreRepo,
    IdeaRepo, LibraryRepo, ModerationRepo, ParentalConsent, PasswordHasher, PaymentGateway,
    PhotoStore, ProgressRepo, ProjectRepo, RefreshSession, ReportRepo, SubscriptionRepo,
    TokenClaims, TokenIssuer, TokenPair, WebhookEventLog, XpRepo,
};

pub struct NullRepo;
#[async_trait]
impl AccountRepo for NullRepo {
    async fn find_by_email(&self, _: &str) -> Result<Option<Account>, DomainError> {
        Ok(None)
    }
    async fn find_by_id(&self, _: Uuid) -> Result<Option<Account>, DomainError> {
        Ok(None)
    }
    async fn find_by_verification_token_hash(
        &self,
        _: &str,
    ) -> Result<Option<Account>, DomainError> {
        Ok(None)
    }
    async fn create(&self, _: &Account) -> Result<(), DomainError> {
        Ok(())
    }
    async fn update(&self, _: &Account) -> Result<(), DomainError> {
        Ok(())
    }
    async fn create_refresh_session(&self, _: &RefreshSession) -> Result<(), DomainError> {
        Ok(())
    }
    async fn find_refresh_session_by_hash(
        &self,
        _: &str,
    ) -> Result<Option<RefreshSession>, DomainError> {
        Ok(None)
    }
    async fn revoke_refresh_session(&self, _: Uuid) -> Result<(), DomainError> {
        Ok(())
    }
    async fn expire_refresh_session(&self, _: Uuid, _: DateTime<Utc>) -> Result<(), DomainError> {
        Ok(())
    }
}

pub struct NullHasher;
#[async_trait]
impl PasswordHasher for NullHasher {
    async fn hash(&self, p: &str) -> Result<String, DomainError> {
        Ok(p.into())
    }
    async fn verify(&self, _: &str, _: &str) -> Result<bool, DomainError> {
        Ok(false)
    }
}

pub struct NullTokens;
#[async_trait]
impl TokenIssuer for NullTokens {
    async fn issue(&self, _: Uuid, _: &Role) -> Result<TokenPair, DomainError> {
        Err(DomainError::Internal("null tokens".into()))
    }
    async fn issue_kid(&self, _: Uuid, _: Uuid) -> Result<String, DomainError> {
        Err(DomainError::Internal("null tokens".into()))
    }
    async fn verify_access(&self, _: &str) -> Result<TokenClaims, DomainError> {
        Err(DomainError::Unauthorized("null tokens".into()))
    }
    fn hash_token(&self, raw: &str) -> String {
        raw.into()
    }
    fn generate_opaque_token(&self) -> String {
        "null".into()
    }
}

pub struct NullEmail;
#[async_trait]
impl EmailSender for NullEmail {
    async fn send_verification_email(&self, _: &str, _: &str, _: &str) -> Result<(), DomainError> {
        Ok(())
    }
}

pub struct NullConsentEmail;
#[async_trait]
impl ConsentEmailSender for NullConsentEmail {
    async fn send_consent_request(&self, _: &str, _: &str, _: &str) -> Result<(), DomainError> {
        Ok(())
    }
}

pub struct NullChildRepo;
#[async_trait]
impl ChildRepo for NullChildRepo {
    async fn create(&self, _: &ChildProfile) -> Result<(), DomainError> {
        Ok(())
    }
    async fn find_by_id(&self, _: Uuid) -> Result<Option<ChildProfile>, DomainError> {
        Ok(None)
    }
    async fn find_by_parent(&self, _: Uuid) -> Result<Vec<ChildProfile>, DomainError> {
        Ok(vec![])
    }
}

pub struct NullConsentRepo;
#[async_trait]
impl ConsentRepo for NullConsentRepo {
    async fn create(&self, _: &ParentalConsent) -> Result<(), DomainError> {
        Ok(())
    }
    async fn find_by_token_hash(&self, _: &str) -> Result<Option<ParentalConsent>, DomainError> {
        Ok(None)
    }
    async fn find_latest_by_child(&self, _: Uuid) -> Result<Option<ParentalConsent>, DomainError> {
        Ok(None)
    }
    async fn update_status(
        &self,
        _: Uuid,
        _: ConsentStatus,
        _: DateTime<Utc>,
    ) -> Result<(), DomainError> {
        Ok(())
    }
}

pub struct NullClassRepo;
#[async_trait]
impl ClassRepo for NullClassRepo {
    async fn create(&self, _: &Class) -> Result<(), DomainError> {
        Ok(())
    }
    async fn find_by_code(&self, _: &str) -> Result<Option<Class>, DomainError> {
        Ok(None)
    }
    async fn add_member(&self, _: Uuid, _: Uuid) -> Result<(), DomainError> {
        Ok(())
    }
}

pub struct NullClock;
impl Clock for NullClock {
    fn now(&self) -> DateTime<Utc> {
        Utc::now()
    }
}

pub struct NullExploreRepo;
#[async_trait]
impl ExploreRepo for NullExploreRepo {
    async fn list(&self, f: &ExploreFilter) -> Result<Page<ExploreVideo>, DomainError> {
        Ok(Page::new(vec![], 0, f.page, f.per_page))
    }
    async fn find_by_id(&self, _: Uuid) -> Result<Option<ExploreVideo>, DomainError> {
        Ok(None)
    }
}

pub struct NullLibraryRepo;
#[async_trait]
impl LibraryRepo for NullLibraryRepo {
    async fn list_quick_makes(&self, f: &QuickMakeFilter) -> Result<Page<QuickMake>, DomainError> {
        Ok(Page::new(vec![], 0, f.page, f.per_page))
    }
    async fn list_courses(&self) -> Result<Vec<CourseSummary>, DomainError> {
        Ok(vec![])
    }
    async fn find_course_with_lessons(
        &self,
        _: Uuid,
    ) -> Result<Option<(Course, Vec<Lesson>)>, DomainError> {
        Ok(None)
    }
    async fn find_creator(&self, _: Uuid) -> Result<Option<Creator>, DomainError> {
        Ok(None)
    }
    async fn studio_counts(&self) -> Result<Vec<StudioCount>, DomainError> {
        Ok(vec![])
    }
}

pub struct NullChallengeRepo;
#[async_trait]
impl ChallengeRepo for NullChallengeRepo {
    async fn list(&self, f: &ChallengeFilter) -> Result<Page<Challenge>, DomainError> {
        Ok(Page::new(vec![], 0, f.page, f.per_page))
    }
    async fn find_by_id(&self, _: Uuid) -> Result<Option<Challenge>, DomainError> {
        Ok(None)
    }
}

pub struct NullXpRepo;
#[async_trait]
impl XpRepo for NullXpRepo {
    async fn has_event(&self, _: Uuid, _: &XpSourceType, _: Uuid) -> Result<bool, DomainError> {
        Ok(false)
    }
    async fn append_event(&self, _: &XpEvent) -> Result<(), DomainError> {
        Ok(())
    }
    async fn list_events(&self, _: Uuid) -> Result<Vec<XpEvent>, DomainError> {
        Ok(vec![])
    }
    async fn upsert_progress(&self, _: Uuid, _: i32, _: u32, _: &str) -> Result<(), DomainError> {
        Ok(())
    }
}

pub struct NullProgressRepo;
#[async_trait]
impl ProgressRepo for NullProgressRepo {
    async fn record_video_view(
        &self,
        _: Uuid,
        _: Uuid,
        _: DateTime<Utc>,
    ) -> Result<bool, DomainError> {
        Ok(true)
    }
    async fn count_video_views(&self, _: Uuid) -> Result<u32, DomainError> {
        Ok(0)
    }
    async fn record_lesson_complete(
        &self,
        _: Uuid,
        _: Uuid,
        _: DateTime<Utc>,
    ) -> Result<bool, DomainError> {
        Ok(true)
    }
    async fn count_lesson_completions(&self, _: Uuid) -> Result<u32, DomainError> {
        Ok(0)
    }
    async fn create_attempt(&self, _: &ChallengeAttempt) -> Result<(), DomainError> {
        Ok(())
    }
    async fn find_attempt(&self, _: Uuid) -> Result<Option<ChallengeAttempt>, DomainError> {
        Ok(None)
    }
    async fn find_in_progress_attempt(
        &self,
        _: Uuid,
        _: Uuid,
    ) -> Result<Option<ChallengeAttempt>, DomainError> {
        Ok(None)
    }
    async fn update_attempt(
        &self,
        _: Uuid,
        _: i16,
        _: &AttemptStatus,
        _: Option<DateTime<Utc>>,
    ) -> Result<(), DomainError> {
        Ok(())
    }
    async fn count_completed_challenges(&self, _: Uuid) -> Result<u32, DomainError> {
        Ok(0)
    }
    async fn has_completed_challenge(&self, _: Uuid, _: Uuid) -> Result<bool, DomainError> {
        Ok(false)
    }
    async fn update_cycle_activity(
        &self,
        _: Uuid,
        _: i32,
        _: u32,
        _: &XpSourceType,
    ) -> Result<CycleActivityResult, DomainError> {
        Ok(CycleActivityResult::ActivityRecorded)
    }
    async fn count_completed_cycles(&self, _: Uuid) -> Result<u32, DomainError> {
        Ok(0)
    }
}

pub struct NullBadgeRepo;
#[async_trait]
impl BadgeRepo for NullBadgeRepo {
    async fn all_definitions(&self) -> Result<Vec<BadgeDefinition>, DomainError> {
        Ok(vec![])
    }
    async fn child_badges(&self, _: Uuid) -> Result<Vec<ChildBadge>, DomainError> {
        Ok(vec![])
    }
    async fn award_badge(&self, _: Uuid, _: Uuid, _: DateTime<Utc>) -> Result<bool, DomainError> {
        Ok(false)
    }
}

pub struct NullAnalyticsSink;
#[async_trait]
impl AnalyticsSink for NullAnalyticsSink {
    async fn emit(&self, _: &AnalyticsEvent) -> Result<(), DomainError> {
        Ok(())
    }
}

/// Convenience: all-null gamification repos for tests that don't exercise progress.
pub fn null_gamification() -> GamificationRepos {
    GamificationRepos {
        xp: Arc::new(NullXpRepo),
        progress: Arc::new(NullProgressRepo),
        badges: Arc::new(NullBadgeRepo),
        analytics: Arc::new(NullAnalyticsSink),
    }
}

// ── Null portfolio adapters ───────────────────────────────────────────────────

pub struct NullProjectRepo;
#[async_trait]
impl ProjectRepo for NullProjectRepo {
    async fn create(&self, _: &Project) -> Result<(), DomainError> {
        Ok(())
    }
    async fn find_by_id(&self, _: Uuid) -> Result<Option<Project>, DomainError> {
        Ok(None)
    }
    async fn list_by_child(&self, _: Uuid) -> Result<Vec<Project>, DomainError> {
        Ok(vec![])
    }
    async fn set_visibility(
        &self,
        _: Uuid,
        _: &Visibility,
        _: &Visibility,
        _: DateTime<Utc>,
    ) -> Result<(), DomainError> {
        Ok(())
    }
}

pub struct NullPhotoStore;
#[async_trait]
impl PhotoStore for NullPhotoStore {
    async fn presign_upload(&self, key: &str, _: u64) -> Result<String, DomainError> {
        Ok(format!("https://null-storage.test/{key}"))
    }
}

pub struct NullModerationRepo;
#[async_trait]
impl ModerationRepo for NullModerationRepo {
    async fn enqueue(&self, _: &ModerationItem) -> Result<(), DomainError> {
        Ok(())
    }
    async fn pending_queue(&self) -> Result<Vec<ModerationItem>, DomainError> {
        Ok(vec![])
    }
    async fn find_by_id(&self, _: Uuid) -> Result<Option<ModerationItem>, DomainError> {
        Ok(None)
    }
    async fn approve(
        &self,
        _: Uuid,
        _: Uuid,
        _: DateTime<Utc>,
    ) -> Result<Option<ModerationItem>, DomainError> {
        Ok(None)
    }
    async fn reject(
        &self,
        _: Uuid,
        _: Uuid,
        _: String,
        _: DateTime<Utc>,
    ) -> Result<Option<ModerationItem>, DomainError> {
        Ok(None)
    }
    async fn find_pending_for_content(
        &self,
        _: &ModerationContentType,
        _: Uuid,
    ) -> Result<Option<ModerationItem>, DomainError> {
        Ok(None)
    }
}

pub struct NullIdeaRepo;
#[async_trait]
impl IdeaRepo for NullIdeaRepo {
    async fn submit(&self, _: &ChallengeIdea) -> Result<(), DomainError> {
        Ok(())
    }
    async fn find_by_id(&self, _: Uuid) -> Result<Option<ChallengeIdea>, DomainError> {
        Ok(None)
    }
    async fn list_approved(&self, _: Uuid) -> Result<Vec<ChallengeIdea>, DomainError> {
        Ok(vec![])
    }
    async fn has_submitted(&self, _: Uuid, _: Uuid) -> Result<bool, DomainError> {
        Ok(false)
    }
    async fn update_moderation_status(
        &self,
        _: Uuid,
        _: &ModerationStatus,
    ) -> Result<(), DomainError> {
        Ok(())
    }
    async fn add_reaction(&self, _: Uuid, _: Uuid, _: &ReactionType) -> Result<(), DomainError> {
        Ok(())
    }
    async fn count_reactions(&self, _: Uuid) -> Result<ReactionCounts, DomainError> {
        Ok(ReactionCounts::default())
    }
}

pub struct NullReportRepo;
#[async_trait]
impl ReportRepo for NullReportRepo {
    async fn create(&self, _: &Report) -> Result<(), DomainError> {
        Ok(())
    }
    async fn list_pending(&self) -> Result<Vec<Report>, DomainError> {
        Ok(vec![])
    }
}

/// Convenience: all-null portfolio repos for tests that don't exercise portfolio.
pub fn null_portfolio() -> PortfolioRepos {
    PortfolioRepos {
        projects: Arc::new(NullProjectRepo),
        photos: Arc::new(NullPhotoStore),
        moderation: Arc::new(NullModerationRepo),
        ideas: Arc::new(NullIdeaRepo),
        reports: Arc::new(NullReportRepo),
    }
}

// ── Null billing adapters ─────────────────────────────────────────────────────

pub struct NullSubscriptionRepo;
#[async_trait]
impl SubscriptionRepo for NullSubscriptionRepo {
    async fn find_by_account(&self, _: Uuid) -> Result<Option<Subscription>, DomainError> {
        Ok(None)
    }
    async fn find_by_provider_subscription(
        &self,
        _: &str,
    ) -> Result<Option<Subscription>, DomainError> {
        Ok(None)
    }
    async fn find_by_provider_customer(
        &self,
        _: &str,
    ) -> Result<Option<Subscription>, DomainError> {
        Ok(None)
    }
    async fn upsert(&self, _: &Subscription) -> Result<(), DomainError> {
        Ok(())
    }
}

pub struct NullWebhookEventLog;
#[async_trait]
impl WebhookEventLog for NullWebhookEventLog {
    async fn try_record(&self, _: &str, _: &str, _: DateTime<Utc>) -> Result<bool, DomainError> {
        Ok(true)
    }
}

pub struct NullPaymentGateway;
#[async_trait]
impl PaymentGateway for NullPaymentGateway {
    async fn create_checkout_session(
        &self,
        _: Uuid,
        plan: &Plan,
        _: &str,
        _: &str,
        _: Option<&str>,
    ) -> Result<CheckoutResult, DomainError> {
        Ok(CheckoutResult {
            url: format!("https://null-checkout.test?plan={}", plan.as_str()),
            provider_customer_id: "cus_null".into(),
        })
    }
    async fn create_portal_session(&self, _: &str, _: &str) -> Result<String, DomainError> {
        Ok("https://null-portal.test".into())
    }
    fn verify_webhook_signature(&self, _: &[u8], _: &str) -> Result<(), DomainError> {
        Ok(())
    }
}

/// Convenience: all-null billing repos for tests that don't exercise billing.
pub fn null_billing() -> BillingRepos {
    BillingRepos {
        subscriptions: Arc::new(NullSubscriptionRepo),
        webhook_log: Arc::new(NullWebhookEventLog),
        gateway: Arc::new(NullPaymentGateway),
    }
}

/// Build a state using only a PgPool + null auth adapters (for Phase 1 tests).
pub fn null_state(pool: PgPool) -> AppState {
    AppState::new(
        pool,
        Arc::new(NullRepo),
        Arc::new(NullHasher),
        Arc::new(NullTokens),
        Arc::new(NullEmail),
        Arc::new(NullClock),
        Arc::new(NullChildRepo),
        Arc::new(NullConsentRepo),
        Arc::new(NullClassRepo),
        Arc::new(NullConsentEmail),
        Arc::new(NullExploreRepo),
        Arc::new(NullLibraryRepo),
        Arc::new(NullChallengeRepo),
        null_gamification(),
        null_portfolio(),
        null_billing(),
    )
}
