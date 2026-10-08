'use client';

import { useCallback, useEffect, useState } from 'react';

/** Bonus badges every story mission can award. */
export type BadgeKey = 'clue' | 'tool' | 'retry' | 'define' | 'solved';

/**
 * The kid's in-mission game state for a story mission: quiz answers, lab and
 * test numbers, tool ideas and earned badges. XP stays server-side (the
 * attempt/step API); this is only the play state, kept on the device so a
 * kid can close the tab and pick up where they were. Private by design:
 * nothing here leaves the browser.
 */
export interface MissionGame {
  quickCheckDone: boolean;
  flipped: number[];
  matched: Record<string, string>;
  matchMissed: boolean;
  predictions: Record<number, number>;
  labPick: number | null;
  lab: Record<number, string>;
  labDone: boolean;
  toolPhase: 0 | 1 | 2;
  seen: number[];
  toolAnswers: Record<string, string>;
  favourite: string | null;
  sketchChecks: number[];
  round1: number;
  round2: number;
  check: string | null;
  change: string;
  reflection: string | null;
  badges: BadgeKey[];
  /** The kid's 5W1H answers defining the problem, keyed by prompt (who, what…). */
  defineAnswers: Record<string, string>;
  /** The 5W1H questions answered so far, in order (they open one by one). */
  defineDone: string[];
}

export const EMPTY_GAME: MissionGame = {
  quickCheckDone: false,
  flipped: [],
  matched: {},
  matchMissed: false,
  predictions: {},
  labPick: null,
  lab: {},
  labDone: false,
  toolPhase: 0,
  seen: [],
  toolAnswers: {},
  favourite: null,
  sketchChecks: [],
  round1: 0,
  round2: 0,
  check: null,
  change: '',
  reflection: null,
  badges: [],
  defineAnswers: {},
  defineDone: [],
};

function storageKey(challengeId: string) {
  return `missionGame_${challengeId}`;
}

function load(challengeId: string): MissionGame {
  try {
    const raw = localStorage.getItem(storageKey(challengeId));
    if (!raw) return EMPTY_GAME;
    // For now every visit opens the mission fresh (susan, 2026-10-08): only the earned
    // badges carry over, so one-time bonuses are not replayed. Before merging, answers will be
    // saved to the kid's account and earlier tries kept (see the kid-work-must-be-saved rule).
    const saved = JSON.parse(raw) as Partial<MissionGame>;
    return { ...EMPTY_GAME, badges: saved.badges ?? [] };
  } catch {
    return EMPTY_GAME;
  }
}

export function useMissionGame(challengeId: string) {
  const [game, setGame] = useState<MissionGame>(EMPTY_GAME);

  useEffect(() => {
    setGame(load(challengeId));
  }, [challengeId]);

  const update = useCallback(
    (patch: Partial<MissionGame> | ((g: MissionGame) => Partial<MissionGame>)) => {
      setGame((prev) => {
        const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
        try {
          localStorage.setItem(storageKey(challengeId), JSON.stringify(next));
        } catch {
          // storage blocked — the mission still plays, it just won't resume
        }
        return next;
      });
    },
    [challengeId],
  );

  const award = useCallback(
    (badge: BadgeKey) =>
      update((g) => (g.badges.includes(badge) ? {} : { badges: [...g.badges, badge] })),
    [update],
  );

  /** Start the mission over: every answer is cleared. Earned badges stay, so the
   *  one-time bonuses (and their celebrations) aren't replayed for nothing. */
  const reset = useCallback(() => {
    setGame((prev) => {
      const next = { ...EMPTY_GAME, badges: prev.badges };
      try {
        localStorage.setItem(storageKey(challengeId), JSON.stringify(next));
      } catch {
        // storage blocked — the reset still applies for this visit
      }
      return next;
    });
  }, [challengeId]);

  return { game, update, award, reset };
}

/** The `update` callback components receive: a patch, or a function of the
 *  current state returning one. */
export type GameUpdate = (patch: Partial<MissionGame> | ((g: MissionGame) => Partial<MissionGame>)) => void;
