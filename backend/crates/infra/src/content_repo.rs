//! SQLx implementations of ExploreRepo and LibraryRepo.

use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use idea_pop_domain::{
    content::{
        Course, CourseSummary, Creator, ExploreFilter, ExploreVideo, Lesson, Page, QuickMake,
        QuickMakeFilter, Studio, StudioCount, SuperpowerCategory,
    },
    AgeMode, DomainError, ExploreRepo, LibraryRepo,
};

fn sqlx_err(e: sqlx::Error) -> DomainError {
    tracing::error!(error = %e, "database error");
    DomainError::Internal("database error".into())
}

fn category_or(s: &str) -> SuperpowerCategory {
    SuperpowerCategory::from_slug(s).unwrap_or(SuperpowerCategory::MastersOfDisguise)
}

fn studio_or(s: &str) -> Studio {
    Studio::from_slug(s).unwrap_or(Studio::Craft)
}

fn age_modes_from_vec(v: Vec<String>) -> Vec<AgeMode> {
    v.iter().filter_map(|s| AgeMode::from_slug(s)).collect()
}

// ── SqlxExploreRepo ───────────────────────────────────────────────────────────

pub struct SqlxExploreRepo {
    pool: PgPool,
}

impl SqlxExploreRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ExploreRepo for SqlxExploreRepo {
    async fn list(&self, filter: &ExploreFilter) -> Result<Page<ExploreVideo>, DomainError> {
        let category = filter
            .superpower_category
            .as_ref()
            .map(|c| c.as_str().to_owned());
        let age_mode = filter.age_mode.as_ref().map(|a| a.as_str().to_owned());
        let per_page = filter.per_page;
        let offset = (filter.page - 1) * per_page;

        let total: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*)
               FROM explore_videos
               WHERE ($1::text IS NULL OR superpower_category = $1)
                 AND ($2::text IS NULL OR $2 = ANY(age_modes))"#,
        )
        .bind(&category)
        .bind(&age_mode)
        .fetch_one(&self.pool)
        .await
        .map_err(sqlx_err)?;

        let rows = sqlx::query!(
            r#"SELECT id, title, slug, superpower_category, taxonomy, video_url, duration_s,
                      design_secret, sticker_id, xp_reward, ai_generated, age_modes, created_at
               FROM explore_videos
               WHERE ($1::text IS NULL OR superpower_category = $1)
                 AND ($2::text IS NULL OR $2 = ANY(age_modes))
               ORDER BY created_at DESC
               LIMIT $3 OFFSET $4"#,
            category,
            age_mode,
            per_page,
            offset,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(sqlx_err)?;

        let items = rows
            .into_iter()
            .map(|r| ExploreVideo {
                id: r.id,
                title: r.title,
                slug: r.slug,
                superpower_category: category_or(&r.superpower_category),
                taxonomy: r.taxonomy,
                video_url: r.video_url,
                duration_s: r.duration_s,
                design_secret: r.design_secret,
                sticker_id: r.sticker_id,
                xp_reward: r.xp_reward,
                ai_generated: r.ai_generated,
                age_modes: age_modes_from_vec(r.age_modes),
                created_at: r.created_at,
            })
            .collect();

        Ok(Page::new(items, total, filter.page, per_page))
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<ExploreVideo>, DomainError> {
        let row = sqlx::query!(
            r#"SELECT id, title, slug, superpower_category, taxonomy, video_url, duration_s,
                      design_secret, sticker_id, xp_reward, ai_generated, age_modes, created_at
               FROM explore_videos WHERE id = $1"#,
            id,
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(sqlx_err)?;

        Ok(row.map(|r| ExploreVideo {
            id: r.id,
            title: r.title,
            slug: r.slug,
            superpower_category: category_or(&r.superpower_category),
            taxonomy: r.taxonomy,
            video_url: r.video_url,
            duration_s: r.duration_s,
            design_secret: r.design_secret,
            sticker_id: r.sticker_id,
            xp_reward: r.xp_reward,
            ai_generated: r.ai_generated,
            age_modes: age_modes_from_vec(r.age_modes),
            created_at: r.created_at,
        }))
    }
}

// ── SqlxLibraryRepo ───────────────────────────────────────────────────────────

pub struct SqlxLibraryRepo {
    pool: PgPool,
}

impl SqlxLibraryRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl LibraryRepo for SqlxLibraryRepo {
    async fn list_quick_makes(
        &self,
        filter: &QuickMakeFilter,
    ) -> Result<Page<QuickMake>, DomainError> {
        let studio = filter.studio.map(|s| s.as_str().to_owned());
        let per_page = filter.per_page;
        let offset = (filter.page - 1) * per_page;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM quick_makes WHERE ($1::text IS NULL OR studio = $1)",
        )
        .bind(&studio)
        .fetch_one(&self.pool)
        .await
        .map_err(sqlx_err)?;

        let rows = sqlx::query!(
            r#"SELECT id, title, slug, studio, difficulty, time_minutes, materials,
                      mess_level, video_url, xp_reward, ai_generated, created_at
               FROM quick_makes
               WHERE ($1::text IS NULL OR studio = $1)
               ORDER BY created_at DESC
               LIMIT $2 OFFSET $3"#,
            studio,
            per_page,
            offset,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(sqlx_err)?;

        let items = rows
            .into_iter()
            .map(|r| QuickMake {
                id: r.id,
                title: r.title,
                slug: r.slug,
                studio: studio_or(&r.studio),
                difficulty: r.difficulty,
                time_minutes: r.time_minutes,
                materials: r.materials,
                mess_level: r.mess_level,
                video_url: r.video_url,
                xp_reward: r.xp_reward,
                ai_generated: r.ai_generated,
                created_at: r.created_at,
            })
            .collect();

        Ok(Page::new(items, total, filter.page, per_page))
    }

    async fn list_courses(&self) -> Result<Vec<CourseSummary>, DomainError> {
        let rows = sqlx::query!(
            r#"SELECT c.id, c.title, c.slug, c.studio, c.creator_id,
                      cr.display_name AS creator_name,
                      c.difficulty, c.age_min, c.price_toman,
                      COUNT(l.id) AS "lesson_count!"
               FROM courses c
               JOIN creators cr ON cr.id = c.creator_id
               LEFT JOIN lessons l ON l.course_id = c.id
               GROUP BY c.id, cr.display_name
               ORDER BY c.created_at"#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(sqlx_err)?;

        Ok(rows
            .into_iter()
            .map(|r| CourseSummary {
                id: r.id,
                title: r.title,
                slug: r.slug,
                studio: studio_or(&r.studio),
                creator_id: r.creator_id,
                creator_name: r.creator_name,
                difficulty: r.difficulty,
                age_min: r.age_min,
                price_toman: r.price_toman,
                lesson_count: r.lesson_count,
            })
            .collect())
    }

    async fn find_course_with_lessons(
        &self,
        id: Uuid,
    ) -> Result<Option<(Course, Vec<Lesson>)>, DomainError> {
        let row = sqlx::query!(
            r#"SELECT id, title, slug, studio, creator_id, summary,
                      difficulty, age_min, materials, price_toman, created_at
               FROM courses WHERE id = $1"#,
            id,
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(sqlx_err)?;

        let Some(r) = row else { return Ok(None) };

        let course = Course {
            id: r.id,
            title: r.title,
            slug: r.slug,
            studio: studio_or(&r.studio),
            creator_id: r.creator_id,
            summary: r.summary,
            difficulty: r.difficulty,
            age_min: r.age_min,
            materials: r.materials,
            price_toman: r.price_toman,
            created_at: r.created_at,
        };

        let lesson_rows = sqlx::query!(
            r#"SELECT id, course_id, ordinal, title, video_url, duration_s, xp_reward
               FROM lessons WHERE course_id = $1 ORDER BY ordinal"#,
            id,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(sqlx_err)?;

        let lessons = lesson_rows
            .into_iter()
            .map(|l| Lesson {
                id: l.id,
                course_id: l.course_id,
                ordinal: l.ordinal,
                title: l.title,
                video_url: l.video_url,
                duration_s: l.duration_s,
                xp_reward: l.xp_reward,
            })
            .collect();

        Ok(Some((course, lessons)))
    }

    async fn find_creator(&self, id: Uuid) -> Result<Option<Creator>, DomainError> {
        let row = sqlx::query!(
            r#"SELECT id, display_name, bio, studio, avatar_url, created_at
               FROM creators WHERE id = $1"#,
            id,
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(sqlx_err)?;

        Ok(row.map(|r| Creator {
            id: r.id,
            display_name: r.display_name,
            bio: r.bio,
            studio: studio_or(&r.studio),
            avatar_url: r.avatar_url,
            created_at: r.created_at,
        }))
    }

    async fn studio_counts(&self) -> Result<Vec<StudioCount>, DomainError> {
        let rows = sqlx::query!(
            r#"SELECT studio AS "studio!",
                      COUNT(*) FILTER (WHERE kind = 'make')   AS "makes!",
                      COUNT(*) FILTER (WHERE kind = 'course') AS "courses!"
               FROM (
                   SELECT studio, 'make'::text   AS kind FROM quick_makes
                   UNION ALL
                   SELECT studio, 'course'::text AS kind FROM courses
               ) AS combined
               GROUP BY studio"#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(sqlx_err)?;

        let mut counts: std::collections::HashMap<String, (i64, i64)> = rows
            .into_iter()
            .map(|r| (r.studio, (r.makes, r.courses)))
            .collect();

        // Return all 6 studios, filling 0 for any not in the DB.
        Ok(Studio::all()
            .into_iter()
            .map(|s| {
                let (makes, courses) = counts.remove(s.as_str()).unwrap_or((0, 0));
                StudioCount {
                    studio: s,
                    quick_make_count: makes,
                    course_count: courses,
                }
            })
            .collect())
    }
}
