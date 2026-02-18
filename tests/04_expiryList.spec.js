const { test, expect } = require('@playwright/test');

test.describe.serial('Expiry Flow Test', () => {
  const loginUsername = 'e2eUser';
  const loginPassword = 'Password123!';
  const updatedIngredientName = 'E2E_Ingredient_UPDATED'; // match yourIngredients.spec.js

  test('Expired ingredient shows in Expiry List and Smart Grocery', async ({ page }) => {
    // ---------------- LOGIN ----------------
    await page.goto('http://localhost:3001/login.html');
    await page.fill('#loginUsername', loginUsername);
    await page.fill('#loginPassword', loginPassword);
    await Promise.all([
      page.waitForNavigation(),
      page.click('#loginSubmit'),
    ]);

    // ---------------- GO TO SMART GROCERY FIRST ----------------
    await page.goto('http://localhost:3001/smartGrocery.html');
    await expect(page).toHaveURL(/smartGrocery\.html$/);

    // Open sidebar
    await page.click('#sidebar-toggle');

    // Go to Expiry List
    await page.click('a[href="./expiryList.html"]');
    await expect(page).toHaveURL(/expiryList\.html$/);
// ---------------- VERIFY EXPIRED INGREDIENT ----------------
const expiryItem = page.locator('.expiry-item', { hasText: updatedIngredientName });

// wait for it to appear because renderIngredients is async
await expiryItem.waitFor({ state: 'visible', timeout: 10000 });

await expect(expiryItem).toBeVisible();

const expiredBadge = expiryItem.locator('.days-expired');
await expect(expiredBadge).toBeVisible();

const badgeText = await expiredBadge.textContent();
expect(badgeText).toMatch(/Expired \d+ day\(s\)/);


    // ---------------- GO BACK TO SMART GROCERY ----------------
    await page.goto('http://localhost:3001/smartGrocery.html');

    // Verify ingredient shows expired bubble
    const ingredientRow = page.locator('.ingredient-row', { hasText: updatedIngredientName });
    await expect(ingredientRow).toBeVisible();

    const expiredBubble = ingredientRow.locator('.expired-bubble');
    await expect(expiredBubble).toBeVisible();

    const bubbleText = await expiredBubble.textContent();
    expect(bubbleText).toContain('⚠ Expired');
  });
});
