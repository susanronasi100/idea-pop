//! GET /library/* + /courses/:id + /creators/:id — Library content endpoints.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use idea_pop_domain::{DomainError, QuickMakeFilter, Studio};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::{error::ApiError, extractor::AuthToken, AppState};

// ── DTOs ──────────────────────────────────────────────────────────────────────

#[derive(Serialize, ToSchema)]
pub struct StudioCountResponse {
    pub studio: String,
    pub quick_make_count: i64,
    pub course_count: i64,
}

#[derive(Serialize, ToSchema)]
pub struct QuickMakeResponse {
    pub id: Uuid,
    pub title: String,
    pub slug: String,
    pub studio: String,
    pub difficulty: i16,
    pub time_minutes: i16,
    pub materials: Vec<String>,
    pub mess_level: i16,
    pub video_url: String,
    pub xp_reward: i16,
    /// Always present — UI must label AI-generated content per platform rules.
    pub ai_generated: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, ToSchema)]
pub struct QuickMakePageResponse {
    pub items: Vec<QuickMakeResponse>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Serialize, ToSchema)]
pub struct LessonResponse {
    pub id: Uuid,
    pub ordinal: i16,
    pub title: String,
    pub video_url: String,
    pub duration_s: i32,
    pub xp_reward: i16,
}

#[derive(Serialize, ToSchema)]
pub struct CourseDetailResponse {
    pub id: Uuid,
    pub title: String,
    pub slug: String,
    pub studio: String,
    pub creator_id: Uuid,
    pub summary: String,
    pub difficulty: i16,
    pub age_min: i16,
    pub materials: Vec<String>,
    /// Own price in Toman for a special expert course sold one by one; null = included in Plus / Family.
    pub price_toman: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub lessons: Vec<LessonResponse>,
}

#[derive(Serialize, ToSchema)]
pub struct CourseSummaryResponse {
    pub id: Uuid,
    pub title: String,
    pub slug: String,
    pub studio: String,
    pub creator_id: Uuid,
    pub creator_name: String,
    pub difficulty: i16,
    pub age_min: i16,
    /// Own price in Toman for a special expert course sold one by one; null = included in Plus / Family.
    pub price_toman: Option<i32>,
    pub lesson_count: i64,
}

#[derive(Serialize, ToSchema)]
pub struct CreatorResponse {
    pub id: Uuid,
    pub display_name: String,
    pub bio: String,
    pub studio: String,
    pub avatar_url: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize, IntoParams)]
pub struct QuickMakeQuery {
    /// Filter by studio slug: craft | art | music | code | science | nature
    pub studio: Option<String>,
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_per_page")]
    pub per_page: i64,
}

fn default_page() -> i64 {
    1
}
fn default_per_page() -> i64 {
    20
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/// List all studios with their quick-make counts.
#[utoipa::path(get, path = "/library/studios", tag = "library",
    responses(
        (status = 200, description = "Studio overview", body = [StudioCountResponse]),
        (status = 401, description = "Not authenticated", body = crate::ProblemDetail),
    ))]
pub async fn list_studios(
    _auth: AuthToken,
    State(state): State<AppState>,
) -> Result<Json<Vec<StudioCountResponse>>, ApiError> {
    let counts = state.library.studio_counts().await?;
    Ok(Json(
        counts
            .into_iter()
            .map(|sc| StudioCountResponse {
                studio: sc.studio.as_str().to_owned(),
                quick_make_count: sc.quick_make_count,
                course_count: sc.course_count,
            })
            .collect(),
    ))
}

/// List all courses (summary rows for the Library index). Restricted children CAN access.
#[utoipa::path(get, path = "/library/courses", tag = "library",
    responses(
        (status = 200, description = "Course summaries", body = [CourseSummaryResponse]),
        (status = 401, description = "Not authenticated", body = crate::ProblemDetail),
    ))]
pub async fn list_courses(
    _auth: AuthToken,
    State(state): State<AppState>,
) -> Result<Json<Vec<CourseSummaryResponse>>, ApiError> {
    let courses = state.library.list_courses().await?;
    Ok(Json(
        courses
            .into_iter()
            .map(|c| CourseSummaryResponse {
                id: c.id,
                title: c.title,
                slug: c.slug,
                studio: c.studio.as_str().to_owned(),
                creator_id: c.creator_id,
                creator_name: c.creator_name,
                difficulty: c.difficulty,
                age_min: c.age_min,
                price_toman: c.price_toman,
                lesson_count: c.lesson_count,
            })
            .collect(),
    ))
}

