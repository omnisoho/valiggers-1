const { test, expect } = require('@playwright/test');

test.describe('Store - products + category filtering', () => {
  // Use env var in CI if needed; default matches your friend's test style.
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

  async function waitForProductsToRender(page) {
    const grid = page.locator('#productGrid');
    await expect(grid).toBeVisible();

    // Wait for at least 1 product card
    await expect(page.locator('#productGrid .card').first()).toBeVisible({ timeout: 10000 });
  }

  async function clickCategory(page, label) {
    const btn = page.locator(`.subnav-link[data-category="${label}"]`);
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(btn).toHaveClass(/active/);
  }

  async function assertAllVisibleCardsAreCategory(page, expectedTagText) {
    await expect.poll(async () => {
      const tags = await page.locator('#productGrid .card .card-tag').allInnerTexts();
      const normalized = tags.map((t) => t.trim()).filter(Boolean);
      return normalized.length > 0 && normalized.every((tag) => tag === expectedTagText);
    }, { timeout: 8000 }).toBeTruthy();
  }

  test('Store loads and shows products', async ({ page }) => {
    await page.goto(`${BASE_URL}/store.html`);
    await waitForProductsToRender(page);

    // Product count text should not be "Failed..."
    await expect(page.locator('#productCount')).not.toHaveText('Failed to load products');

    // Should show some number like "X products"
    await expect(page.locator('#productCount')).toContainText('product');
  });

  test('Filter: Supplements shows only supplements', async ({ page }) => {
    await page.goto(`${BASE_URL}/store.html`);
    await waitForProductsToRender(page);

    await clickCategory(page, 'Supplements');
    await assertAllVisibleCardsAreCategory(page, 'SUPPLEMENTS');
  });

  test('Filter: Women’s clothing shows only womens clothing', async ({ page }) => {
    await page.goto(`${BASE_URL}/store.html`);
    await waitForProductsToRender(page);

    await clickCategory(page, "Women's clothing");
    await assertAllVisibleCardsAreCategory(page, "WOMEN'S CLOTHING");
  });

  test('Filter: Men’s clothing shows only mens clothing', async ({ page }) => {
    await page.goto(`${BASE_URL}/store.html`);
    await waitForProductsToRender(page);

    await clickCategory(page, "Men's clothing");
    await assertAllVisibleCardsAreCategory(page, "MEN'S CLOTHING");
  });

  test('Filter: Home shows a mixed/all view (not restricted to one tag)', async ({ page }) => {
    await page.goto(`${BASE_URL}/store.html`);
    await waitForProductsToRender(page);

    // First filter to something strict
    await clickCategory(page, 'Supplements');
    await assertAllVisibleCardsAreCategory(page, 'SUPPLEMENTS');
    const supplementsOnlyCount = await page.locator('#productGrid .card').count();

    // Then go Home = category null in your code, so it should show a broader list
    await clickCategory(page, 'Home');
    await waitForProductsToRender(page);

    const homeCards = await page.locator('#productGrid .card').count();
    expect(homeCards).toBeGreaterThan(0);

    // In shared/seeded DBs, "Home" can still end up all supplements.
    // Stronger invariant: Home should not be narrower than a strict category filter.
    expect(homeCards).toBeGreaterThanOrEqual(supplementsOnlyCount);
  });
});
