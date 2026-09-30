import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// API route mocks shared across tests
// ---------------------------------------------------------------------------

async function mockApis(page: Page) {
  await page.route("**/api/auth/register", (route) => {
    route.fulfill({ status: 201 });
  });
  await page.route("**/api/auth/login", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "tok",
        token_type: "Bearer",
        expires_in: 3600,
      }),
    });
  });
  await page.route("**/api/children", (route) => {
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: "child-1", access_token: "tok-kid" }),
    });
  });
  await page.route("**/api/classes", (route) => {
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "class-1",
        class_code: "IDEA-XYZ1",
        name: "Year 5",
      }),
    });
  });
  await page.route("**/api/consent/verify", (route) => {
    route.fulfill({ status: 200 });
  });
}

async function setPersonaCookie(page: Page, persona: string) {
  await page.context().addCookies([
    { name: "ideapop_persona", value: persona, domain: "localhost", path: "/" },
  ]);
}

// ---------------------------------------------------------------------------
// 1. Kid persona flow
// ---------------------------------------------------------------------------

test.describe("Kid signup flow", () => {
  test("kid persona select → wizard → restricted dashboard", async ({
    page,
  }) => {
    await page.goto("/en/sign-up");
    await expect(page.getByTestId("persona-select")).toBeVisible();

    await page.getByRole("button", { name: /kid/i }).click();

    await page.waitForURL(/onboarding\/kid/, { timeout: 5000 });
    await expect(page.getByTestId("kid-wizard")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Parent persona flow
// ---------------------------------------------------------------------------

test.describe("Parent signup flow", () => {
  test("clicking I'm a parent goes to /sign-up/parent with RegisterForm", async ({
    page,
  }) => {
    await page.goto("/en/sign-up");
    await expect(page.getByTestId("persona-select")).toBeVisible();

    await page.getByRole("button", { name: /parent/i }).click();

    await page.waitForURL(/sign-up\/parent/, { timeout: 5000 });
    await expect(page.getByTestId("register-form")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3. Teacher persona flow
// ---------------------------------------------------------------------------

test.describe("Teacher signup flow", () => {
  test("clicking I'm a teacher goes to /sign-up/teacher with RegisterForm", async ({
    page,
  }) => {
    await page.goto("/en/sign-up");
    await expect(page.getByTestId("persona-select")).toBeVisible();

    await page.getByRole("button", { name: /teacher/i }).click();

    await page.waitForURL(/sign-up\/teacher/, { timeout: 5000 });
    await expect(page.getByTestId("register-form")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. "Already have an account?" link
// ---------------------------------------------------------------------------

test.describe("Sign-up page login link", () => {
  test('"Already have an account?" link navigates to /login', async ({
    page,
  }) => {
    await page.goto("/en/sign-up");
    await expect(page.getByTestId("persona-select")).toBeVisible();

    await page.getByRole("link", { name: /log in/i }).click();

    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toContain("/login");
  });
});

// ---------------------------------------------------------------------------
// 5. Login page renders
// ---------------------------------------------------------------------------

test.describe("Login page", () => {
  test("login page renders LoginForm", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.getByTestId("login-form")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 6. Marketing sign-up CTA → the persona step
// ---------------------------------------------------------------------------

test.describe("Marketing to sign-up integration", () => {
  test('the nav\'s "Sign up for free" opens the persona step', async ({ page }) => {
    await page.goto("/en");

    // The redesigned hero CTAs are "Start Exploring" / "Start a simple
    // challenge"; the sign-up entry point is the lime button in the nav. It
    // opens the persona step over the page rather than loading /sign-up.
    const nav = page.getByTestId("marketing-nav");
    const startLink = nav.getByRole("link", { name: /sign up for free/i }).first();
    await expect(startLink).toBeVisible();
    await startLink.click();

    await expect(page.getByTestId("sign-up-overlay")).toBeVisible();
    expect(page.url()).not.toContain("/sign-up");
  });
});

// ---------------------------------------------------------------------------
// 7. Kid wizard step navigation
// ---------------------------------------------------------------------------

test.describe("Kid wizard", () => {
  test("avatar grid visible → select avatar → click Next → nickname step", async ({
    page,
  }) => {
    await page.goto("/en/onboarding/kid");
    await expect(page.getByTestId("kid-wizard")).toBeVisible();
    await expect(page.getByTestId("avatar-grid")).toBeVisible();

    // Select the first avatar
    const avatars = page.getByTestId("avatar-grid").getByRole("button");
    await avatars.first().click();

    // Click Next
    await page.getByRole("button", { name: /next/i }).click();

    // Avatar grid should be gone; nickname input should be visible
    await expect(page.getByTestId("avatar-grid")).not.toBeVisible();
    await expect(
      page.getByRole("textbox", { name: /nickname/i })
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 8. Kid dashboard shows restricted banner (with persona cookie)
// ---------------------------------------------------------------------------

test.describe("Kid dashboard", () => {
  test("shows restricted banner when persona cookie is set to kid", async ({
    page,
  }) => {
    await setPersonaCookie(page, "kid");
    await page.goto("/en/dashboard/kid");
    await expect(page.getByTestId("restricted-banner")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 9. Kid dashboard pricing → parent handoff modal (NOT checkout)
  // -------------------------------------------------------------------------

  test("pricing section visible; upgrade triggers parent handoff modal", async ({
    page,
  }) => {
    await setPersonaCookie(page, "kid");
    await page.goto("/en/dashboard/kid");

    await expect(page.getByTestId("pricing-section")).toBeVisible();

    // Click the upgrade / start-trial button inside the pricing section
    const upgradeBtn = page
      .getByTestId("pricing-section")
      .getByRole("button")
      .first();
    await upgradeBtn.click();

    await expect(page.getByTestId("parent-handoff-modal")).toBeVisible();
  });

  test("dismissing parent handoff modal closes it", async ({ page }) => {
    await setPersonaCookie(page, "kid");
    await page.goto("/en/dashboard/kid");

    const upgradeBtn = page
      .getByTestId("pricing-section")
      .getByRole("button")
      .first();
    await upgradeBtn.click();

    await expect(page.getByTestId("parent-handoff-modal")).toBeVisible();

    // Dismiss via close/cancel button
    await page
      .getByTestId("parent-handoff-modal")
      .getByRole("button", { name: /close|dismiss|cancel/i })
      .click();

    await expect(page.getByTestId("parent-handoff-modal")).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 10. Consent page renders
// ---------------------------------------------------------------------------

test.describe("Consent page", () => {
  test("consent page with token renders grant button", async ({ page }) => {
    await mockApis(page);
    await page.goto("/en/consent/test-token-123?nickname=Sofia");
    await expect(page.getByTestId("consent-page")).toBeVisible();
    await expect(page.getByTestId("consent-grant-btn")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 11. Middleware redirects unauthenticated users from /dashboard
// ---------------------------------------------------------------------------

test.describe("Auth middleware", () => {
  test("unauthenticated user accessing /dashboard/parent is redirected to /sign-up", async ({
    page,
  }) => {
    // Ensure no persona cookie is present
    await page.context().clearCookies();
    await page.goto("/en/dashboard/parent");

    await page.waitForURL(/sign-up/, { timeout: 5000 });
    expect(page.url()).toContain("/sign-up");
  });
});

// ---------------------------------------------------------------------------
// 12. Teacher onboarding: create class → code display
// ---------------------------------------------------------------------------

test.describe("Teacher onboarding", () => {
  test("fill class name and submit → class code display appears", async ({
    page,
  }) => {
    await mockApis(page);
    await setPersonaCookie(page, "teacher");
    await page.goto("/en/onboarding/teacher");
    await expect(page.getByTestId("teacher-onboarding")).toBeVisible();

    const classNameInput = page.getByRole("textbox", { name: /class name/i });
    await classNameInput.fill("Year 5");

    await page.getByRole("button", { name: /create|next|submit/i }).click();

    await expect(page.getByTestId("class-code-display")).toBeVisible();
  });
});
