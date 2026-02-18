const { test, expect } = require('@playwright/test');

test.describe.serial('Grocery History E2E Flow', () => {
  const loginUsername = 'e2eUser';
  const loginPassword = 'Password123!';

  test('Grocery history page loads and displays session details', async ({ page }) => {
    /* ---------------- LOGIN ---------------- */
    await page.goto('http://localhost:3001/login.html');
    await page.fill('#loginUsername', loginUsername);
    await page.fill('#loginPassword', loginPassword);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('#loginSubmit'),
    ]);

    /* ------------ NAVIGATE TO GROCERY HISTORY ------------ */
    await page.goto('http://localhost:3001/smartGrocery.html');
    await page.click('#sidebar-toggle');
    await page.click('a[href="./GroceryHistory.html"]');
    await expect(page).toHaveURL(/GroceryHistory\.html$/);

    const mealHistory = page.locator('#mealPrepHistory');
    const shoppingHistory = page.locator('#shoppingHistory');
    await expect(mealHistory).toBeVisible();
    await expect(shoppingHistory).toBeVisible();

    /* ------------ MEAL PREP PANEL CHECK ------------ */
    const mealCards = mealHistory.locator('.session-card');
    await expect
      .poll(async () => {
        const count = await mealCards.count();
        const text = await mealHistory.textContent();
        return count > 0 || (text || '').includes('No meal prep sessions yet.');
      })
      .toBeTruthy();

    if ((await mealCards.count()) > 0) {
      const firstMealCard = mealCards.first();
      await expect(firstMealCard.locator('.meal-info')).toContainText(/^Meal:/);
      await expect(firstMealCard).not.toContainText('Meal ID:');
      await expect(firstMealCard).toContainText('Stock:');
    } else {
      await expect(mealHistory).toContainText('No meal prep sessions yet.');
    }

    /* ------------ SHOPPING PANEL CHECK ------------ */
    const shoppingCards = shoppingHistory.locator('.session-card');
    await expect
      .poll(async () => {
        const count = await shoppingCards.count();
        const text = await shoppingHistory.textContent();
        return count > 0 || (text || '').includes('No shopping sessions yet.');
      })
      .toBeTruthy();

    if ((await shoppingCards.count()) > 0) {
      await expect(shoppingCards.first()).toContainText('Stock:');
    } else {
      await expect(shoppingHistory).toContainText('No shopping sessions yet.');
    }
  });
});
