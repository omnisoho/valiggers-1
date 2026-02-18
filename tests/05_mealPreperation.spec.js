const { test, expect } = require('@playwright/test');

test.describe.serial('Meal Preparation E2E Flow', () => {
  const loginUsername = 'e2eUser';
  const loginPassword = 'Password123!';
  const ingredientName = 'E2E_Ingredient_Updated'; // from previous test case

  test('Full Meal Preparation workflow', async ({ page }) => {
    /* ---------------- LOGIN ---------------- */
    await page.goto('http://localhost:3001/login.html');
    await page.fill('#loginUsername', loginUsername);
    await page.fill('#loginPassword', loginPassword);

    await Promise.all([
      page.waitForNavigation(),
      page.click('#loginSubmit'),
    ]);

    /* ------------ NAVIGATE TO SMART GROCERY ------------ */
    await page.goto('http://localhost:3001/smartGrocery.html');

    // Open sidebar
    await page.click('#sidebar-toggle');
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toHaveClass(/open/);

    // Go to Meal Preparation
    await page.click('a[href="./mealPreparation.html"]');
    await expect(page).toHaveURL(/mealPreparation\.html$/);

    /* ------------ WAIT FOR MEALS TO LOAD ------------ */
    const mealCard = page.locator('.meal-prep-card', { hasText: 'Test Breakfast' });
    await mealCard.waitFor({ state: 'visible' });

    /* ------------ START PREPARATION ------------ */
    const prepBtn = mealCard.locator('.start-prep');
    await prepBtn.click();

    const prepOverlay = page.locator('#prep-overlay');
    await expect(prepOverlay).toBeVisible();

    // Ingredient status should be Running Out
    const prepIngredient = prepOverlay.locator('.prep-row', { hasText: ingredientName });
    await expect(prepIngredient.locator('.badge')).toHaveText(/Running Out/i);

    /* ------------ GET QUANTITY FROM SPAN ------------ */
    // Quantity is displayed as "4 kg" or similar, strip non-numeric
    const qtySpan = prepIngredient.locator('span').nth(1);
    const qtyText = await qtySpan.textContent();
    const prepQuantity = parseFloat(qtyText.replace(/[^\d.]/g, ''));

    /* ------------ CLICK "PREPARED" IN DROPDOWN ------------ */
    const preparedDropdown = prepIngredient.locator('select');
    await preparedDropdown.selectOption('PREPARED');

    /* ------------ COMPLETE COOKING SESSION ------------ */
    const completeBtn = prepOverlay.locator('#complete-prep-btn');
    await completeBtn.click();

    await expect(prepOverlay).toHaveClass(/hidden/);

    /* ------------ NAVIGATE TO YOUR INGREDIENTS ------------ */
    await page.click('#sidebar-toggle');
    await page.click('a[href="./yourIngredients.html"]');
    await expect(page).toHaveURL(/yourIngredients\.html$/);

    const tableRow = page.locator('#ingredients-table tbody tr', { hasText: ingredientName });
    await expect(tableRow).toBeVisible();

    /* ------------ VERIFY UPDATED QUANTITY ------------ */
    const quantityCell = tableRow.locator('td').nth(1); // Quantity column
    const quantityValue = parseFloat(await quantityCell.textContent());

    // From previous test, ingredient quantity = 9
    // After cooking session, quantity = previous quantity - prep quantity
    expect(quantityValue).toBe(9 - prepQuantity);

    /* ------------ VERIFY STATUS IS OUT OF STOCK ------------ */
    const statusCell = tableRow.locator('td').nth(3); // Status column
    await expect(statusCell).toHaveText(/Out of Stock/i);
  });
});
