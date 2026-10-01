//! SQLx implementations of the gamification ports: XpRepo, ProgressRepo, BadgeRepo, AnalyticsSink.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use idea_pop_domain::{
    progress::{
        AnalyticsEvent, AttemptStatus, BadgeCriteria, BadgeDefinition, ChallengeAttempt,
        ChildBadge, CycleActivityResult, XpEvent, XpSourceType,
    },
    AnalyticsSink, BadgeRepo, DomainError, ProgressRepo, XpRepo,
};

// ── helpers ───────────────────────────────────────────────────────────────────

fn db_err(e: sqlx::Error) -> DomainError {
    DomainError::Internal(e.to_string())
}

fn domain_err(msg: impl Into<String>) -> DomainError {
    DomainError::Internal(msg.into())
}

// ── SqlxXpRepo ────────────────────────────────────────────────────────────────

pub struct SqlxXpRepo {
    pool: PgPool,
}

impl SqlxXpRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl XpRepo for SqlxXpRepo {
    async fn has_event(
        &self,
        child_id: Uuid,
        source_type: &XpSourceType,
        source_id: Uuid,
    ) -> Result<bool, DomainError> {
        let row = sqlx::query(
            "SELECT COUNT(*) AS cnt FROM xp_events
             WHERE child_id = $1 AND source_type = $2 AND source_id = $3",
        )
        .bind(child_id)
        .bind(source_type.as_str())
        .bind(source_id)
        .fetch_one(&self.pool)
        .await
        .map_err(db_err)?;

        let cnt: i64 = row.try_get("cnt").map_err(db_err)?;
        Ok(cnt > 0)
    }

