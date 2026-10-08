import { test, expect } from '@playwright/test';

// ── Mock challenge data ──────────────────────────────────────────────────────

const RIVER_CHALLENGE = {
  id: 'c-river',
  title: 'Help Max Cross The River',
  slug: 'max-cross-river',
  brief: 'Max needs to get across the river but there is no bridge. Can you build one?',
  emoji: '🌉',
  nature_clues: [
    {
      title: 'Living ant bridges!',
      description: 'Army ants lock claws to form living bridges.',
      explore_video_id: 'v-ant',
      emoji: '🐜',
      xp_reward: 5,
    },
    {
      title: 'Beaver dams',
      description: 'Beavers weave sticks to block water flow.',
      explore_video_id: 'v-beaver',
      emoji: '🦫',
      xp_reward: 5,
    },
  ],
  design_secret: 'Many small things holding together = one STRONG thing!',
  design_secret_story: 'Annie and her ant friends linked claws across a gap…',
  skill_lesson_id: 'lesson-bridges',
  related_explore_ids: ['v-ant', 'v-beaver'],
  completion_xp: 20,
};

const PICNIC_CHALLENGE = {
  id: 'c-picnic',
  title: 'Plan the Perfect Picnic',
  slug: 'perfect-picnic',
  brief: 'Design a shelter that keeps food dry in the rain.',
  emoji: '🧺',
  nature_clues: [
    {
      title: "Lotus leaf's waterproof surface",
      description: 'The lotus leaf has microscopic bumps that repel water.',
      explore_video_id: null,
      emoji: '🌸',
      xp_reward: 5,
    },
  ],
  design_secret: 'Tiny bumps on surfaces make water bead and roll away!',
  design_secret_story: null,
  skill_lesson_id: null,
  related_explore_ids: [],
  completion_xp: 20,
};

const MOCK_ATTEMPT = {
  id: 'a-1',
  challenge_id: 'c-river',
  step: 1,
  started_at: '2026-06-27T00:00:00Z',
};

const MOCK_XP = {
  xp_earned: 5,
  xp_total: 50,
  level: 1,
  rank: 'Explorer',
  is_new: false,
  cycle_bonus_earned: false,
};

const MOCK_PROJECT = {
  id: 'proj-1',
  title: 'My bridge',
  visibility: 'private',
  created_at: '2026-06-27T00:00:00Z',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockChallengeRoutes(
  page: import('@playwright/test').Page,
  challenge: typeof RIVER_CHALLENGE,
) {
  page.route('**/api/challenges/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (method === 'POST' && url.includes('/attempt')) {
      await route.fulfill({ json: MOCK_ATTEMPT, status: 201 });
    } else if (method === 'GET') {
      await route.fulfill({ json: challenge, status: 200 });
    } else {
      await route.continue();
    }
  });

  page.route('**/api/attempts/**', async (route) => {
    await route.fulfill({ json: MOCK_XP, status: 200 });
  });

  page.route('**/api/projects', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: MOCK_PROJECT, status: 201 });
    } else {
      await route.continue();
    }
  });
}

async function setYoungProfile(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.setItem('kidProfile', JSON.stringify({ birth_year: 2015, nickname: 'Max' }));
  });
}

