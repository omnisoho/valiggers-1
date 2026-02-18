const { test, expect } = require('@playwright/test');

test.describe.serial('Your Ingredients E2E Flow', () => {
  const loginUsername = 'e2eUser';
  const loginPassword = 'Password123!';
  const newIngredientName = `E2E_Ingredient_${Date.now()}`;
  const updatedIngredientName = `E2E_Ingredient_Updated`;
  const updatedQuantity = 9;
  const updatedRunningOutLimit = 10;
  const updatedOutOfStockLimit = 8;
  const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]; // 3 days ago

  test('Full Your Ingredients workflow', async ({ page }) => {
    /* ---------------- LOGIN ---------------- */
    await page.goto('http://localhost:3001/login.html');
    await page.fill('#loginUsername', loginUsername);
    await page.fill('#loginPassword', loginPassword);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('#loginSubmit'),
    ]);

    /* ------------ NAVIGATE TO SMART GROCERY ------------ */
    await page.goto('http://localhost:3001/smartGrocery.html');

    // Open sidebar
    await page.click('#sidebar-toggle');
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toHaveClass(/open/);

    // Go to Your Ingredients
    await page.click('a[href="./yourIngredients.html"]');
    await expect(page).toHaveURL(/yourIngredients\.html$/);

    // Ingredients table should load
    const tableRows = page.locator('#ingredients-table tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });

    /* ------------ ADD NEW INGREDIENT (SUGGESTION MODAL FLOW) ------------ */
    await page.click('#add-ingredient-btn');

    // Suggestion modal should open
    const suggestionModal = page.locator('#suggestion-modal');
    await expect(suggestionModal).toBeVisible({ timeout: 10000 });

    // Suggestion list should render (either suggestions OR empty-state item)
    const suggestionList = page.locator('#suggestion-list');
    await expect(suggestionList).toBeVisible();
    const suggestionItems = suggestionList.locator('li');
    await expect(suggestionItems.first()).toBeVisible({ timeout: 10000 });

    // Add custom ingredient from modal and accept success alert
    await page.fill('#custom-ingredient-input', newIngredientName);
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await page.click('#custom-add-btn');

    // Wait for the new row to appear
    const newRow = page.locator('#ingredients-table tbody tr', { hasText: newIngredientName });
    await expect(newRow).toBeVisible({ timeout: 10000 });

    /* ------------ EDIT FIRST INGREDIENT ------------ */
    const firstRow = page.locator('#ingredients-table tbody tr').first();

    // Ensure no modal is open before clicking
    await page.waitForSelector('#ingredient-modal', { state: 'hidden', timeout: 5000 });
    await firstRow.locator('button', { hasText: 'Details' }).click();

    await page.fill('#ingredient-name', updatedIngredientName);
    await page.fill('#ingredient-quantity', String(updatedQuantity));
    await page.fill('#ingredient-running-out-limit', String(updatedRunningOutLimit));
    await page.fill('#ingredient-out-of-stock-limit', String(updatedOutOfStockLimit));
    await page.uncheck('#ingredient-no-expiry');
    await page.fill('#ingredient-expiry', pastDate);

    await page.click('#save-ingredient-btn');

    // Wait for updated row
    const updatedRow = page.locator('#ingredients-table tbody tr', { hasText: updatedIngredientName });
    await expect(updatedRow).toBeVisible({ timeout: 10000 });
    await expect(updatedRow).toContainText(String(updatedQuantity));
    await expect(updatedRow).toContainText(String(updatedRunningOutLimit));
    await expect(updatedRow).toContainText(String(updatedOutOfStockLimit));
    await expect(updatedRow).toContainText('Running Out');

    /* ------------ DELETE INGREDIENT ------------ */
    const rowToDelete = page.locator('#ingredients-table tbody tr').filter({ hasText: newIngredientName }).last();

    // Ensure no modal is open before clicking Details
    await page.waitForSelector('#ingredient-modal', { state: 'hidden', timeout: 5000 });
    await rowToDelete.locator('button', { hasText: 'Details' }).click();

    // Accept both confirm and success alert dialogs triggered by delete
    const deleteDialogHandler = async dialog => {
      await dialog.accept();
    };
    page.on('dialog', deleteDialogHandler);
    await page.click('#delete-ingredient-btn');

    // Wait for the row to disappear
    const deletedRow = page.locator('#ingredients-table tbody tr', { hasText: newIngredientName });
    await expect(deletedRow).toHaveCount(0, { timeout: 10000 });
    page.off('dialog', deleteDialogHandler);
  });
});