/// List quick-makes (paginated, filter by studio). Restricted children CAN access.
#[utoipa::path(get, path = "/library/quick-makes", tag = "library",
    params(QuickMakeQuery),
    responses(
        (status = 200, description = "Paginated quick-makes", body = QuickMakePageResponse),
        (status = 401, description = "Not authenticated", body = crate::ProblemDetail),
        (status = 422, description = "Invalid filter", body = crate::ProblemDetail),
    ))]
pub async fn list_quick_makes(
    _auth: AuthToken,
    State(state): State<AppState>,
    Query(q): Query<QuickMakeQuery>,
) -> Result<Json<QuickMakePageResponse>, ApiError> {
    let studio = q
        .studio
        .as_deref()
        .map(|s| {
            Studio::from_slug(s)
                .ok_or_else(|| DomainError::Validation(format!("unknown studio '{s}'")))
        })
        .transpose()?;

    let filter = QuickMakeFilter {
        studio,
        page: q.page,
        per_page: q.per_page,
    };
    filter.validate()?;

    let page = state.library.list_quick_makes(&filter).await?;

    Ok(Json(QuickMakePageResponse {
        total: page.total,
        page: page.page,
        per_page: page.per_page,
        items: page.items.into_iter().map(qm_to_dto).collect(),
    }))
}

/// Get a course by ID with its ordered lessons.
#[utoipa::path(get, path = "/courses/{id}", tag = "library",
    params(("id" = Uuid, Path, description = "Course UUID")),
    responses(
        (status = 200, description = "Course with lessons", body = CourseDetailResponse),
        (status = 401, description = "Not authenticated", body = crate::ProblemDetail),
        (status = 404, description = "Not found", body = crate::ProblemDetail),
    ))]
pub async fn get_course(
    _auth: AuthToken,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<(StatusCode, Json<CourseDetailResponse>), ApiError> {
    let (course, lessons) = state
        .library
        .find_course_with_lessons(id)
        .await?
        .ok_or(DomainError::NotFound)?;

    Ok((
        StatusCode::OK,
        Json(CourseDetailResponse {
            id: course.id,
            title: course.title,
            slug: course.slug,
            studio: course.studio.as_str().to_owned(),
            creator_id: course.creator_id,
            summary: course.summary,
            difficulty: course.difficulty,
            age_min: course.age_min,
            materials: course.materials,
            price_toman: course.price_toman,
            created_at: course.created_at,
            lessons: lessons
                .into_iter()
                .map(|l| LessonResponse {
                    id: l.id,
                    ordinal: l.ordinal,
                    title: l.title,
                    video_url: l.video_url,
                    duration_s: l.duration_s,
                    xp_reward: l.xp_reward,
                })
                .collect(),
        }),
    ))
}

/// Get a creator by ID.
#[utoipa::path(get, path = "/creators/{id}", tag = "library",
    params(("id" = Uuid, Path, description = "Creator UUID")),
    responses(
        (status = 200, description = "Creator profile", body = CreatorResponse),
        (status = 401, description = "Not authenticated", body = crate::ProblemDetail),
        (status = 404, description = "Not found", body = crate::ProblemDetail),
    ))]
pub async fn get_creator(
    _auth: AuthToken,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<(StatusCode, Json<CreatorResponse>), ApiError> {
    let creator = state
        .library
        .find_creator(id)
        .await?
        .ok_or(DomainError::NotFound)?;

    Ok((
        StatusCode::OK,
        Json(CreatorResponse {
            id: creator.id,
            display_name: creator.display_name,
            bio: creator.bio,
            studio: creator.studio.as_str().to_owned(),
            avatar_url: creator.avatar_url,
            created_at: creator.created_at,
        }),
    ))
}

fn qm_to_dto(q: idea_pop_domain::QuickMake) -> QuickMakeResponse {
    QuickMakeResponse {
        id: q.id,
        title: q.title,
        slug: q.slug,
        studio: q.studio.as_str().to_owned(),
        difficulty: q.difficulty,
        time_minutes: q.time_minutes,
        materials: q.materials,
        mess_level: q.mess_level,
        video_url: q.video_url,
        xp_reward: q.xp_reward,
        ai_generated: q.ai_generated,
        created_at: q.created_at,
    }
}
