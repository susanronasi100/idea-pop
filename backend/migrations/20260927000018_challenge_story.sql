-- Mission story: the storytelling + gamified-instructor layer (Story Spine
-- chapters, Popi's lines, per-step games). JSONB like steps/tools, so new
-- stories need no schema change. NULL = the mission plays the classic way.
ALTER TABLE challenges ADD COLUMN story JSONB;
