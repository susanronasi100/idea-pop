import type { components } from '@/lib/api/schema';

export type MissionStory = components['schemas']['MissionStory'];
export type ChallengeDetail = components['schemas']['ChallengeDetail'];

/** Play-order keys a chapter belongs to (mirrors backend CHAPTER_STEPS). */
export type ChapterStep =
  | 'brief'
  | 'your_idea'
  | 'nature_clues'
  | 'design_secret'
  | 'skill'
  | 'tool'
  | 'sketch'
  | 'build_and_test'
  | 'celebrate_and_share';

export function chapterFor(story: MissionStory, step: ChapterStep) {
  return story.chapters.find((c) => c.step === step) ?? null;
}
