import { test, expect } from '@playwright/test';

test.describe('Marketing landing page', () => {
  test('visitor lands on homepage and sees hero', async ({ page }) => {
    await page.goto('/en');
    await expect(page).toHaveTitle(/Idea Pop/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ask nature');
  });

  test('the sign-up button opens the persona overlay over the page', async ({ page }) => {
    await page.goto('/en');
    // The redesigned hero CTAs are "Start Exploring" / "Start a simple
    // challenge"; the sign-up entry point is the lime button in the nav. It now
    // opens the persona step over the page instead of loading /sign-up.
    const nav = page.getByTestId('marketing-nav');
    const startLink = nav.getByRole('link', { name: /sign up for free/i }).first();
    await expect(startLink).toBeVisible();
    await startLink.click();
    const overlay = page.getByTestId('sign-up-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.getByRole('button', { name: /kid/i })).toBeVisible();
    expect(page.url()).not.toContain('/sign-up');
    // Escape closes it and leaves the visitor where they were.
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
  });

  test('the steps after the choice stay in the overlay', async ({ page }) => {
    await page.goto('/en');
    const nav = page.getByTestId('marketing-nav');
    await nav.getByRole('link', { name: /sign up for free/i }).first().click();
    const overlay = page.getByTestId('sign-up-overlay');
    await expect(overlay).toHaveAttribute('data-step', 'persona');

    // A kid goes on to the four steps without leaving the page they were reading.
    await overlay.locator('[data-persona="kid"]').click();
    await expect(overlay).toHaveAttribute('data-step', 'kid');
    await expect(overlay.getByTestId('kid-wizard')).toBeVisible();
    expect(page.url()).not.toContain('/onboarding');

    // The first step's "before" goes back to the choice rather than loading a page.
    await overlay.getByTestId('step-1').getByRole('button').nth(-2).click();
    await expect(overlay).toHaveAttribute('data-step', 'persona');

    // A parent gets their form in the same panel, and the cross cancels the whole thing.
    await overlay.locator('[data-persona="parent"]').click();
    await expect(overlay.getByTestId('register-form')).toBeVisible();
    expect(page.url()).not.toContain('/sign-up');
    await overlay.getByRole('button').first().click();
    await expect(overlay).toBeHidden();
  });

  test('logging in opens in place, and the class code is a way of its own', async ({ page }) => {
    await page.goto('/en');
    const nav = page.getByTestId('marketing-nav');
    await nav.getByRole('link', { name: 'Log in', exact: true }).click();
    const overlay = page.getByTestId('sign-up-overlay');
    await expect(overlay).toHaveAttribute('data-step', 'login');
    await expect(overlay.getByTestId('login-form')).toBeVisible();
    expect(page.url()).not.toContain('/login');

    // A student with a code from their teacher has a button of their own, not a line of small print.
    await overlay.getByTestId('class-code-link').click();
    await expect(overlay).toHaveAttribute('data-step', 'class');
    await expect(overlay.getByTestId('class-login')).toBeVisible();
    expect(page.url()).not.toContain('/class-login');

    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
  });

  test('a kid chooses a secret number, and has a door of their own to come back through', async ({ page }) => {
    await page.goto('/en');
    const nav = page.getByTestId('marketing-nav');
    await nav.getByRole('link', { name: /sign up for free/i }).first().click();
    const overlay = page.getByTestId('sign-up-overlay');
    await overlay.locator('[data-persona="kid"]').click();

    // avatar, name, age, then the four digits they will come back with
    await overlay.getByTestId('step-1').getByRole('button').first().click();
    await overlay.getByTestId('step-1').getByRole('button').last().click();
    await overlay.locator('#nickname').fill('Ada');
    await overlay.getByTestId('step-2').getByRole('button').last().click();
    await overlay.locator('#birth-year-select').selectOption('2015');
    await overlay.getByTestId('step-3').getByRole('button').last().click();
    await expect(overlay.locator('#login-pin')).toBeVisible();

    // A grown-up's email is still asked for, after the number.
    await overlay.locator('#login-pin').fill('4271');
    await overlay.getByTestId('step-4').getByRole('button').last().click();
    await expect(overlay.locator('#parent-email')).toBeVisible();
  });

  test('the persona step still has its own page', async ({ page }) => {
    await page.goto('/en/sign-up');
    await expect(page.getByTestId('persona-select')).toBeVisible();
    await expect(page.getByTestId('sign-up-overlay')).toBeHidden();
  });

  test('nav is visible and has correct links', async ({ page }) => {
    await page.goto('/en');
    const nav = page.getByTestId('marketing-nav');
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: /the method/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /pricing/i })).toBeVisible();
  });

  test('the nav offers a way to sign up and a way back in', async ({ page }) => {
    await page.goto('/en');
    const nav = page.getByTestId('marketing-nav');
    await expect(nav.getByRole('link', { name: /sign up for free/i })).toBeVisible();
    const logIn = nav.getByRole('link', { name: 'Log in', exact: true });
    await expect(logIn).toBeVisible();
    await expect(logIn).toHaveAttribute('href', //en/login$/);
  });

  test('footer shows trust badges', async ({ page }) => {
    await page.goto('/en');
    const footer = page.getByTestId('site-footer');
    await expect(footer).toBeVisible();
    await expect(footer.getByText('COPPA-friendly')).toBeVisible();
    await expect(footer.getByText('No ads')).toBeVisible();
  });

  test('FA locale loads with RTL direction', async ({ page }) => {
    await page.goto('/fa');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(html).toHaveAttribute('lang', 'fa');
  });
});
