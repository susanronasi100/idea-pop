-- A one-time bonus for defining a mission's problem with the 5W1H questions
-- (Who, What, Where, When, Why, How). Keyed by challenge id, so the existing
-- (child, source_type, source_id) unique index keeps it once per mission.
ALTER TABLE xp_events DROP CONSTRAINT IF EXISTS xp_events_source_type_check;
ALTER TABLE xp_events ADD CONSTRAINT xp_events_source_type_check
    CHECK (source_type IN ('explore','learn','solve','cycle_bonus','define_bonus'));
