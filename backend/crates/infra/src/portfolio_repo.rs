//! SQLx implementations of the portfolio ports and an S3-backed PhotoStore.

use async_trait::async_trait;
use aws_credential_types::Credentials;
use aws_sdk_s3::{config::Region, presigning::PresigningConfig, Client as S3Client};
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use std::time::Duration;
use uuid::Uuid;

use idea_pop_domain::{
    portfolio::{
        ChallengeIdea, ModerationContentType, ModerationItem, ModerationStatus, OriginType,
        Project, ReactionCounts, ReactionType, Report, ReportStatus, Visibility,
    },
    DomainError, IdeaRepo, ModerationRepo, PhotoStore, ProjectRepo, ReportRepo,
};

// ── helpers ───────────────────────────────────────────────────────────────────

fn db_err(e: sqlx::Error) -> DomainError {
    DomainError::Internal(e.to_string())
}

fn domain_err(msg: impl Into<String>) -> DomainError {
    DomainError::Internal(msg.into())
}

// ── SqlxProjectRepo ───────────────────────────────────────────────────────────

pub struct SqlxProjectRepo {
    pool: PgPool,
}

impl SqlxProjectRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

fn project_from_row(row: &sqlx::postgres::PgRow) -> Result<Project, DomainError> {
    let origin_type_str: &str = row.try_get("origin_type").map_err(db_err)?;
    let origin_type = OriginType::from_db(origin_type_str)
        .ok_or_else(|| domain_err(format!("unknown origin_type: {origin_type_str}")))?;

    let req_str: &str = row.try_get("requested_visibility").map_err(db_err)?;
    let requested_visibility = Visibility::from_db(req_str)
        .ok_or_else(|| domain_err(format!("unknown visibility: {req_str}")))?;

    let eff_str: &str = row.try_get("effective_visibility").map_err(db_err)?;
    let effective_visibility = Visibility::from_db(eff_str)
        .ok_or_else(|| domain_err(format!("unknown visibility: {eff_str}")))?;

    let photo_keys: Vec<String> = row.try_get("photo_keys").map_err(db_err)?;

    Ok(Project {
        id: row.try_get("id").map_err(db_err)?,
        child_id: row.try_get("child_id").map_err(db_err)?,
        origin_type,
        origin_id: row.try_get("origin_id").map_err(db_err)?,
        title: row.try_get("title").map_err(db_err)?,
        description: row.try_get("description").map_err(db_err)?,
        materials: row.try_get("materials").map_err(db_err)?,
        what_was_hard: row.try_get("what_was_hard").map_err(db_err)?,
        what_to_improve: row.try_get("what_to_improve").map_err(db_err)?,
        photo_keys,
        requested_visibility,
        effective_visibility,
        created_at: row.try_get("created_at").map_err(db_err)?,
        updated_at: row.try_get("updated_at").map_err(db_err)?,
    })
}

