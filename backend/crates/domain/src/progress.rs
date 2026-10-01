//! Progress, XP, levels, medals, creative cycle, badges, and analytics domain types.
//!
//! This module is intentionally pure — no IO. All derivation functions are
//! deterministic: replaying the same XpEvent slice always produces the same result.

use chrono::{DateTime, Datelike, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── XP constants ──────────────────────────────────────────────────────────────

pub const XP_EXPLORE: i16 = 5;
pub const XP_LEARN: i16 = 10;
pub const XP_SOLVE: i16 = 20;
pub const XP_CYCLE_BONUS: i16 = 15;
/// Defining a mission's problem with the 5W1H questions (once per mission).
pub const XP_DEFINE_BONUS: i16 = 5;

// ── XP source type ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum XpSourceType {
    Explore,
    Learn,
    Solve,
    CycleBonus,
    DefineBonus,
}

impl XpSourceType {
    pub fn as_str(&self) -> &'static str {
        match self {
            XpSourceType::Explore => "explore",
            XpSourceType::Learn => "learn",
            XpSourceType::Solve => "solve",
            XpSourceType::CycleBonus => "cycle_bonus",
            XpSourceType::DefineBonus => "define_bonus",
        }
    }

    pub fn from_db(s: &str) -> Option<Self> {
        match s {
            "explore" => Some(XpSourceType::Explore),
            "learn" => Some(XpSourceType::Learn),
            "solve" => Some(XpSourceType::Solve),
            "cycle_bonus" => Some(XpSourceType::CycleBonus),
            "define_bonus" => Some(XpSourceType::DefineBonus),
            _ => None,
        }
    }

    pub fn canonical_amount(&self) -> i16 {
        match self {
            XpSourceType::Explore => XP_EXPLORE,
            XpSourceType::Learn => XP_LEARN,
            XpSourceType::Solve => XP_SOLVE,
            XpSourceType::CycleBonus => XP_CYCLE_BONUS,
            XpSourceType::DefineBonus => XP_DEFINE_BONUS,
        }
    }
}

// ── XP ledger entry ───────────────────────────────────────────────────────────

/// An immutable, append-only XP ledger entry.
/// Replaying the full slice of events deterministically reproduces level and rank.
#[derive(Debug, Clone)]
pub struct XpEvent {
    pub id: Uuid,
    pub child_id: Uuid,
    pub source_type: XpSourceType,
    pub source_id: Uuid,
    pub amount: i16,
    pub created_at: DateTime<Utc>,
}

// ── Pure award functions ──────────────────────────────────────────────────────

/// Award +5 XP for a first-time video view. Returns None if already awarded (idempotent).
pub fn award_explore(
    child_id: Uuid,
    video_id: Uuid,
    now: DateTime<Utc>,
    existing: &[XpEvent],
) -> Option<XpEvent> {
    if existing
        .iter()
        .any(|e| e.source_type == XpSourceType::Explore && e.source_id == video_id)
    {
        return None;
    }
    Some(XpEvent {
        id: Uuid::new_v4(),
        child_id,
        source_type: XpSourceType::Explore,
        source_id: video_id,
        amount: XP_EXPLORE,
        created_at: now,
    })
}

/// Award +10 XP for a first-time lesson completion. Returns None if already awarded (idempotent).
pub fn award_learn(
    child_id: Uuid,
    lesson_id: Uuid,
    now: DateTime<Utc>,
    existing: &[XpEvent],
) -> Option<XpEvent> {
    if existing
        .iter()
        .any(|e| e.source_type == XpSourceType::Learn && e.source_id == lesson_id)
    {
        return None;
    }
    Some(XpEvent {
        id: Uuid::new_v4(),
        child_id,
        source_type: XpSourceType::Learn,
        source_id: lesson_id,
        amount: XP_LEARN,
        created_at: now,
    })
}

/// Award +20 XP for a first-time challenge completion. Returns None if already awarded (idempotent).
pub fn award_solve(
    child_id: Uuid,
    challenge_id: Uuid,
    now: DateTime<Utc>,
    existing: &[XpEvent],
) -> Option<XpEvent> {
    if existing
        .iter()
        .any(|e| e.source_type == XpSourceType::Solve && e.source_id == challenge_id)
    {
        return None;
    }
    Some(XpEvent {
        id: Uuid::new_v4(),
        child_id,
        source_type: XpSourceType::Solve,
        source_id: challenge_id,
        amount: XP_SOLVE,
        created_at: now,
    })
}