async function setOlderProfile(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.setItem('kidProfile', JSON.stringify({ birth_year: 2009, nickname: 'Alex' }));
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Phase 11a — Challenge Stepper', () => {
  test('1 · river challenge renders from data (step 1 brief)', async ({ page }) => {
    mockChallengeRoutes(page, RIVER_CHALLENGE);
    await page.goto('/en/app/challenges/c-river');

    await expect(page.locator('[data-testid="challenge-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="mission-hud"]')).toBeVisible();
    await expect(page.locator('[data-testid="step-brief"]')).toBeVisible();
    await expect(page.getByText("Help Max Cross The River")).toBeVisible();
    await expect(page.getByText("+20 XP")).toBeVisible();
  });

  test('2 · picnic challenge renders a completely different mission from data alone', async ({ page }) => {
    mockChallengeRoutes(page, PICNIC_CHALLENGE);
    await page.goto('/en/app/challenges/c-picnic');

    await expect(page.locator('[data-testid="step-brief"]')).toBeVisible();
    await expect(page.getByText("Plan the Perfect Picnic")).toBeVisible();
    await expect(page.getByText("shelter")).toBeVisible();
    // Zero code change — same stepper, different data
  });

  test('3 · idea fork YES routes to step 4 (sketch)', async ({ page }) => {
    mockChallengeRoutes(page, RIVER_CHALLENGE);
    await page.goto('/en/app/challenges/c-river');

    // Advance to step 2
    await page.locator('[data-testid="step-brief"]').getByRole('button', { name: /Let's go/i }).click();
    await expect(page.locator('[data-testid="step-idea-fork"]')).toBeVisible();

    // Choose YES → should jump to step 4 (sketch)
    await page.locator('[data-testid="idea-yes"]').click();
    await expect(page.locator('[data-testid="step-sketch"]')).toBeVisible();
    // Nature clues (step 3) stays reachable via the mission menu (not a dead end)
    await page.locator('[data-testid="mission-menu-button"]').click();
    await expect(page.locator('[data-testid="mission-step-3"]')).toBeVisible();
  });

  test('4 · idea fork NO routes through nature clues to the sketch (3→4)', async ({ page }) => {
    mockChallengeRoutes(page, RIVER_CHALLENGE);
    await page.goto('/en/app/challenges/c-river');

    // Step 1 → 2
    await page.locator('[data-testid="step-brief"]').getByRole('button', { name: /Let's go/i }).click();
    await expect(page.locator('[data-testid="step-idea-fork"]')).toBeVisible();

    // Choose No
    await page.locator('[data-testid="idea-no"]').click();
    await expect(page.locator('[data-testid="step-nature-clues"]')).toBeVisible();

    // Step 3 → 4: after the clues, the kid sketches their idea
    await page.getByRole('button', { name: /sketch my idea/i }).click();
    await expect(page.locator('[data-testid="step-sketch"]')).toBeVisible();
  });

  test('5 · mission menu allows jumping to any reached step (reversible)', async ({ page }) => {
    mockChallengeRoutes(page, RIVER_CHALLENGE);
    await page.goto('/en/app/challenges/c-river');

    // Advance to step 2
    await page.locator('[data-testid="step-brief"]').getByRole('button', { name: /Let's go/i }).click();
    await expect(page.locator('[data-testid="step-idea-fork"]')).toBeVisible();

    // Open mission menu — step 1 should be reachable
    await page.locator('[data-testid="mission-menu-button"]').click();
    await expect(page.locator('[data-testid="mission-menu"]')).toBeVisible();

    // Jump back to step 1
    await page.locator('[data-testid="mission-step-1"]').click();
    await expect(page.locator('[data-testid="step-brief"]')).toBeVisible();
  });

  test('6 · completing a challenge → XP burst + step 8 (celebrate)', async ({ page }) => {
    mockChallengeRoutes(page, RIVER_CHALLENGE);
    await setOlderProfile(page);
    await page.goto('/en/app/challenges/c-river');

    // Navigate to step 6 via YES fork
    await page.locator('[data-testid="step-brief"]').getByRole('button', { name: /Let's go/i }).click();
    await page.locator('[data-testid="idea-yes"]').click();
    await expect(page.locator('[data-testid="step-sketch"]')).toBeVisible();

    // Fill in sketch capture card
    await page.locator('[data-testid="field-title"]').fill('My rope bridge');
    await page.locator('[data-testid="field-used"]').fill('rope, sticks');
    await page.locator('[data-testid="capture-submit"]').click();

    // Should be at step 7 now
    await expect(page.locator('[data-testid="step-build"]')).toBeVisible();

    // Fill in build
    await page.locator('[data-testid="field-title"]').fill('Finished rope bridge');
    await page.locator('[data-testid="field-used"]').fill('rope, sticks, tape');
    await page.locator('[data-testid="capture-submit"]').click();

    // Step 8: celebrate
    await expect(page.locator('[data-testid="step-celebrate"]')).toBeVisible();
    await expect(page.locator('[data-testid="celebrate-xp"]')).toContainText('+20');

    // XP burst should appear
    await expect(page.locator('[data-testid="xp-burst"]')).toBeVisible();
  });

  test('7 · analytics: advanceStep called on each step transition', async ({ page }) => {
    const stepAdvanceCalls: number[] = [];

    await page.route('**/api/challenges/**', async (route) => {
      const method = route.request().method();
      if (method === 'POST') await route.fulfill({ json: MOCK_ATTEMPT, status: 201 });
      else await route.fulfill({ json: RIVER_CHALLENGE, status: 200 });
    });

    await page.route('**/api/attempts/**', async (route) => {
      const body = await route.request().postDataJSON();
      stepAdvanceCalls.push(body.step);
      await route.fulfill({ json: MOCK_XP, status: 200 });
    });

    await page.route('**/api/projects', async (route) => {
      await route.fulfill({ json: MOCK_PROJECT, status: 201 });
    });

    await page.goto('/en/app/challenges/c-river');

    // Advance: step 1 → 2
    await page.locator('[data-testid="step-brief"]').getByRole('button', { name: /Let's go/i }).click();
    await expect(page.locator('[data-testid="step-idea-fork"]')).toBeVisible();

    // Advance: step 2 → 3
    await page.locator('[data-testid="idea-no"]').click();
    await expect(page.locator('[data-testid="step-nature-clues"]')).toBeVisible();

    // Analytics fired for steps 2 and 3
    expect(stepAdvanceCalls).toContain(2);
    expect(stepAdvanceCalls).toContain(3);
  });

  test('8 · older mode shows design secret story; young mode hides it', async ({ page }) => {
    mockChallengeRoutes(page, RIVER_CHALLENGE);

    // Older mode
    await setOlderProfile(page);
    await page.goto('/en/app/challenges/c-river');

    // Navigate to design secret step via NO fork
    await page.locator('[data-testid="step-brief"]').getByRole('button', { name: /Let's go/i }).click();
    await page.locator('[data-testid="idea-no"]').click();
    await page.getByRole('button', { name: /show me the secret/i }).click();

    await expect(page.locator('[data-testid="step-design-secret"]')).toBeVisible();
    // Story text should be visible for older mode (RIVER_CHALLENGE has design_secret_story)
    await expect(page.getByText('Annie and her ant friends')).toBeVisible();

    // Young mode — reload
    await setYoungProfile(page);
    await page.reload();
    await page.locator('[data-testid="step-brief"]').getByRole('button', { name: /Let's go/i }).click();
    await page.locator('[data-testid="idea-no"]').click();
    await page.getByRole('button', { name: /show me the secret/i }).click();
    // Story hidden for young mode
    await expect(page.getByText('Annie and her ant friends')).not.toBeVisible();
  });
});    // Step 3 → 4: after the clues, the kid sketches their idea
    await page.getByRole('button', { name: /sketch my idea/i }).click();
    await expect(page.locator('[data-testid="step-sketch"]')).toBeVisible();
  });

  page.route('**/api/attempts/**', async (route) => {
    await route.fulfill({ json: MOCK_XP, status: 200 });
  });

  page.route('**/api/projects', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: MOCK_PROJECT, status: 201 });
    } else {
      await route.continue();
    }
  });
}

async function setYoungProfile(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.setItem('kidProfile', JSON.stringify({ birth_year: 2015, nickname: 'Max' }));
  });
}

async function setOlderProfile(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.setItem('kidProfile', JSON.stringify({ birth_year: 2009, nickname: 'Alex' }));
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Phase 11a — Challenge Stepper', () => {
  test('1 · river challenge renders from data (step 1 brief)', async ({ page }) => {
    mockChallengeRoutes(page, RIVER_CHALLENGE);
    await page.goto('/en/app/challenges/c-river');

    await expect(page.locator('[data-testid="challenge-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="mission-hud"]')).toBeVisible();
    await expect(page.locator('[data-testid="step-brief"]')).toBeVisible();
    await expect(page.getByText("Help Max Cross The River")).toBeVisible();
    await expect(page.getByText("+20 XP")).toBeVisible();
  });

  test('2 · picnic challenge renders a completely different mission from data alone', async ({ page }) => {
    mockChallengeRoutes(page, PICNIC_CHALLENGE);
    await page.goto('/en/app/challenges/c-picnic');

    await expect(page.locator('[data-testid="step-brief"]')).toBeVisible();
    await expect(page.getByText("Plan the Perfect Picnic")).toBeVisible();
    await expect(page.getByText("shelter")).toBeVisible();
    // Zero code change — same stepper, different data
  });

  test('3 · idea fork YES routes to step 4 (sketch)', async ({ page }) => {
    mockChallengeRoutes(page, RIVER_CHALLENGE);
    await page.goto('/en/app/challenges/c-river');

    // Advance to step 2
    await page.locator('[data-testid="step-brief"]').getByRole('button', { name: /Let's go/i }).click();
    await expect(page.locator('[data-testid="step-idea-fork"]')).toBeVisible();

    // Choose YES → should jump to step 4 (sketch)
    await page.locator('[data-testid="idea-yes"]').click();
    await expect(page.locator('[data-testid="step-sketch"]')).toBeVisible();
    // Nature clues (step 3) stays reachable via the mission menu (not a dead end)
    await page.locator('[data-testid="mission-menu-button"]').click();
    await expect(page.locator('[data-testid="mission-step-3"]')).toBeVisible();
  });

  test('4 · idea fork NO routes through nature clues to the sketch (3→4)', async ({ page }) => {
    mockChallengeRoutes(page, RIVER_CHALLENGE);
    await page.goto('/en/app/challenges/c-river');

    // Step 1 → 2
    await page.locator('[data-testid="step-brief"]').getByRole('button', { name: /Let's go/i }).click();
    await expect(page.locator('[data-testid="step-idea-fork"]')).toBeVisible();

    // Choose No
    await page.locator('[data-testid="idea-no"]').click();
    await expect(page.locator('[data-testid="step-nature-clues"]')).toBeVisible();

    // Step 3 → 4: after the clues, the kid sketches their idea
    await page.getByRole('button', { name: /sketch my idea/i }).click();
    await expect(page.locator('[data-testid="step-sketch"]')).toBeVisible();
  });

  test('5 · mission menu allows jumping to any reached step (reversible)', async ({ page }) => {
    mockChallengeRoutes(page, RIVER_CHALLENGE);
    await page.goto('/en/app/challenges/c-river');

    // Advance to step 2
    await page.locator('[data-testid="step-brief"]').getByRole('button', { name: /Let's go/i }).click();
    await expect(page.locator('[data-testid="step-idea-fork"]')).toBeVisible();

    // Open mission menu — step 1 should be reachable
    await page.locator('[data-testid="mission-menu-button"]').click();
    await expect(page.locator('[data-testid="mission-menu"]')).toBeVisible();

    // Jump back to step 1
    await page.locator('[data-testid="mission-step-1"]').click();
    await expect(page.locator('[data-testid="step-brief"]')).toBeVisible();
  });

  test('6 · completing a challenge → XP burst + step 8 (celebrate)', async ({ page }) => {
    mockChallengeRoutes(page, RIVER_CHALLENGE);
    await setOlderProfile(page);
    await page.goto('/en/app/challenges/c-river');

    // Navigate to step 6 via YES fork
    await page.locator('[data-testid="step-brief"]').getByRole('button', { name: /Let's go/i }).click();
    await page.locator('[data-testid="idea-yes"]').click();
    await expect(page.locator('[data-testid="step-sketch"]')).toBeVisible();

    // Fill in sketch capture card
    await page.locator('[data-testid="field-title"]').fill('My rope bridge');
    await page.locator('[data-testid="field-used"]').fill('rope, sticks');
    await page.locator('[data-testid="capture-submit"]').click();

    // Should be at step 7 now
    await expect(page.locator('[data-testid="step-build"]')).toBeVisible();

    // Fill in build
    await page.locator('[data-testid="field-title"]').fill('Finished rope bridge');
    await page.locator('[data-testid="field-used"]').fill('rope, sticks, tape');
    await page.locator('[data-testid="capture-submit"]').click();

    // Step 8: celebrate
    await expect(page.locator('[data-testid="step-celebrate"]')).toBeVisible();
    await expect(page.locator('[data-testid="celebrate-xp"]')).toContainText('+20');

    // XP burst should appear
    await expect(page.locator('[data-testid="xp-burst"]')).toBeVisible();
  });

  test('7 · analytics: advanceStep called on each step transition', async ({ page }) => {
    const stepAdvanceCalls: number[] = [];

    await page.route('**/api/challenges/**', async (route) => {
      const method = route.request().method();
      if (method === 'POST') await route.fulfill({ json: MOCK_ATTEMPT, status: 201 });
      else await route.fulfill({ json: RIVER_CHALLENGE, status: 200 });
    });

    await page.route('**/api/attempts/**', async (route) => {
      const body = await route.request().postDataJSON();
      stepAdvanceCalls.push(body.step);
      await route.fulfill({ json: MOCK_XP, status: 200 });
    });

    await page.route('**/api/projects', async (route) => {
      await route.fulfill({ json: MOCK_PROJECT, status: 201 });
    });

    await page.goto('/en/app/challenges/c-river');

    // Advance: step 1 → 2
    await page.locator('[data-testid="step-brief"]').getByRole('button', { name: /Let's go/i }).click();
    await expect(page.locator('[data-testid="step-idea-fork"]')).toBeVisible();

    // Advance: step 2 → 3
    await page.locator('[data-testid="idea-no"]').click();
    await expect(page.locator('[data-testid="step-nature-clues"]')).toBeVisible();

    // Analytics fired for steps 2 and 3
    expect(stepAdvanceCalls).toContain(2);
    expect(stepAdvanceCalls).toContain(3);
  });

  test('8 · older mode shows design secret story; young mode hides it', async ({ page }) => {
    mockChallengeRoutes(page, RIVER_CHALLENGE);

    // Older mode
    await setOlderProfile(page);
    await page.goto('/en/app/challenges/c-river');

    // Navigate to design secret step via NO fork
    await page.locator('[data-testid="step-brief"]').getByRole('button', { name: /Let's go/i }).click();
    await page.locator('[data-testid="idea-no"]').click();
    await page.getByRole('button', { name: /show me the secret/i }).click();

    await expect(page.locator('[data-testid="step-design-secret"]')).toBeVisible();
    // Story text should be visible for older mode (RIVER_CHALLENGE has design_secret_story)
    await expect(page.getByText('Annie and her ant friends')).toBeVisible();

    // Young mode — reload
    await setYoungProfile(page);
    await page.reload();
    await page.locator('[data-testid="step-brief"]').getByRole('button', { name: /Let's go/i }).click();
    await page.locator('[data-testid="idea-no"]').click();
    await page.getByRole('button', { name: /show me the secret/i }).click();
    // Story hidden for young mode
    await expect(page.getByText('Annie and her ant friends')).not.toBeVisible();
  });
});
