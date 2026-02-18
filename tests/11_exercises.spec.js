const { test, expect } = require('@playwright/test');

const APP = process.env.BASE_URL || 'http://localhost:3001';

const mockExercises = [
  {
    id: 101,
    name: 'Push Up',
    bodyPart: 'CHEST',
    equipment: 'NONE',
    difficulty: 'BEGINNER',
    shortDesc: 'Chest movement',
    imageUrl: '',
    videoUrl: 'https://example.com/pushup',
  },
  {
    id: 102,
    name: 'Dumbbell Row',
    bodyPart: 'BACK',
    equipment: 'DUMBBELLS',
    difficulty: 'INTERMEDIATE',
    shortDesc: 'Back movement',
    imageUrl: '',
    videoUrl: '',
  },
];

async function mockExercisesApi(page) {
  await page.route(/\/(api\/)?exercises(\/.*)?(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockExercises),
    });
  });
}

test('Search then click Dumbbell Row', async ({ page }) => {
  await mockExercisesApi(page);

  await page.goto(`${APP}/exercises.html`, { waitUntil: 'domcontentloaded' });

  // 1) Ensure list renders
  await expect(page.locator('#exerciseList .exercise-card')).toHaveCount(2);

  // 2) Search
  await page.fill('#exerciseSearch', 'Dumbbell Row');
  await page.click('#exerciseApplyFiltersBtn');

  // 3) Click Dumbbell Row
  await page.locator('#exerciseList .exercise-card', { hasText: 'Dumbbell Row' }).click();
});
