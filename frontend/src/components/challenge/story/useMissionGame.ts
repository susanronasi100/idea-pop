'use client';

import { useCallback, useEffect, useState } from 'react';

/** Bonus badges every story mission can award. */
export type BadgeKey = 'clue' | 'tool' | 'retry' | 'define';

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
    return { ...EMPTY_GAME, ...(JSON.parse(raw) as Partial<MissionGame>) };
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

  return { game, update, award };
}

/** The `update` callback components receive: a patch, or a function of the
 *  current state returning one. */
export type GameUpdate = (patch: Partial<MissionGame> | ((g: MissionGame) => Partial<MissionGame>)) => void;