/// Award +5 XP the first time a kid defines a mission's problem with the 5W1H
/// questions. Returns None if already awarded for this mission (idempotent).
pub fn award_define_bonus(
    child_id: Uuid,
    challenge_id: Uuid,
    now: DateTime<Utc>,
    existing: &[XpEvent],
) -> Option<XpEvent> {
    if existing
        .iter()
        .any(|e| e.source_type == XpSourceType::DefineBonus && e.source_id == challenge_id)
    {
        return None;
    }
    Some(XpEvent {
        id: Uuid::new_v4(),
        child_id,
        source_type: XpSourceType::DefineBonus,
        source_id: challenge_id,
        amount: XP_DEFINE_BONUS,
        created_at: now,
    })
}

/// Award +15 Creative Cycle bonus. `cycle_id` is the creative_cycles row id (unique per week).
pub fn award_cycle_bonus(child_id: Uuid, cycle_id: Uuid, now: DateTime<Utc>) -> XpEvent {
    XpEvent {
        id: Uuid::new_v4(),
        child_id,
        source_type: XpSourceType::CycleBonus,
        source_id: cycle_id,
        amount: XP_CYCLE_BONUS,
        created_at: now,
    }
}

// ── XP total ─────────────────────────────────────────────────────────────────

pub fn xp_total(events: &[XpEvent]) -> i32 {
    events.iter().map(|e| e.amount as i32).sum()
}

// ── Level derivation ─────────────────────────────────────────────────────────

/// XP required to reach each level (index + 1 = level number).
/// Level 2 threshold is intentionally short (15 XP) for fast early progression.
const LEVEL_XP: &[i32] = &[
    0,    // Lv 1
    15,   // Lv 2 — SHORT first ladder
    50,   // Lv 3
    100,  // Lv 4
    200,  // Lv 5
    350,  // Lv 6
    500,  // Lv 7
    750,  // Lv 8
    1000, // Lv 9
    1500, // Lv 10
];

/// Derives the current level from accumulated XP. Caps at level 10.
pub fn level_from_xp(total: i32) -> u32 {
    LEVEL_XP
        .iter()
        .rposition(|&threshold| total >= threshold)
        .map(|i| (i + 1) as u32)
        .unwrap_or(1)
}

// ── Rank ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Rank {
    Explorer,
    Maker,
    Inventor,
    Innovator,
    Master,
    Mentor,
}

impl Rank {
    pub fn as_str(&self) -> &'static str {
        match self {
            Rank::Explorer => "explorer",
            Rank::Maker => "maker",
            Rank::Inventor => "inventor",
            Rank::Innovator => "innovator",
            Rank::Master => "master",
            Rank::Mentor => "mentor",
        }
    }
}

/// Maps level to rank. Explorer(1-2) → Maker(3-4) → Inventor(5-6) → Innovator(7-8) → Master(9) → Mentor(10+).
pub fn rank_from_level(level: u32) -> Rank {
    match level {
        1 | 2 => Rank::Explorer,
        3 | 4 => Rank::Maker,
        5 | 6 => Rank::Inventor,
        7 | 8 => Rank::Innovator,
        9 => Rank::Master,
        _ => Rank::Mentor,
    }
}

// ── Medals ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Medal {
    Bronze,
    Silver,
    Gold,
}

/// Bronze@3, Silver@6, Gold@10 unique activities.
pub fn medal_from_count(count: u32) -> Option<Medal> {
    if count >= 10 {
        Some(Medal::Gold)
    } else if count >= 6 {
        Some(Medal::Silver)
    } else if count >= 3 {
        Some(Medal::Bronze)
    } else {
        None
    }
}

// ── Creative Cycle ────────────────────────────────────────────────────────────

/// Result returned by infra when a cycle activity is recorded.
pub enum CycleActivityResult {
    /// Activity was not relevant (e.g. source_type = CycleBonus).
    NoChange,
    /// Activity recorded; cycle not yet complete.
    ActivityRecorded,
    /// All three activities present this week — bonus was atomically claimed.
    /// Contains the creative_cycles row id to use as source_id for the bonus XP event.
    CycleCompleted(Uuid),
}

