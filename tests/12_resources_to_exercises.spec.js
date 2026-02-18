const { test, expect } = require('@playwright/test');

const APP = process.env.BASE_URL || 'http://localhost:3001';

test('Resources -> Exercises sets default difficulty BEGINNER', async ({ page }) => {
  await page.route(/\/resources(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    });
  });

  let exercisesUrl = null;
  await page.route(/\/exercises(\?.*)?$/, async (route) => {
    exercisesUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    });
  });

  await page.goto(`${APP}/resources.html`, { waitUntil: 'domcontentloaded' });

  await page.getByRole('link', { name: 'Abs' }).click();

  await expect(page).toHaveURL(/bodyPart=ABS/);

  // allow JS to run and apply cross-page logic
  await expect(page.locator('#exerciseDifficulty')).toHaveValue('BEGINNER');

  expect(exercisesUrl).toContain('bodyPart=ABS');
  expect(exercisesUrl).toContain('difficulty=BEGINNER');
});
