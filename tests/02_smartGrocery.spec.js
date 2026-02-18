const { test, expect } = require('@playwright/test');

test.describe.serial('Smart Grocery Full E2E Flow', () => {

  test('Full Smart Grocery workflow', async ({ page }) => {

    /* ---------------- LOGIN ---------------- */
    await page.goto('http://localhost:3001/login.html');

    await page.fill('#loginUsername', 'e2eUser');
    await page.fill('#loginPassword', 'Password123!');

    await Promise.all([
      page.waitForNavigation({ url: '**/index.html' }),
      page.click('#loginSubmit')
    ]);

    /* ------------ OPEN SMART GROCERY ------------ */
    await page.goto('http://localhost:3001/smartGrocery.html');

    const mealCard = page.locator('.meal-card', { hasText: 'Test Breakfast' });
    await mealCard.waitFor({ state: 'visible' });

    /* ------------ ADD INGREDIENT ------------ */
    const addBtn = mealCard.locator('.add-ingredient-btn');

    page.once('dialog', async dialog => {
      await dialog.accept('E2E Ingredient');
    });

    await addBtn.click();

    const ingredientRow = mealCard
      .locator('.ingredient-row', { hasText: 'E2E Ingredient' })
      .first();

    await ingredientRow.waitFor();

    /* ------------ VERIFY OUT OF STOCK ------------ */
    const statusBadge = ingredientRow.locator('.status-badge').first();
    await expect(statusBadge).toHaveClass(/out-of-stock/);

    /* ------------ CHANGE UNIT ------------ */
    const unitSelect = ingredientRow.locator('select.quantity-unit');
    await unitSelect.selectOption('GRAM');
    await expect(unitSelect).toHaveValue('GRAM');

    /* ------------ OPEN SHOPPING LIST ------------ */
    const shoppingBtn = mealCard.locator('.shopping-btn');
    await shoppingBtn.click();

    const curtain = mealCard.locator('.shopping-curtain');
    await expect(curtain).toBeVisible();

    const shoppingItem = curtain
      .locator('.shopping-item', { hasText: 'E2E Ingredient' })
      .first();

    await expect(shoppingItem).toBeVisible();

    /* ------------ DELETE INGREDIENT ------------ */
    const deleteBtn = ingredientRow.locator('.delete-ingredient-btn');

    page.once('dialog', async dialog => {
      await dialog.accept(); // confirm delete
    });

    await deleteBtn.click();

    await expect(ingredientRow).toBeHidden();

    /* ------------ ADD BACK INGREDIENT ------------ */
    page.once('dialog', async dialog => {
      await dialog.accept('E2E Ingredient');
    });

    await addBtn.click();

    const ingredientRowAgain = mealCard
      .locator('.ingredient-row', { hasText: 'E2E Ingredient' })
      .first();

    await ingredientRowAgain.waitFor();

    /* ------------ CHANGE QUANTITY & CHECK WARNING BUBBLE ------------ */
    const qtyInputAgain = ingredientRowAgain.locator('.quantity-input');
    await qtyInputAgain.fill('5');
    await qtyInputAgain.blur();

    await expect(qtyInputAgain).toHaveValue('5');

    
    // ✅ Expect warning bubble to appear
    const warningBubble = ingredientRowAgain.locator('.quantity-warning-bubble');
    await expect(warningBubble).toBeVisible();

    /* ------------ START GLOBAL SHOPPING TIMER ------------ */
    await page.click('#global-shopping-btn');

    const timePanel = page.locator('#shopping-time-panel');
    await expect(timePanel).toBeVisible();

    await page.fill('#hours', '0');
    await page.fill('#minutes', '0');
    await page.fill('#seconds', '3');

    await page.click('#start-timer-btn');

    const timerDisplay = page.locator('#timer-display');
    await expect(timerDisplay).toBeVisible();

    /* ------------ WAIT FOR TIMER END ------------ */
    await page.waitForTimeout(4000);

    /* ------------ VERIFY SUMMARY MODAL ------------ */
    const summaryOverlay = page.locator('#shopping-summary-overlay');
    await expect(summaryOverlay).toBeVisible();

    const summaryItem = summaryOverlay
      .locator('.summary-item', { hasText: 'E2E Ingredient' })
      .first();

    await expect(summaryItem).toBeVisible();

    /* ------------ EXIT SUMMARY ------------ */
    await page.click('#exit-summary-btn');
    await expect(summaryOverlay).toBeHidden();

    /* ------------ VERIFY LOW STOCK PANEL ------------ */
    const lowStockPanelItem = page
      .locator('.low-stock-item', { hasText: 'E2E Ingredient' })
      .first();

    await expect(lowStockPanelItem).toBeVisible();

    /* ------------ TEST SEARCH FUNCTIONALITY ------------ */
    const searchInput = page.locator('#meal-search-input');
    await searchInput.fill('Test Breakfast');

await expect(mealCard).toHaveCSS('border-top-color', 'rgb(37, 99, 235)'); // computed color

  });

});
