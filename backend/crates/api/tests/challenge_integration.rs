//! Integration tests for the Challenge engine.
//!
//! Key proof: the engine is DATA-driven — seeding a second completely different
//! challenge and calling GET /challenges/:id returns a different mission with
//! ZERO code change.  Both missions are rendered by the same generic handler.
//!
//! All SQL uses `sqlx::query` (runtime) to avoid offline cache issues.

use std::sync::Arc;

use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use idea_pop_api::{
    null_billing, null_gamification, null_portfolio, router, AppState, NullChallengeRepo,
};
use idea_pop_infra::{
    Argon2Hasher, JwtTokenIssuer, NullConsentEmailSender, NullEmailSender, SqlxAccountRepo,
    SqlxChallengeRepo, SqlxChildRepo, SqlxClassRepo, SqlxConsentRepo, SystemClock,
};
use serde_json::{json, Value};
use sqlx::PgPool;
use testcontainers::{runners::AsyncRunner, ContainerAsync};
use testcontainers_modules::postgres::Postgres;
use tower::ServiceExt;

// ── Test setup ────────────────────────────────────────────────────────────────

async fn start_postgres() -> (PgPool, ContainerAsync<Postgres>) {
    let pg = Postgres::default().start().await.expect("start postgres");
    let port = pg.get_host_port_ipv4(5432).await.expect("get port");
    let url = format!("postgres://postgres:postgres@127.0.0.1:{port}/postgres");
    let pool = PgPool::connect(&url).await.expect("connect");
    sqlx::migrate!("../../migrations")
        .run(&pool)
        .await
        .expect("migrate");
    (pool, pg)
}

fn challenge_state(pool: PgPool) -> AppState {
    AppState::new(
        pool.clone(),
        Arc::new(SqlxAccountRepo::new(pool.clone())),
        Arc::new(Argon2Hasher),
        Arc::new(JwtTokenIssuer::new("challenge-test-secret-32bytes!!", 900)),
        Arc::new(NullEmailSender),
        Arc::new(SystemClock),
        Arc::new(SqlxChildRepo::new(pool.clone())),
        Arc::new(SqlxConsentRepo::new(pool.clone())),
        Arc::new(SqlxClassRepo::new(pool.clone())),
        Arc::new(NullConsentEmailSender),
        // Use null repos for explore/library — not under test here.
        Arc::new(idea_pop_api::NullExploreRepo),
        Arc::new(idea_pop_api::NullLibraryRepo),
        Arc::new(SqlxChallengeRepo::new(pool)),
        null_gamification(),
        null_portfolio(),
        null_billing(),
    )
}

/// Register an adult, log in, return the access token.
async fn register_and_token(app: &axum::Router, email: &str) -> String {
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({"email": email, "password": "password123",
                           "role": "parent", "display_name": "Test"})
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED, "register failed");

    let res2 = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({"email": email, "password": "password123"}).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    let bytes = to_bytes(res2.into_body(), 1 << 20).await.unwrap();
    let v: Value = serde_json::from_slice(&bytes).unwrap();
    v["access_token"].as_str().unwrap().to_owned()
}

fn authed_get(uri: &str, token: &str) -> Request<Body> {
    Request::builder()
        .method("GET")
        .uri(uri)
        .header("authorization", format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap()
}

async fn body_json(res: axum::response::Response) -> Value {
    let bytes = to_bytes(res.into_body(), 1 << 20).await.unwrap();
    serde_json::from_slice(&bytes).unwrap()
}

// ── DB insert helpers (runtime queries — no offline cache needed) ─────────────

const STEPS_MAX: &str = r#"[
  {"step":"brief","title":"Help Max","story":"Max can't cross the river.","image_url":null},
  {"step":"your_idea","prompt":"Got an idea?","fork_to_step":6},
  {"step":"nature_clues","intro":"Look at nature","clues":[]},
  {"step":"design_secret","secret":"Surface tension!","reveal_hint":"Think flat."},
  {"step":"skill","instructions":"Float clay.","skill_refs":[]},
  {"step":"sketch","prompt":"Draw it.","guidance":"Label parts."},
  {"step":"build_and_test","instructions":"Build it.","test_criteria":["Does it float?"]},
  {"step":"celebrate_and_share","celebration_text":"Great job!","share_prompt":"Share it!"}
]"#;

