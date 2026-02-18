const { test, expect } = require('@playwright/test');

const APP = process.env.BASE_URL || 'http://localhost:3001';

const mockResources = [
  {
    id: 1,
    title: 'Beginner Strength Basics',
    description: 'Strength article',
    type: 'ARTICLE',
    difficulty: 'BEGINNER',
    url: 'https://example.com/a',
    createdAt: new Date().toISOString(),
    category: { id: 10, name: 'Strength Training', slug: 'strength' },
  },
  {
    id: 2,
    title: 'Mobility Routine',
    description: 'Mobility video',
    type: 'VIDEO',
    difficulty: 'INTERMEDIATE',
    url: 'https://example.com/b',
    createdAt: new Date().toISOString(),
    category: { id: 11, name: 'Mobility', slug: 'mobility' },
  },
];

async function mockResourcesApi(page, onRequest) {
  // ✅ Only intercept /resources API, not /resources.html
  await page.route(/\/resources(\?.*)?$/, async (route) => {
    const url = route.request().url();
    if (onRequest) onRequest(url);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResources),
    });
  });
}

test('Resources page renders cards from API', async ({ page }) => {
  await mockResourcesApi(page);

  await page.goto(`${APP}/resources.html`, { waitUntil: 'domcontentloaded' });

  // Wait for JS to finish rendering
  await expect(page.locator('.resource-card')).toHaveCount(2);

  await expect(page.getByText('Beginner Strength Basics')).toBeVisible();
  await expect(page.locator('#status')).toContainText('2 resource(s) found.');
});

test('Apply filters saves to localStorage + adds query params', async ({ page }) => {
  let lastUrl = null;
  await mockResourcesApi(page, (u) => (lastUrl = u));

  await page.goto(`${APP}/resources.html`, { waitUntil: 'domcontentloaded' });

  await page.fill('#search', 'sleep');
  await page.selectOption('#difficulty', 'BEGINNER');

  await page.click('#applyFiltersBtn');

  // The API request URL should include filters
  await expect.poll(() => lastUrl).toContain('search=sleep');
  await expect.poll(() => lastUrl).toContain('difficulty=BEGINNER');

  const saved = await page.evaluate(() => localStorage.getItem('resourceFilters'));
  expect(saved).toBeTruthy();
});

test('Reset clears localStorage + reloads clean URL', async ({ page }) => {
  await mockResourcesApi(page);

  await page.goto(`${APP}/resources.html?search=test`, { waitUntil: 'domcontentloaded' });

  await page.evaluate(() => {
    localStorage.setItem('resourceFilters', JSON.stringify({ search: 'x' }));
    localStorage.setItem('fromResourcesPage', 'true');
  });

  await page.click('#resetResourceFiltersBtn');

  // Your code reloads to clean origin+pathname
  await expect(page).toHaveURL(/\/resources\.html$/);

  const saved = await page.evaluate(() => localStorage.getItem('resourceFilters'));
  expect(saved).toBeNull();
});