    async fn append_event(&self, event: &XpEvent) -> Result<(), DomainError> {
        sqlx::query(
            "INSERT INTO xp_events (id, child_id, source_type, source_id, amount, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (child_id, source_type, source_id) DO NOTHING",
        )
        .bind(event.id)
        .bind(event.child_id)
        .bind(event.source_type.as_str())
        .bind(event.source_id)
        .bind(event.amount)
        .bind(event.created_at)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn list_events(&self, child_id: Uuid) -> Result<Vec<XpEvent>, DomainError> {
        let rows = sqlx::query(
            "SELECT id, child_id, source_type, source_id, amount, created_at
             FROM xp_events WHERE child_id = $1 ORDER BY created_at",
        )
        .bind(child_id)
        .fetch_all(&self.pool)
        .await
        .map_err(db_err)?;

        let mut events = Vec::with_capacity(rows.len());
        for row in rows {
            let source_type_str: &str = row.try_get("source_type").map_err(db_err)?;
            let source_type = XpSourceType::from_db(source_type_str)
                .ok_or_else(|| domain_err(format!("unknown source_type: {source_type_str}")))?;
            events.push(XpEvent {
                id: row.try_get("id").map_err(db_err)?,
                child_id: row.try_get("child_id").map_err(db_err)?,
                source_type,
                source_id: row.try_get("source_id").map_err(db_err)?,
                amount: row.try_get("amount").map_err(db_err)?,
                created_at: row.try_get("created_at").map_err(db_err)?,
            });
        }
        Ok(events)
    }

    async fn upsert_progress(
        &self,
        child_id: Uuid,
        xp: i32,
        level: u32,
        rank: &str,
    ) -> Result<(), DomainError> {
        sqlx::query(
            "INSERT INTO child_progress (child_id, xp_total, level, rank, updated_at)
             VALUES ($1, $2, $3, $4, now())
             ON CONFLICT (child_id) DO UPDATE SET
               xp_total   = EXCLUDED.xp_total,
               level      = EXCLUDED.level,
               rank       = EXCLUDED.rank,
               updated_at = now()",
        )
        .bind(child_id)
        .bind(xp)
        .bind(level as i16)
        .bind(rank)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }
}

// ── SqlxProgressRepo ──────────────────────────────────────────────────────────

pub struct SqlxProgressRepo {
    pool: PgPool,
}

impl SqlxProgressRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ProgressRepo for SqlxProgressRepo {
    async fn record_video_view(
        &self,
        child_id: Uuid,
        video_id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<bool, DomainError> {
        let result = sqlx::query(
            "INSERT INTO video_views (child_id, video_id, viewed_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (child_id, video_id) DO NOTHING",
        )
        .bind(child_id)
        .bind(video_id)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(result.rows_affected() > 0)
    }

    async fn count_video_views(&self, child_id: Uuid) -> Result<u32, DomainError> {
        let row = sqlx::query("SELECT COUNT(*) AS cnt FROM video_views WHERE child_id = $1")
            .bind(child_id)
            .fetch_one(&self.pool)
            .await
            .map_err(db_err)?;
        let cnt: i64 = row.try_get("cnt").map_err(db_err)?;
        Ok(cnt as u32)
    }

    async fn record_lesson_complete(
        &self,
        child_id: Uuid,
        lesson_id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<bool, DomainError> {
        let result = sqlx::query(
            "INSERT INTO lesson_completions (child_id, lesson_id, completed_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (child_id, lesson_id) DO NOTHING",
        )
        .bind(child_id)
        .bind(lesson_id)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(result.rows_affected() > 0)
    }

    async fn count_lesson_completions(&self, child_id: Uuid) -> Result<u32, DomainError> {
        let row = sqlx::query("SELECT COUNT(*) AS cnt FROM lesson_completions WHERE child_id = $1")
            .bind(child_id)
            .fetch_one(&self.pool)
            .await
            .map_err(db_err)?;
        let cnt: i64 = row.try_get("cnt").map_err(db_err)?;
        Ok(cnt as u32)
    }

    async fn create_attempt(&self, attempt: &ChallengeAttempt) -> Result<(), DomainError> {
        sqlx::query(
            "INSERT INTO challenge_attempts
               (id, child_id, challenge_id, current_step, status, started_at)
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(attempt.id)
        .bind(attempt.child_id)
        .bind(attempt.challenge_id)
        .bind(attempt.current_step)
        .bind(attempt.status.as_str())
        .bind(attempt.started_at)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn find_attempt(&self, id: Uuid) -> Result<Option<ChallengeAttempt>, DomainError> {
        let row = sqlx::query(
            "SELECT id, child_id, challenge_id, current_step, status, started_at, completed_at
             FROM challenge_attempts WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(db_err)?;

        let Some(row) = row else { return Ok(None) };

        let status_str: &str = row.try_get("status").map_err(db_err)?;
        let status = AttemptStatus::from_db(status_str)
            .ok_or_else(|| domain_err(format!("unknown attempt status: {status_str}")))?;

        Ok(Some(ChallengeAttempt {
            id: row.try_get("id").map_err(db_err)?,
            child_id: row.try_get("child_id").map_err(db_err)?,
            challenge_id: row.try_get("challenge_id").map_err(db_err)?,
            current_step: row.try_get("current_step").map_err(db_err)?,
            status,
            started_at: row.try_get("started_at").map_err(db_err)?,
            completed_at: row.try_get("completed_at").map_err(db_err)?,
        }))
    }

    async fn find_in_progress_attempt(
        &self,
        child_id: Uuid,
        challenge_id: Uuid,
    ) -> Result<Option<ChallengeAttempt>, DomainError> {
        let row = sqlx::query(
            "SELECT id, child_id, challenge_id, current_step, status, started_at, completed_at
             FROM challenge_attempts
             WHERE child_id = $1 AND challenge_id = $2 AND status = 'in_progress'
             ORDER BY started_at DESC
             LIMIT 1",
        )
        .bind(child_id)
        .bind(challenge_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(db_err)?;

        let Some(row) = row else { return Ok(None) };

        let status_str: &str = row.try_get("status").map_err(db_err)?;
        let status = AttemptStatus::from_db(status_str)
            .ok_or_else(|| domain_err(format!("unknown attempt status: {status_str}")))?;

        Ok(Some(ChallengeAttempt {
            id: row.try_get("id").map_err(db_err)?,
            child_id: row.try_get("child_id").map_err(db_err)?,
            challenge_id: row.try_get("challenge_id").map_err(db_err)?,
            current_step: row.try_get("current_step").map_err(db_err)?,
            status,
            started_at: row.try_get("started_at").map_err(db_err)?,
            completed_at: row.try_get("completed_at").map_err(db_err)?,
        }))
    }

    async fn update_attempt(
        &self,
        id: Uuid,
        step: i16,
        status: &AttemptStatus,
        completed_at: Option<DateTime<Utc>>,
    ) -> Result<(), DomainError> {
        sqlx::query(
            "UPDATE challenge_attempts
             SET current_step = $2, status = $3, completed_at = $4
             WHERE id = $1",
        )
        .bind(id)
        .bind(step)
        .bind(status.as_str())
        .bind(completed_at)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn count_completed_challenges(&self, child_id: Uuid) -> Result<u32, DomainError> {
        let row = sqlx::query(
            "SELECT COUNT(DISTINCT challenge_id) AS cnt FROM challenge_attempts
             WHERE child_id = $1 AND status = 'completed'",
        )
        .bind(child_id)
        .fetch_one(&self.pool)
        .await
        .map_err(db_err)?;
        let cnt: i64 = row.try_get("cnt").map_err(db_err)?;
        Ok(cnt as u32)
    }

    async fn has_completed_challenge(
        &self,
        child_id: Uuid,
        challenge_id: Uuid,
    ) -> Result<bool, DomainError> {
        let row = sqlx::query(
            "SELECT COUNT(*) AS cnt FROM challenge_attempts
             WHERE child_id = $1 AND challenge_id = $2 AND status = 'completed'",
        )
        .bind(child_id)
        .bind(challenge_id)
        .fetch_one(&self.pool)
        .await
        .map_err(db_err)?;
        let cnt: i64 = row.try_get("cnt").map_err(db_err)?;
        Ok(cnt > 0)
    }

    async fn update_cycle_activity(
        &self,
        child_id: Uuid,
        iso_year: i32,
        iso_week: u32,
        source: &XpSourceType,
    ) -> Result<CycleActivityResult, DomainError> {
        let (explore, learn, solve) = match source {
            XpSourceType::Explore => (true, false, false),
            XpSourceType::Learn => (false, true, false),
            XpSourceType::Solve => (false, false, true),
            XpSourceType::CycleBonus | XpSourceType::DefineBonus => {
                return Ok(CycleActivityResult::NoChange)
            }
        };

        let row = sqlx::query(
            "INSERT INTO creative_cycles
               (child_id, iso_year, iso_week, explore_done, learn_done, solve_done)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (child_id, iso_year, iso_week) DO UPDATE SET
               explore_done = creative_cycles.explore_done OR EXCLUDED.explore_done,
               learn_done   = creative_cycles.learn_done   OR EXCLUDED.learn_done,
               solve_done   = creative_cycles.solve_done   OR EXCLUDED.solve_done
             RETURNING id, explore_done, learn_done, solve_done, bonus_awarded",
        )
        .bind(child_id)
        .bind(iso_year)
        .bind(iso_week as i32)
        .bind(explore)
        .bind(learn)
        .bind(solve)
        .fetch_one(&self.pool)
        .await
        .map_err(db_err)?;

        let all_done: bool = row.try_get::<bool, _>("explore_done").map_err(db_err)?
            && row.try_get::<bool, _>("learn_done").map_err(db_err)?
            && row.try_get::<bool, _>("solve_done").map_err(db_err)?;
        let bonus_awarded: bool = row.try_get("bonus_awarded").map_err(db_err)?;
        let cycle_id: Uuid = row.try_get("id").map_err(db_err)?;

        if all_done && !bonus_awarded {
            // Atomically claim the bonus — only the first caller succeeds.
            let claimed = sqlx::query(
                "UPDATE creative_cycles SET bonus_awarded = true
                 WHERE id = $1 AND NOT bonus_awarded
                 RETURNING id",
            )
            .bind(cycle_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)?;

            if claimed.is_some() {
                return Ok(CycleActivityResult::CycleCompleted(cycle_id));
            }
        }

        Ok(CycleActivityResult::ActivityRecorded)
    }

    async fn count_completed_cycles(&self, child_id: Uuid) -> Result<u32, DomainError> {
        let row = sqlx::query(
            "SELECT COUNT(*) AS cnt FROM creative_cycles
             WHERE child_id = $1 AND bonus_awarded = true",
        )
        .bind(child_id)
        .fetch_one(&self.pool)
        .await
        .map_err(db_err)?;
        let cnt: i64 = row.try_get("cnt").map_err(db_err)?;
        Ok(cnt as u32)
    }
}

// ── SqlxBadgeRepo ─────────────────────────────────────────────────────────────

pub struct SqlxBadgeRepo {
    pool: PgPool,
}

impl SqlxBadgeRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl BadgeRepo for SqlxBadgeRepo {
    async fn all_definitions(&self) -> Result<Vec<BadgeDefinition>, DomainError> {
        let rows = sqlx::query(
            "SELECT id, slug, name, description, icon_url, criteria
             FROM badges ORDER BY created_at",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(db_err)?;

        let mut defs = Vec::with_capacity(rows.len());
        for row in rows {
            let criteria_val: serde_json::Value = row.try_get("criteria").map_err(db_err)?;
            let criteria: BadgeCriteria =
                serde_json::from_value(criteria_val).map_err(|e| domain_err(e.to_string()))?;
            defs.push(BadgeDefinition {
                id: row.try_get("id").map_err(db_err)?,
                slug: row.try_get("slug").map_err(db_err)?,
                name: row.try_get("name").map_err(db_err)?,
                description: row.try_get("description").map_err(db_err)?,
                icon_url: row.try_get("icon_url").map_err(db_err)?,
                criteria,
            });
        }
        Ok(defs)
    }

    async fn child_badges(&self, child_id: Uuid) -> Result<Vec<ChildBadge>, DomainError> {
        let rows = sqlx::query(
            "SELECT b.id AS badge_id, b.slug, b.name, b.icon_url, cb.awarded_at
             FROM child_badges cb
             JOIN badges b ON b.id = cb.badge_id
             WHERE cb.child_id = $1
             ORDER BY cb.awarded_at",
        )
        .bind(child_id)
        .fetch_all(&self.pool)
        .await
        .map_err(db_err)?;

        let mut badges = Vec::with_capacity(rows.len());
        for row in rows {
            badges.push(ChildBadge {
                badge_id: row.try_get("badge_id").map_err(db_err)?,
                badge_slug: row.try_get("slug").map_err(db_err)?,
                badge_name: row.try_get("name").map_err(db_err)?,
                icon_url: row.try_get("icon_url").map_err(db_err)?,
                awarded_at: row.try_get("awarded_at").map_err(db_err)?,
            });
        }
        Ok(badges)
    }

    async fn award_badge(
        &self,
        child_id: Uuid,
        badge_id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<bool, DomainError> {
        let result = sqlx::query(
            "INSERT INTO child_badges (child_id, badge_id, awarded_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (child_id, badge_id) DO NOTHING",
        )
        .bind(child_id)
        .bind(badge_id)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(result.rows_affected() > 0)
    }
}

// ── SqlxAnalyticsSink ─────────────────────────────────────────────────────────

pub struct SqlxAnalyticsSink {
    pool: PgPool,
}

impl SqlxAnalyticsSink {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AnalyticsSink for SqlxAnalyticsSink {
    async fn emit(&self, event: &AnalyticsEvent) -> Result<(), DomainError> {
        let payload = serde_json::to_value(&event.kind).map_err(|e| domain_err(e.to_string()))?;

        sqlx::query(
            "INSERT INTO analytics_events (id, child_id, event_type, payload, created_at)
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(event.id)
        .bind(event.child_id)
        .bind(event.kind.event_type_str())
        .bind(sqlx::types::Json(payload))
        .bind(event.created_at)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;

        Ok(())
    }
}
