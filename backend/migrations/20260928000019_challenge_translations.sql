-- Kid-facing challenge text in other locales, keyed by language code:
-- {"fa": {"title", "steps", "age_tier_variants", "story"}}. Same shape as the
-- authored English columns, so the one mission player renders either. An
-- empty object means the challenge is English-only.
ALTER TABLE challenges ADD COLUMN translations JSONB NOT NULL DEFAULT '{}'::jsonb;