/// Pure check: should a cycle bonus be awarded for `(iso_year, iso_week)` given the
/// event slice and the set of weeks that already received the bonus?
pub fn should_award_cycle_bonus(
    iso_year: i32,
    iso_week: u32,
    events: &[XpEvent],
    already_awarded_weeks: &[(i32, u32)],
) -> bool {
    if already_awarded_weeks.contains(&(iso_year, iso_week)) {
        return false;
    }

    let in_week = |e: &XpEvent| -> bool {
        let iw = e.created_at.date_naive().iso_week();
        iw.year() == iso_year && iw.week() == iso_week
    };

    let has_explore = events
        .iter()
        .any(|e| e.source_type == XpSourceType::Explore && in_week(e));
    let has_learn = events
        .iter()
        .any(|e| e.source_type == XpSourceType::Learn && in_week(e));
    let has_solve = events
        .iter()
        .any(|e| e.source_type == XpSourceType::Solve && in_week(e));

    has_explore && has_learn && has_solve
}

// ── Badges ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BadgeCriteria {
    VideoCount { min: u32 },
    LessonCount { min: u32 },
    ChallengeCount { min: u32 },
    CycleCount { min: u32 },
}

impl BadgeCriteria {
    pub fn is_met(&self, explore: u32, learn: u32, solve: u32, cycles: u32) -> bool {
        match self {
            BadgeCriteria::VideoCount { min } => explore >= *min,
            BadgeCriteria::LessonCount { min } => learn >= *min,
            BadgeCriteria::ChallengeCount { min } => solve >= *min,
            BadgeCriteria::CycleCount { min } => cycles >= *min,
        }
    }
}

#[derive(Debug, Clone)]
pub struct BadgeDefinition {
    pub id: Uuid,
    pub slug: String,
    pub name: String,
    pub description: String,
    pub icon_url: String,
    pub criteria: BadgeCriteria,
}

#[derive(Debug, Clone)]
pub struct ChildBadge {
    pub badge_id: Uuid,
    pub badge_slug: String,
    pub badge_name: String,
    pub icon_url: String,
    pub awarded_at: DateTime<Utc>,
}

/// Return badges whose criteria are met and that the child hasn't already earned.
pub fn evaluate_new_badges<'a>(
    all_badges: &'a [BadgeDefinition],
    earned_ids: &[Uuid],
    explore: u32,
    learn: u32,
    solve: u32,
    cycles: u32,
) -> Vec<&'a BadgeDefinition> {
    all_badges
        .iter()
        .filter(|b| !earned_ids.contains(&b.id) && b.criteria.is_met(explore, learn, solve, cycles))
        .collect()
}

// ── Challenge attempts ────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AttemptStatus {
    InProgress,
    Completed,
    Abandoned,
}

impl AttemptStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            AttemptStatus::InProgress => "in_progress",
            AttemptStatus::Completed => "completed",
            AttemptStatus::Abandoned => "abandoned",
        }
    }

    pub fn from_db(s: &str) -> Option<Self> {
        match s {
            "in_progress" => Some(AttemptStatus::InProgress),
            "completed" => Some(AttemptStatus::Completed),
            "abandoned" => Some(AttemptStatus::Abandoned),
            _ => None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ChallengeAttempt {
    pub id: Uuid,
    pub child_id: Uuid,
    pub challenge_id: Uuid,
    pub current_step: i16,
    pub status: AttemptStatus,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

// ── Analytics events ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AnalyticsEventKind {
    VideoViewed {
        video_id: Uuid,
    },
    LessonCompleted {
        lesson_id: Uuid,
    },
    ChallengeStepAdvanced {
        challenge_id: Uuid,
        attempt_id: Uuid,
        from_step: i16,
        to_step: i16,
    },
    ChallengeCompleted {
        challenge_id: Uuid,
        attempt_id: Uuid,
    },
}

impl AnalyticsEventKind {
    pub fn event_type_str(&self) -> &'static str {
        match self {
            AnalyticsEventKind::VideoViewed { .. } => "video_viewed",
            AnalyticsEventKind::LessonCompleted { .. } => "lesson_completed",
            AnalyticsEventKind::ChallengeStepAdvanced { .. } => "challenge_step_advanced",
            AnalyticsEventKind::ChallengeCompleted { .. } => "challenge_completed",
        }
    }
}

#[derive(Debug, Clone)]
pub struct AnalyticsEvent {
    pub id: Uuid,
    pub child_id: Uuid,
    pub kind: AnalyticsEventKind,
    pub created_at: DateTime<Utc>,
}

// ── Progress snapshot ─────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ProgressSnapshot {
    pub xp_total: i32,
    pub level: u32,
    pub rank: Rank,
    pub explore_count: u32,
    pub learn_count: u32,
    pub solve_count: u32,
    pub explore_medal: Option<Medal>,
    pub learn_medal: Option<Medal>,
    pub solve_medal: Option<Medal>,
    pub creative_cycles_completed: u32,
    pub badges: Vec<ChildBadge>,
}