#[async_trait]
impl ProjectRepo for SqlxProjectRepo {
    async fn create(&self, project: &Project) -> Result<(), DomainError> {
        sqlx::query(
            "INSERT INTO projects
               (id, child_id, origin_type, origin_id, title, description, materials,
                what_was_hard, what_to_improve, photo_keys,
                requested_visibility, effective_visibility, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
        )
        .bind(project.id)
        .bind(project.child_id)
        .bind(project.origin_type.as_str())
        .bind(project.origin_id)
        .bind(&project.title)
        .bind(&project.description)
        .bind(&project.materials)
        .bind(&project.what_was_hard)
        .bind(&project.what_to_improve)
        .bind(&project.photo_keys)
        .bind(project.requested_visibility.as_str())
        .bind(project.effective_visibility.as_str())
        .bind(project.created_at)
        .bind(project.updated_at)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<Project>, DomainError> {
        let row = sqlx::query(
            "SELECT id, child_id, origin_type, origin_id, title, description, materials,
                    what_was_hard, what_to_improve, photo_keys,
                    requested_visibility, effective_visibility, created_at, updated_at
             FROM projects WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(db_err)?;

        row.map(|r| project_from_row(&r)).transpose()
    }

    async fn list_by_child(&self, child_id: Uuid) -> Result<Vec<Project>, DomainError> {
        let rows = sqlx::query(
            "SELECT id, child_id, origin_type, origin_id, title, description, materials,
                    what_was_hard, what_to_improve, photo_keys,
                    requested_visibility, effective_visibility, created_at, updated_at
             FROM projects WHERE child_id = $1 ORDER BY created_at DESC",
        )
        .bind(child_id)
        .fetch_all(&self.pool)
        .await
        .map_err(db_err)?;

        rows.iter().map(project_from_row).collect()
    }

    async fn set_visibility(
        &self,
        id: Uuid,
        requested: &Visibility,
        effective: &Visibility,
        now: DateTime<Utc>,
    ) -> Result<(), DomainError> {
        sqlx::query(
            "UPDATE projects SET requested_visibility=$2, effective_visibility=$3, updated_at=$4
             WHERE id=$1",
        )
        .bind(id)
        .bind(requested.as_str())
        .bind(effective.as_str())
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn add_photo_key(
        &self,
        id: Uuid,
        key: &str,
        now: DateTime<Utc>,
    ) -> Result<(), DomainError> {
        sqlx::query(
            "UPDATE projects SET photo_keys = array_append(photo_keys, $2), updated_at = $3
             WHERE id = $1",
        )
        .bind(id)
        .bind(key)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }
}

// ── S3PhotoStore ──────────────────────────────────────────────────────────────

pub struct S3PhotoStore {
    client: S3Client,
    bucket: String,
}

impl S3PhotoStore {
    pub fn new(
        endpoint: &str,
        region: &str,
        access_key: &str,
        secret_key: &str,
        bucket: &str,
    ) -> Self {
        let credentials = Credentials::new(access_key, secret_key, None, None, "static");
        let config = aws_sdk_s3::config::Builder::new()
            .endpoint_url(endpoint)
            .region(Region::new(region.to_owned()))
            .credentials_provider(credentials)
            .force_path_style(true)
            .build();
        let client = S3Client::from_conf(config);
        Self {
            client,
            bucket: bucket.to_owned(),
        }
    }
}

#[async_trait]
impl PhotoStore for S3PhotoStore {
    async fn presign_upload(&self, key: &str, expires_in_secs: u64) -> Result<String, DomainError> {
        let config = PresigningConfig::expires_in(Duration::from_secs(expires_in_secs))
            .map_err(|e| domain_err(e.to_string()))?;

        let presigned = self
            .client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .presigned(config)
            .await
            .map_err(|e| domain_err(e.to_string()))?;

        Ok(presigned.uri().to_string())
    }

    async fn put(&self, key: &str, bytes: Vec<u8>, content_type: &str) -> Result<(), DomainError> {
        // A fresh dev MinIO has no bucket yet: make it the first time (an existing one is fine).
        if self
            .client
            .head_bucket()
            .bucket(&self.bucket)
            .send()
            .await
            .is_err()
        {
            let _ = self
                .client
                .create_bucket()
                .bucket(&self.bucket)
                .send()
                .await;
        }
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .content_type(content_type)
            .body(bytes.into())
            .send()
            .await
            .map_err(|e| domain_err(e.to_string()))?;
        Ok(())
    }
}

// ── SqlxModerationRepo ────────────────────────────────────────────────────────

pub struct SqlxModerationRepo {
    pool: PgPool,
}

impl SqlxModerationRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

fn moderation_from_row(row: &sqlx::postgres::PgRow) -> Result<ModerationItem, DomainError> {
    let ct_str: &str = row.try_get("content_type").map_err(db_err)?;
    let content_type = ModerationContentType::from_db(ct_str)
        .ok_or_else(|| domain_err(format!("unknown content_type: {ct_str}")))?;

    let st_str: &str = row.try_get("status").map_err(db_err)?;
    let status = ModerationStatus::from_db(st_str)
        .ok_or_else(|| domain_err(format!("unknown moderation status: {st_str}")))?;

    Ok(ModerationItem {
        id: row.try_get("id").map_err(db_err)?,
        content_type,
        content_id: row.try_get("content_id").map_err(db_err)?,
        status,
        reason: row.try_get("reason").map_err(db_err)?,
        reviewer_id: row.try_get("reviewer_id").map_err(db_err)?,
        created_at: row.try_get("created_at").map_err(db_err)?,
        reviewed_at: row.try_get("reviewed_at").map_err(db_err)?,
        due_at: row.try_get("due_at").map_err(db_err)?,
    })
}

#[async_trait]
impl ModerationRepo for SqlxModerationRepo {
    async fn enqueue(&self, item: &ModerationItem) -> Result<(), DomainError> {
        sqlx::query(
            "INSERT INTO moderation_queue
               (id, content_type, content_id, status, reason, reviewer_id,
                created_at, reviewed_at, due_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        )
        .bind(item.id)
        .bind(item.content_type.as_str())
        .bind(item.content_id)
        .bind(item.status.as_str())
        .bind(&item.reason)
        .bind(item.reviewer_id)
        .bind(item.created_at)
        .bind(item.reviewed_at)
        .bind(item.due_at)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn pending_queue(&self) -> Result<Vec<ModerationItem>, DomainError> {
        let rows = sqlx::query(
            "SELECT id, content_type, content_id, status, reason, reviewer_id,
                    created_at, reviewed_at, due_at
             FROM moderation_queue WHERE status = 'pending' ORDER BY created_at",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(db_err)?;

        rows.iter().map(moderation_from_row).collect()
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<ModerationItem>, DomainError> {
        let row = sqlx::query(
            "SELECT id, content_type, content_id, status, reason, reviewer_id,
                    created_at, reviewed_at, due_at
             FROM moderation_queue WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(db_err)?;

        row.map(|r| moderation_from_row(&r)).transpose()
    }

    async fn approve(
        &self,
        id: Uuid,
        reviewer_id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<Option<ModerationItem>, DomainError> {
        let row = sqlx::query(
            "UPDATE moderation_queue
             SET status='approved', reviewer_id=$2, reviewed_at=$3
             WHERE id=$1 AND status='pending'
             RETURNING id, content_type, content_id, status, reason, reviewer_id,
                       created_at, reviewed_at, due_at",
        )
        .bind(id)
        .bind(reviewer_id)
        .bind(now)
        .fetch_optional(&self.pool)
        .await
        .map_err(db_err)?;

        row.map(|r| moderation_from_row(&r)).transpose()
    }

    async fn reject(
        &self,
        id: Uuid,
        reviewer_id: Uuid,
        reason: String,
        now: DateTime<Utc>,
    ) -> Result<Option<ModerationItem>, DomainError> {
        let row = sqlx::query(
            "UPDATE moderation_queue
             SET status='rejected', reviewer_id=$2, reason=$3, reviewed_at=$4
             WHERE id=$1 AND status='pending'
             RETURNING id, content_type, content_id, status, reason, reviewer_id,
                       created_at, reviewed_at, due_at",
        )
        .bind(id)
        .bind(reviewer_id)
        .bind(&reason)
        .bind(now)
        .fetch_optional(&self.pool)
        .await
        .map_err(db_err)?;

        row.map(|r| moderation_from_row(&r)).transpose()
    }

    async fn find_pending_for_content(
        &self,
        content_type: &ModerationContentType,
        content_id: Uuid,
    ) -> Result<Option<ModerationItem>, DomainError> {
        let row = sqlx::query(
            "SELECT id, content_type, content_id, status, reason, reviewer_id,
                    created_at, reviewed_at, due_at
             FROM moderation_queue
             WHERE content_type=$1 AND content_id=$2 AND status='pending'
             ORDER BY created_at DESC
             LIMIT 1",
        )
        .bind(content_type.as_str())
        .bind(content_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(db_err)?;

        row.map(|r| moderation_from_row(&r)).transpose()
    }
}

// ── SqlxIdeaRepo ──────────────────────────────────────────────────────────────

pub struct SqlxIdeaRepo {
    pool: PgPool,
}

impl SqlxIdeaRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

fn idea_from_row(row: &sqlx::postgres::PgRow) -> Result<ChallengeIdea, DomainError> {
    let st_str: &str = row.try_get("moderation_status").map_err(db_err)?;
    let moderation_status = ModerationStatus::from_db(st_str)
        .ok_or_else(|| domain_err(format!("unknown moderation status: {st_str}")))?;

    Ok(ChallengeIdea {
        id: row.try_get("id").map_err(db_err)?,
        child_id: row.try_get("child_id").map_err(db_err)?,
        challenge_id: row.try_get("challenge_id").map_err(db_err)?,
        text: row.try_get("text").map_err(db_err)?,
        photo_key: row.try_get("photo_key").map_err(db_err)?,
        remix_of: row.try_get("remix_of").map_err(db_err)?,
        moderation_status,
        created_at: row.try_get("created_at").map_err(db_err)?,
    })
}

#[async_trait]
impl IdeaRepo for SqlxIdeaRepo {
    async fn submit(&self, idea: &ChallengeIdea) -> Result<(), DomainError> {
        sqlx::query(
            "INSERT INTO challenge_ideas
               (id, child_id, challenge_id, text, photo_key, remix_of,
                moderation_status, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        )
        .bind(idea.id)
        .bind(idea.child_id)
        .bind(idea.challenge_id)
        .bind(&idea.text)
        .bind(&idea.photo_key)
        .bind(idea.remix_of)
        .bind(idea.moderation_status.as_str())
        .bind(idea.created_at)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<ChallengeIdea>, DomainError> {
        let row = sqlx::query(
            "SELECT id, child_id, challenge_id, text, photo_key, remix_of,
                    moderation_status, created_at
             FROM challenge_ideas WHERE id=$1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(db_err)?;

        row.map(|r| idea_from_row(&r)).transpose()
    }

    async fn list_approved(&self, challenge_id: Uuid) -> Result<Vec<ChallengeIdea>, DomainError> {
        let rows = sqlx::query(
            "SELECT id, child_id, challenge_id, text, photo_key, remix_of,
                    moderation_status, created_at
             FROM challenge_ideas
             WHERE challenge_id=$1 AND moderation_status='approved'
             ORDER BY created_at",
        )
        .bind(challenge_id)
        .fetch_all(&self.pool)
        .await
        .map_err(db_err)?;

        rows.iter().map(idea_from_row).collect()
    }

    async fn has_submitted(&self, child_id: Uuid, challenge_id: Uuid) -> Result<bool, DomainError> {
        let row = sqlx::query(
            "SELECT COUNT(*) AS cnt FROM challenge_ideas
             WHERE child_id=$1 AND challenge_id=$2",
        )
        .bind(child_id)
        .bind(challenge_id)
        .fetch_one(&self.pool)
        .await
        .map_err(db_err)?;
        let cnt: i64 = row.try_get("cnt").map_err(db_err)?;
        Ok(cnt > 0)
    }

    async fn update_moderation_status(
        &self,
        id: Uuid,
        status: &ModerationStatus,
    ) -> Result<(), DomainError> {
        sqlx::query("UPDATE challenge_ideas SET moderation_status=$2 WHERE id=$1")
            .bind(id)
            .bind(status.as_str())
            .execute(&self.pool)
            .await
            .map_err(db_err)?;
        Ok(())
    }

    async fn add_reaction(
        &self,
        idea_id: Uuid,
        child_id: Uuid,
        reaction_type: &ReactionType,
    ) -> Result<(), DomainError> {
        sqlx::query(
            "INSERT INTO idea_reactions (idea_id, child_id, reaction_type)
             VALUES ($1,$2,$3)
             ON CONFLICT (idea_id, child_id, reaction_type) DO NOTHING",
        )
        .bind(idea_id)
        .bind(child_id)
        .bind(reaction_type.as_str())
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn count_reactions(&self, idea_id: Uuid) -> Result<ReactionCounts, DomainError> {
        let row = sqlx::query(
            "SELECT
               COUNT(*) FILTER (WHERE reaction_type='claps')       AS claps,
               COUNT(*) FILTER (WHERE reaction_type='stars')       AS stars,
               COUNT(*) FILTER (WHERE reaction_type='lightbulbs')  AS lightbulbs
             FROM idea_reactions WHERE idea_id=$1",
        )
        .bind(idea_id)
        .fetch_one(&self.pool)
        .await
        .map_err(db_err)?;

        Ok(ReactionCounts {
            claps: row.try_get::<i64, _>("claps").map_err(db_err)? as u32,
            stars: row.try_get::<i64, _>("stars").map_err(db_err)? as u32,
            lightbulbs: row.try_get::<i64, _>("lightbulbs").map_err(db_err)? as u32,
        })
    }
}

// ── SqlxReportRepo ────────────────────────────────────────────────────────────

pub struct SqlxReportRepo {
    pool: PgPool,
}

impl SqlxReportRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

fn report_from_row(row: &sqlx::postgres::PgRow) -> Result<Report, DomainError> {
    let ct_str: &str = row.try_get("content_type").map_err(db_err)?;
    let content_type = ModerationContentType::from_db(ct_str)
        .ok_or_else(|| domain_err(format!("unknown content_type: {ct_str}")))?;

    let st_str: &str = row.try_get("status").map_err(db_err)?;
    let status = ReportStatus::from_db(st_str)
        .ok_or_else(|| domain_err(format!("unknown report status: {st_str}")))?;

    Ok(Report {
        id: row.try_get("id").map_err(db_err)?,
        reporter_id: row.try_get("reporter_id").map_err(db_err)?,
        content_type,
        content_id: row.try_get("content_id").map_err(db_err)?,
        reason: row.try_get("reason").map_err(db_err)?,
        status,
        created_at: row.try_get("created_at").map_err(db_err)?,
        due_at: row.try_get("due_at").map_err(db_err)?,
    })
}

#[async_trait]
impl ReportRepo for SqlxReportRepo {
    async fn create(&self, report: &Report) -> Result<(), DomainError> {
        sqlx::query(
            "INSERT INTO reports
               (id, reporter_id, content_type, content_id, reason, status, created_at, due_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        )
        .bind(report.id)
        .bind(report.reporter_id)
        .bind(report.content_type.as_str())
        .bind(report.content_id)
        .bind(&report.reason)
        .bind(report.status.as_str())
        .bind(report.created_at)
        .bind(report.due_at)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }

    async fn list_pending(&self) -> Result<Vec<Report>, DomainError> {
        let rows = sqlx::query(
            "SELECT id, reporter_id, content_type, content_id, reason, status, created_at, due_at
             FROM reports WHERE status='pending' ORDER BY due_at",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(db_err)?;

        rows.iter().map(report_from_row).collect()
    }
}