const STEPS_PICNIC: &str = r#"[
  {"step":"brief","title":"Forest Picnic","story":"Rain is coming and the picnic is in danger!","image_url":null},
  {"step":"your_idea","prompt":"Have a shelter idea?","fork_to_step":6},
  {"step":"nature_clues","intro":"Nature sheds rain cleverly","clues":[]},
  {"step":"design_secret","secret":"Lotus leaves repel water!","reveal_hint":"Think bumpy."},
  {"step":"skill","instructions":"Test waterproofing.","skill_refs":[]},
  {"step":"sketch","prompt":"Design your shelter.","guidance":"Show drainage."},
  {"step":"build_and_test","instructions":"Pour water on it.","test_criteria":["Does it stay dry?"]},
  {"step":"celebrate_and_share","celebration_text":"Picnic saved!","share_prompt":"Share your shelter!"}
]"#;

const TOOLS_JSON: &str = r#"[{"kind":"five_whys","age_mode":"young"}]"#;
const VARIANTS_JSON: &str = r#"[{"age_tier":"8-10","title_override":null,"summary":"Entry level"},{"age_tier":"12-18","title_override":null,"summary":"Advanced"}]"#;

#[allow(clippy::too_many_arguments)]
async fn insert_challenge(
    pool: &PgPool,
    slug: &str,
    title: &str,
    season: i16,
    week: i16,
    steps_json: &str,
    tools_json: &str,
    variants_json: &str,
) -> uuid::Uuid {
    use sqlx::Row;
    let steps: serde_json::Value = serde_json::from_str(steps_json).unwrap();
    let tools: serde_json::Value = serde_json::from_str(tools_json).unwrap();
    let variants: serde_json::Value = serde_json::from_str(variants_json).unwrap();

    let row = sqlx::query(
        r#"INSERT INTO challenges (title, slug, season, week_number, xp_reward, steps, tools, age_tier_variants)
           VALUES ($1, $2, $3, $4, 20, $5, $6, $7)
           RETURNING id"#,
    )
    .bind(title)
    .bind(slug)
    .bind(season)
    .bind(week)
    .bind(sqlx::types::Json(&steps))
    .bind(sqlx::types::Json(&tools))
    .bind(sqlx::types::Json(&variants))
    .fetch_one(pool)
    .await
    .unwrap();
    row.get::<uuid::Uuid, _>("id")
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn challenge_list_returns_items_with_8_steps() {
    let (pool, _pg) = start_postgres().await;
    insert_challenge(
        &pool,
        "max-river",
        "Help Max",
        1,
        1,
        STEPS_MAX,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;

    let app = router(challenge_state(pool), None);
    let token = register_and_token(&app, "list@test.com").await;

    let res = app
        .oneshot(authed_get("/challenges", &token))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = body_json(res).await;
    assert_eq!(body["total"], 1);
    let steps = &body["items"][0]["steps"];
    assert_eq!(
        steps.as_array().unwrap().len(),
        8,
        "must have exactly 8 steps"
    );
    assert_eq!(body["items"][0]["xp_reward"], 20);
}

/// Premium missions are locked for a caller whose family has no active
/// subscription; free missions stay open. (null_billing => no subscription.)
#[tokio::test]
async fn premium_challenge_is_locked_without_subscription() {
    let (pool, _pg) = start_postgres().await;
    let free_id = insert_challenge(
        &pool,
        "free-mission",
        "Free",
        1,
        1,
        STEPS_MAX,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;
    let premium_id = insert_challenge(
        &pool,
        "premium-mission",
        "Premium",
        1,
        2,
        STEPS_MAX,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;
    sqlx::query("UPDATE challenges SET is_premium = TRUE WHERE id = $1")
        .bind(premium_id)
        .execute(&pool)
        .await
        .unwrap();

    let app = router(challenge_state(pool), None);
    let token = register_and_token(&app, "premium-gate@test.com").await;

    let res = app
        .oneshot(authed_get("/challenges", &token))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res).await;
    let items = body["items"].as_array().unwrap();

    let free = items
        .iter()
        .find(|c| c["id"] == free_id.to_string())
        .unwrap();
    assert_eq!(free["is_premium"], false);
    assert_eq!(free["locked"], false);

    let premium = items
        .iter()
        .find(|c| c["id"] == premium_id.to_string())
        .unwrap();
    assert_eq!(premium["is_premium"], true);
    assert_eq!(
        premium["locked"], true,
        "premium mission is locked without a subscription"
    );
}

/// THE KEY TEST: seed two completely different challenges, call the same
/// endpoint, and confirm both return completely different missions with
/// zero code change — the engine is pure data.
#[tokio::test]
async fn engine_is_data_driven_two_different_missions() {
    let (pool, _pg) = start_postgres().await;

    let id_max = insert_challenge(
        &pool,
        "max-river-dd",
        "Help Max",
        1,
        1,
        STEPS_MAX,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;
    let id_picnic = insert_challenge(
        &pool,
        "forest-picnic-dd",
        "Forest Picnic",
        1,
        2,
        STEPS_PICNIC,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;

    let app = router(challenge_state(pool), None);
    let token = register_and_token(&app, "datadriven@test.com").await;

    // Max challenge: brief story is about crossing the river.
    let res_max = app
        .clone()
        .oneshot(authed_get(&format!("/challenges/{id_max}"), &token))
        .await
        .unwrap();
    assert_eq!(res_max.status(), StatusCode::OK);
    let body_max = body_json(res_max).await;
    let brief_max = &body_max["steps"][0];
    assert_eq!(brief_max["step"], "brief");
    assert!(
        brief_max["story"].as_str().unwrap().contains("river")
            || brief_max["title"].as_str().unwrap().contains("Max"),
        "Max challenge brief should mention the river or Max"
    );

    // Picnic challenge: brief story is about a picnic.
    let res_picnic = app
        .clone()
        .oneshot(authed_get(&format!("/challenges/{id_picnic}"), &token))
        .await
        .unwrap();
    assert_eq!(res_picnic.status(), StatusCode::OK);
    let body_picnic = body_json(res_picnic).await;
    let brief_picnic = &body_picnic["steps"][0];
    assert_eq!(brief_picnic["step"], "brief");
    assert!(
        brief_picnic["story"].as_str().unwrap().contains("picnic")
            || brief_picnic["title"].as_str().unwrap().contains("Picnic"),
        "Picnic challenge brief should mention picnic"
    );

    // They must be different missions served by the SAME code.
    assert_ne!(
        body_max["id"], body_picnic["id"],
        "different challenges have different IDs"
    );
    assert_ne!(
        body_max["steps"][0]["story"], body_picnic["steps"][0]["story"],
        "completely different stories — zero code change required"
    );

    // Both have exactly 8 steps.
    assert_eq!(body_max["steps"].as_array().unwrap().len(), 8);
    assert_eq!(body_picnic["steps"].as_array().unwrap().len(), 8);
}

#[tokio::test]
async fn fork_to_step_is_always_6_in_response() {
    let (pool, _pg) = start_postgres().await;
    let id = insert_challenge(
        &pool,
        "fork-test",
        "Fork Test",
        1,
        1,
        STEPS_MAX,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;

    let app = router(challenge_state(pool), None);
    let token = register_and_token(&app, "fork@test.com").await;

    let res = app
        .oneshot(authed_get(&format!("/challenges/{id}"), &token))
        .await
        .unwrap();
    let body = body_json(res).await;

    // Step 2 (index 1) is YourIdea; fork_to_step must be 6.
    let your_idea = &body["steps"][1];
    assert_eq!(your_idea["step"], "your_idea");
    assert_eq!(
        your_idea["fork_to_step"], 6,
        "fork is data — always points to step 6 (Sketch)"
    );
    // Step 6 (index 5) is Sketch — still reachable.
    assert_eq!(body["steps"][5]["step"], "sketch");
}

#[tokio::test]
async fn age_tier_variants_returned_in_response() {
    let (pool, _pg) = start_postgres().await;
    let id = insert_challenge(
        &pool,
        "variants-test",
        "Variants",
        1,
        1,
        STEPS_MAX,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;

    let app = router(challenge_state(pool), None);
    let token = register_and_token(&app, "variants@test.com").await;

    let res = app
        .oneshot(authed_get(&format!("/challenges/{id}"), &token))
        .await
        .unwrap();
    let body = body_json(res).await;

    let variants = body["age_tier_variants"].as_array().unwrap();
    assert_eq!(variants.len(), 2, "two age-tier variants seeded");
    let tiers: Vec<&str> = variants
        .iter()
        .map(|v| v["age_tier"].as_str().unwrap())
        .collect();
    assert!(tiers.contains(&"8-10"), "Young (8-10) tier present");
    assert!(tiers.contains(&"12-18"), "Teen (12-18) tier present");
}

#[tokio::test]
async fn season_filter_works() {
    let (pool, _pg) = start_postgres().await;
    insert_challenge(
        &pool,
        "s1w1",
        "Season 1",
        1,
        1,
        STEPS_MAX,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;
    insert_challenge(
        &pool,
        "s2w1",
        "Season 2",
        2,
        1,
        STEPS_PICNIC,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;

    let app = router(challenge_state(pool), None);
    let token = register_and_token(&app, "season@test.com").await;

    let res = app
        .oneshot(authed_get("/challenges?season=1", &token))
        .await
        .unwrap();
    let body = body_json(res).await;
    assert_eq!(body["total"], 1);
    assert_eq!(body["items"][0]["season"], 1);
}

#[tokio::test]
async fn week_filter_works() {
    let (pool, _pg) = start_postgres().await;
    insert_challenge(
        &pool,
        "w1",
        "Week 1",
        1,
        1,
        STEPS_MAX,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;
    insert_challenge(
        &pool,
        "w2",
        "Week 2",
        1,
        2,
        STEPS_PICNIC,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;

    let app = router(challenge_state(pool), None);
    let token = register_and_token(&app, "week@test.com").await;

    let res = app
        .oneshot(authed_get("/challenges?week=2", &token))
        .await
        .unwrap();
    let body = body_json(res).await;
    assert_eq!(body["total"], 1);
    assert_eq!(body["items"][0]["week_number"], 2);
}

#[tokio::test]
async fn age_mode_young_filter() {
    let (pool, _pg) = start_postgres().await;
    // VARIANTS_JSON has "8-10" and "12-18" — both match AgeMode::Young (8-10) and AgeMode::Older (10-12 or 12-18).
    insert_challenge(
        &pool,
        "young-filter",
        "Young Test",
        1,
        1,
        STEPS_MAX,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;

    let app = router(challenge_state(pool), None);
    let token = register_and_token(&app, "youngf@test.com").await;

    // AgeMode::Young maps to age_tier 8-10 — present in VARIANTS_JSON.
    let res = app
        .clone()
        .oneshot(authed_get("/challenges?age_mode=young", &token))
        .await
        .unwrap();
    let body = body_json(res).await;
    assert_eq!(
        body["total"], 1,
        "challenge with 8-10 tier visible for young"
    );

    // AgeMode::Older maps to 10-12 or 12-18 — 12-18 is present in VARIANTS_JSON.
    let res2 = app
        .oneshot(authed_get("/challenges?age_mode=older", &token))
        .await
        .unwrap();
    let body2 = body_json(res2).await;
    assert_eq!(
        body2["total"], 1,
        "challenge with 12-18 tier visible for older"
    );
}

#[tokio::test]
async fn challenge_detail_not_found() {
    let (pool, _pg) = start_postgres().await;
    let app = router(challenge_state(pool), None);
    let token = register_and_token(&app, "notfound@test.com").await;

    let fake_id = uuid::Uuid::new_v4();
    let res = app
        .oneshot(authed_get(&format!("/challenges/{fake_id}"), &token))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn challenges_require_auth() {
    let (pool, _pg) = start_postgres().await;
    let app = router(
        AppState::new(
            pool.clone(),
            Arc::new(SqlxAccountRepo::new(pool.clone())),
            Arc::new(Argon2Hasher),
            Arc::new(JwtTokenIssuer::new("challenge-test-secret-32bytes!!", 900)),
            Arc::new(NullEmailSender),
            Arc::new(SystemClock),
            Arc::new(SqlxChildRepo::new(pool.clone())),
            Arc::new(SqlxConsentRepo::new(pool.clone())),
            Arc::new(SqlxClassRepo::new(pool)),
            Arc::new(NullConsentEmailSender),
            Arc::new(idea_pop_api::NullExploreRepo),
            Arc::new(idea_pop_api::NullLibraryRepo),
            Arc::new(NullChallengeRepo),
            null_gamification(),
            null_portfolio(),
            null_billing(),
        ),
        None,
    );

    let res = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/challenges")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn pagination_works() {
    let (pool, _pg) = start_postgres().await;
    for i in 1i16..=5 {
        insert_challenge(
            &pool,
            &format!("pag-{i}"),
            &format!("Challenge {i}"),
            1,
            i,
            STEPS_MAX,
            TOOLS_JSON,
            VARIANTS_JSON,
        )
        .await;
    }

    let app = router(challenge_state(pool), None);
    let token = register_and_token(&app, "pag@test.com").await;

    let res = app
        .clone()
        .oneshot(authed_get("/challenges?per_page=2&page=2", &token))
        .await
        .unwrap();
    let body = body_json(res).await;
    assert_eq!(body["total"], 5, "all 5 challenges counted");
    assert_eq!(
        body["items"].as_array().unwrap().len(),
        2,
        "page 2 has 2 items"
    );
    assert_eq!(body["page"], 2);
    assert_eq!(body["per_page"], 2);
}

/// Step-level hint ladders must flatten onto skill_hints / build_hints —
/// the exact fields the mission UI (StepSkill/StepBuild → MissionHints)
/// reads from ChallengeDetail. Legacy hint-less steps yield empty arrays.
#[tokio::test]
async fn step_hints_flatten_onto_skill_and_build_fields() {
    const STEPS_HINTED: &str = r#"[
  {"step":"brief","title":"AI","story":"Train a machine.","image_url":null},
  {"step":"your_idea","prompt":"Got an idea?","fork_to_step":6},
  {"step":"nature_clues","intro":"Brains learn","clues":[]},
  {"step":"design_secret","secret":"Examples!","reveal_hint":"Think varied."},
  {"step":"skill","instructions":"Pick features.","skill_refs":[],
   "hints":["Think ears and whiskers.","Pick yes/no features."]},
  {"step":"sketch","prompt":"Plan examples.","guidance":"Varied beats many."},
  {"step":"build_and_test","instructions":"Test 10 cards.","test_criteria":["Accuracy?"],
   "hints":["Count the right ones.","Add more of the missed kind."]},
  {"step":"celebrate_and_share","celebration_text":"AI teacher!","share_prompt":"Share it!"}
]"#;

    let (pool, _pg) = start_postgres().await;
    let hinted = insert_challenge(
        &pool,
        "hinted",
        "Hinted Mission",
        1,
        1,
        STEPS_HINTED,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;
    // STEPS_MAX has no hints keys at all — the legacy shape.
    let legacy = insert_challenge(
        &pool,
        "legacy",
        "Legacy Mission",
        1,
        2,
        STEPS_MAX,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;

    let app = router(challenge_state(pool), None);
    let token = register_and_token(&app, "hints-flat@test.com").await;

    let res = app
        .clone()
        .oneshot(authed_get(&format!("/challenges/{hinted}"), &token))
        .await
        .unwrap();
    let body = body_json(res).await;
    assert_eq!(
        body["skill_hints"],
        serde_json::json!(["Think ears and whiskers.", "Pick yes/no features."])
    );
    assert_eq!(
        body["build_hints"],
        serde_json::json!(["Count the right ones.", "Add more of the missed kind."])
    );
    // The hints also remain inside the steps payload itself.
    assert_eq!(body["steps"][4]["hints"][0], "Think ears and whiskers.");

    let res = app
        .oneshot(authed_get(&format!("/challenges/{legacy}"), &token))
        .await
        .unwrap();
    let body = body_json(res).await;
    assert_eq!(body["skill_hints"], serde_json::json!([]));
    assert_eq!(body["build_hints"], serde_json::json!([]));
}

/// The mission player reads FLATTENED step fields off ChallengeDetail
/// (brief, design_secret, nature_clues[], skill_lesson_id, completion_xp,
/// emoji) — this pins the mapping from steps[] so the contract can't drift
/// silently again (the Nature-clues white-screen bug).
#[tokio::test]
async fn detail_flattens_step_fields_for_the_player() {
    const STEPS_FLAT: &str = r#"[
  {"step":"brief","title":"Rain!","story":"The picnic is in danger.","image_url":null},
  {"step":"your_idea","prompt":"Idea?","fork_to_step":6},
  {"step":"nature_clues","intro":"Look around",
   "clues":[{"text":"Lotus leaves shed water.","image_url":null,"habitat":"jungle"},
            {"text":"Octopus vanishes into coral.","image_url":null,"habitat":"ocean"}]},
  {"step":"design_secret","secret":"Superhydrophobicity!","reveal_hint":"Think bumpy."},
  {"step":"skill","instructions":"Test surfaces.","skill_refs":["7d8a2f70-0000-0000-0000-000000000001"],
   "hints":["Wax first."]},
  {"step":"sketch","prompt":"Design it.","guidance":"Show drainage."},
  {"step":"build_and_test","instructions":"Pour water.","test_criteria":["Dry?"],"hints":["Small pour first."]},
  {"step":"celebrate_and_share","celebration_text":"Saved!","share_prompt":"Share it!"}
]"#;

    let (pool, _pg) = start_postgres().await;
    let id = insert_challenge(
        &pool,
        "flat-test",
        "Flat Test",
        1,
        1,
        STEPS_FLAT,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;

    let app = router(challenge_state(pool.clone()), None);
    let token = register_and_token(&app, "flat@test.com").await;
    let res = app
        .oneshot(authed_get(&format!("/challenges/{id}"), &token))
        .await
        .unwrap();
    let body = body_json(res).await;

    assert_eq!(body["brief"], "The picnic is in danger.");
    assert_eq!(body["emoji"], "🚀");
    assert_eq!(body["completion_xp"], 20);
    assert_eq!(body["design_secret"], "Superhydrophobicity!");
    assert_eq!(body["design_secret_story"], "Think bumpy.");
    assert_eq!(body["sketch_prompt"], "Design it.");
    assert_eq!(body["sketch_guidance"], "Show drainage.");
    assert_eq!(
        body["skill_instructions"], "Test surfaces.",
        "the skill step's authored instructions flatten onto the player DTO"
    );
    assert_eq!(
        body["skill_lesson_id"], "7d8a2f70-0000-0000-0000-000000000001",
        "first skill_ref becomes the lesson link"
    );

    let clues = body["nature_clues"].as_array().unwrap();
    assert_eq!(clues.len(), 2);
    assert_eq!(clues[0]["emoji"], "🌿");
    assert_eq!(clues[0]["title"], "From the jungle");
    assert_eq!(clues[0]["description"], "Lotus leaves shed water.");
    assert_eq!(clues[0]["xp_reward"], 5);
    assert_eq!(clues[0]["explore_video_id"], Value::Null);
    assert_eq!(clues[1]["emoji"], "🌊");

    // Steps with no skill_refs / empty clues stay safe defaults.
    let res = app_less_challenge(&pool).await;
    assert_eq!(res["nature_clues"], serde_json::json!([]));
    assert_eq!(res["skill_lesson_id"], Value::Null);
}

/// Helper: a legacy-shaped challenge (empty clues, no refs) round-tripped
/// through the detail endpoint.
async fn app_less_challenge(pool: &PgPool) -> Value {
    let id = insert_challenge(
        &pool.clone(),
        "flat-legacy",
        "Flat Legacy",
        1,
        2,
        STEPS_MAX,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;
    let app = router(challenge_state(pool.clone()), None);
    let token = register_and_token(&app, "flat-legacy@test.com").await;
    let res = app
        .oneshot(authed_get(&format!("/challenges/{id}"), &token))
        .await
        .unwrap();
    body_json(res).await
}

// ── Mission story layer ───────────────────────────────────────────────────────

/// The real Season 1 story file for challenge 1 — the same JSON the seed writes.
const STORY_MAX: &str = include_str!("../../../content/stories/help-max-cross-the-river.json");

#[tokio::test]
async fn challenge_detail_includes_the_story_layer() {
    let (pool, _pg) = start_postgres().await;
    let id = insert_challenge(
        &pool,
        "help-max-cross-the-river",
        "Help Max Cross the River",
        1,
        1,
        STEPS_MAX,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;
    let story: Value = serde_json::from_str(STORY_MAX).unwrap();
    sqlx::query("UPDATE challenges SET story = $1 WHERE id = $2")
        .bind(sqlx::types::Json(&story))
        .bind(id)
        .execute(&pool)
        .await
        .unwrap();

    let app = router(challenge_state(pool), None);
    let token = register_and_token(&app, "story@test.com").await;
    let res = app
        .oneshot(authed_get(&format!("/challenges/{id}"), &token))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res).await;

    let s = &body["story"];
    assert_eq!(s["hero"]["name"], "Max");
    assert_eq!(s["opening"].as_array().unwrap().len(), 3);
    assert_eq!(s["chapters"].as_array().unwrap().len(), 9);
    assert_eq!(s["chapters"][5]["step"], "tool");
    assert_eq!(s["tool"]["kind"], "scamper");
    assert_eq!(s["tool"]["parts"].as_array().unwrap().len(), 3);
    assert_eq!(s["sticker"]["name"], "River Crosser");
    // The header emoji comes from the story's hero.
    assert_eq!(body["emoji"], "🎒");
}

#[tokio::test]
async fn challenge_without_a_story_returns_null_story() {
    let (pool, _pg) = start_postgres().await;
    let id = insert_challenge(
        &pool,
        "forest-picnic",
        "Forest Picnic",
        1,
        2,
        STEPS_PICNIC,
        TOOLS_JSON,
        VARIANTS_JSON,
    )
    .await;

    let app = router(challenge_state(pool), None);
    let token = register_and_token(&app, "nostory@test.com").await;
    let res = app
        .oneshot(authed_get(&format!("/challenges/{id}"), &token))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res).await;
    assert!(body["story"].is_null());
    assert_eq!(body["emoji"], "🚀");
}