pub fn compute_snapshot(
    events: &[XpEvent],
    explore_count: u32,
    learn_count: u32,
    solve_count: u32,
    cycle_count: u32,
    badges: Vec<ChildBadge>,
) -> ProgressSnapshot {
    let total = xp_total(events);
    let level = level_from_xp(total);
    ProgressSnapshot {
        xp_total: total,
        level,
        rank: rank_from_level(level),
        explore_count,
        learn_count,
        solve_count,
        explore_medal: medal_from_count(explore_count),
        learn_medal: medal_from_count(learn_count),
        solve_medal: medal_from_count(solve_count),
        creative_cycles_completed: cycle_count,
        badges,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    use uuid::Uuid;

    fn evt(child_id: Uuid, src: XpSourceType, amount: i16) -> XpEvent {
        XpEvent {
            id: Uuid::new_v4(),
            child_id,
            source_type: src,
            source_id: Uuid::new_v4(),
            amount,
            created_at: Utc::now(),
        }
    }

    fn evt_at(child_id: Uuid, src: XpSourceType, amount: i16, ts: DateTime<Utc>) -> XpEvent {
        XpEvent {
            id: Uuid::new_v4(),
            child_id,
            source_type: src,
            source_id: Uuid::new_v4(),
            amount,
            created_at: ts,
        }
    }

    #[test]
    fn xp_constants_correct() {
        assert_eq!(XP_EXPLORE, 5);
        assert_eq!(XP_LEARN, 10);
        assert_eq!(XP_SOLVE, 20);
        assert_eq!(XP_CYCLE_BONUS, 15);
    }

    #[test]
    fn xp_total_sums_all_events() {
        let child = Uuid::new_v4();
        let events = vec![
            evt(child, XpSourceType::Explore, XP_EXPLORE),
            evt(child, XpSourceType::Learn, XP_LEARN),
            evt(child, XpSourceType::Solve, XP_SOLVE),
        ];
        assert_eq!(xp_total(&events), 35); // 5 + 10 + 20
    }

    #[test]
    fn xp_total_empty_events_is_zero() {
        assert_eq!(xp_total(&[]), 0);
    }

    #[test]
    fn level_thresholds_short_first_ladder() {
        assert_eq!(level_from_xp(0), 1);
        assert_eq!(level_from_xp(14), 1);
        assert_eq!(level_from_xp(15), 2); // SHORT first ladder
        assert_eq!(level_from_xp(49), 2);
        assert_eq!(level_from_xp(50), 3);
        assert_eq!(level_from_xp(99), 3);
        assert_eq!(level_from_xp(100), 4);
        assert_eq!(level_from_xp(199), 4);
        assert_eq!(level_from_xp(200), 5);
        assert_eq!(level_from_xp(349), 5);
        assert_eq!(level_from_xp(350), 6);
        assert_eq!(level_from_xp(999), 8);
        assert_eq!(level_from_xp(1000), 9);
        assert_eq!(level_from_xp(1499), 9);
        assert_eq!(level_from_xp(1500), 10);
        assert_eq!(level_from_xp(9999), 10); // caps at 10
    }

    #[test]
    fn rank_bands_correct() {
        assert_eq!(rank_from_level(1), Rank::Explorer);
        assert_eq!(rank_from_level(2), Rank::Explorer);
        assert_eq!(rank_from_level(3), Rank::Maker);
        assert_eq!(rank_from_level(4), Rank::Maker);
        assert_eq!(rank_from_level(5), Rank::Inventor);
        assert_eq!(rank_from_level(6), Rank::Inventor);
        assert_eq!(rank_from_level(7), Rank::Innovator);
        assert_eq!(rank_from_level(8), Rank::Innovator);
        assert_eq!(rank_from_level(9), Rank::Master);
        assert_eq!(rank_from_level(10), Rank::Mentor);
        assert_eq!(rank_from_level(100), Rank::Mentor);
    }

    #[test]
    fn medals_at_exact_thresholds() {
        assert!(medal_from_count(0).is_none());
        assert!(medal_from_count(2).is_none());
        assert_eq!(medal_from_count(3), Some(Medal::Bronze));
        assert_eq!(medal_from_count(5), Some(Medal::Bronze));
        assert_eq!(medal_from_count(6), Some(Medal::Silver));
        assert_eq!(medal_from_count(9), Some(Medal::Silver));
        assert_eq!(medal_from_count(10), Some(Medal::Gold));
        assert_eq!(medal_from_count(100), Some(Medal::Gold));
    }

    #[test]
    fn award_explore_idempotent_same_video() {
        let child_id = Uuid::new_v4();
        let video_id = Uuid::new_v4();
        let now = Utc::now();

        let first = award_explore(child_id, video_id, now, &[]).expect("first view awards XP");
        assert_eq!(first.amount, XP_EXPLORE);

        let existing = vec![first];
        let second = award_explore(child_id, video_id, now, &existing);
        assert!(second.is_none(), "same video must not award XP again");
    }

    #[test]
    fn award_explore_different_videos_each_earn_xp() {
        let child_id = Uuid::new_v4();
        let now = Utc::now();
        let vid1 = Uuid::new_v4();
        let vid2 = Uuid::new_v4();

        let e1 = award_explore(child_id, vid1, now, &[]).unwrap();
        let e2 = award_explore(child_id, vid2, now, &[e1]);
        assert!(e2.is_some(), "different video should earn XP");
    }

    #[test]
    fn award_learn_idempotent() {
        let child_id = Uuid::new_v4();
        let lesson_id = Uuid::new_v4();
        let now = Utc::now();

        let first = award_learn(child_id, lesson_id, now, &[]).expect("first completion awards XP");
        let second = award_learn(child_id, lesson_id, now, &[first]);
        assert!(
            second.is_none(),
            "completing same lesson twice must not re-award XP"
        );
    }

    #[test]
    fn award_solve_idempotent() {
        let child_id = Uuid::new_v4();
        let chal_id = Uuid::new_v4();
        let now = Utc::now();

        let first = award_solve(child_id, chal_id, now, &[]).expect("first completion awards XP");
        let second = award_solve(child_id, chal_id, now, &[first]);
        assert!(
            second.is_none(),
            "completing same challenge twice must not re-award XP"
        );
    }

    #[test]
    fn award_define_bonus_once_per_mission() {
        let child_id = Uuid::new_v4();
        let chal_id = Uuid::new_v4();
        let now = Utc::now();

        let first =
            award_define_bonus(child_id, chal_id, now, &[]).expect("first definition awards XP");
        assert_eq!(first.amount, XP_DEFINE_BONUS);
        assert_eq!(first.source_type.as_str(), "define_bonus");
        assert!(award_define_bonus(child_id, chal_id, now, &[first.clone()]).is_none());
        // A different mission earns its own bonus.
        assert!(award_define_bonus(child_id, Uuid::new_v4(), now, &[first]).is_some());
    }

    #[test]
    fn ledger_replay_is_deterministic() {
        let child_id = Uuid::new_v4();
        let now = Utc::now();
        let events = vec![
            evt_at(child_id, XpSourceType::Explore, 5, now),
            evt_at(child_id, XpSourceType::Learn, 10, now),
            evt_at(child_id, XpSourceType::Solve, 20, now),
            evt_at(child_id, XpSourceType::CycleBonus, 15, now),
        ];
        // Replaying identical events always yields identical derivations
        assert_eq!(xp_total(&events), 50);
        assert_eq!(xp_total(&events), 50);
        assert_eq!(level_from_xp(xp_total(&events)), 3);
        assert_eq!(rank_from_level(3), Rank::Maker);
    }

    #[test]
    fn creative_cycle_requires_all_three() {
        let child = Uuid::new_v4();
        let now = Utc::now();
        let iw = now.date_naive().iso_week();
        let year = iw.year();
        let week = iw.week();

        let explore_only = vec![evt(child, XpSourceType::Explore, 5)];
        assert!(!should_award_cycle_bonus(year, week, &explore_only, &[]));

        let mut two = explore_only.clone();
        two.push(evt(child, XpSourceType::Learn, 10));
        assert!(!should_award_cycle_bonus(year, week, &two, &[]));

        let mut all_three = two;
        all_three.push(evt(child, XpSourceType::Solve, 20));
        assert!(should_award_cycle_bonus(year, week, &all_three, &[]));
    }

    #[test]
    fn creative_cycle_idempotent_per_week() {
        let child = Uuid::new_v4();
        let now = Utc::now();
        let iw = now.date_naive().iso_week();
        let year = iw.year();
        let week = iw.week();

        let events = vec![
            evt(child, XpSourceType::Explore, 5),
            evt(child, XpSourceType::Learn, 10),
            evt(child, XpSourceType::Solve, 20),
        ];

        assert!(should_award_cycle_bonus(year, week, &events, &[]));
        // Already awarded for this week → no second bonus
        assert!(!should_award_cycle_bonus(
            year,
            week,
            &events,
            &[(year, week)]
        ));
    }

    #[test]
    fn creative_cycle_different_weeks_each_earn_bonus() {
        let child = Uuid::new_v4();
        // Week 2 of 2026 (Mon Jan 5)
        let w2 = Utc.with_ymd_and_hms(2026, 1, 5, 12, 0, 0).unwrap();
        // Week 3 of 2026 (Mon Jan 12)
        let w3 = Utc.with_ymd_and_hms(2026, 1, 12, 12, 0, 0).unwrap();

        let events = vec![
            evt_at(child, XpSourceType::Explore, 5, w2),
            evt_at(child, XpSourceType::Learn, 10, w2),
            evt_at(child, XpSourceType::Solve, 20, w2),
            evt_at(child, XpSourceType::Explore, 5, w3),
            evt_at(child, XpSourceType::Learn, 10, w3),
            evt_at(child, XpSourceType::Solve, 20, w3),
        ];

        let w2_iw = w2.date_naive().iso_week();
        let w3_iw = w3.date_naive().iso_week();

        // Both weeks should individually qualify
        assert!(should_award_cycle_bonus(
            w2_iw.year(),
            w2_iw.week(),
            &events,
            &[]
        ));
        assert!(should_award_cycle_bonus(
            w3_iw.year(),
            w3_iw.week(),
            &events,
            &[(w2_iw.year(), w2_iw.week())]
        ));
    }

    #[test]
    fn badge_criteria_video_count() {
        let b = BadgeCriteria::VideoCount { min: 3 };
        assert!(!b.is_met(2, 0, 0, 0));
        assert!(b.is_met(3, 0, 0, 0));
        assert!(b.is_met(10, 0, 0, 0));
    }

    #[test]
    fn badge_criteria_cycle_count() {
        let b = BadgeCriteria::CycleCount { min: 1 };
        assert!(!b.is_met(5, 5, 5, 0));
        assert!(b.is_met(0, 0, 0, 1));
    }

    #[test]
    fn evaluate_new_badges_filters_already_earned() {
        let id = Uuid::new_v4();
        let badge = BadgeDefinition {
            id,
            slug: "nature-scout".into(),
            name: "Nature Scout".into(),
            description: String::new(),
            icon_url: String::new(),
            criteria: BadgeCriteria::VideoCount { min: 3 },
        };

        let badges = [badge.clone()];
        let to_award = evaluate_new_badges(&badges, &[], 3, 0, 0, 0);
        assert_eq!(to_award.len(), 1);

        // Already earned — should not surface again
        let badges2 = [badge];
        let already = evaluate_new_badges(&badges2, &[id], 3, 0, 0, 0);
        assert!(already.is_empty());
    }
}
