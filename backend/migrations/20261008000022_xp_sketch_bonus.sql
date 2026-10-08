-- A one-time bonus for solving a mission's problem with a first sketched idea
-- (the "you solved it!" moment after the Sketch step). Keyed by challenge id, so
-- the (child, source_type, source_id) unique index keeps it once per mission.
ALTER TABLE xp_events DROP CONSTRAINT IF EXISTS xp_events_source_type_check;
ALTER TABLE xp_events ADD CONSTRAINT xp_events_source_type_check
    CHECK (source_type IN ('explore','learn','solve','cycle_bonus','define_bonus','sketch_bonus'));
