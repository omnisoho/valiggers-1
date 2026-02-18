const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const storageStatePath = path.join(__dirname, 'storefavourite.storageState.json');

async function waitForProductsToRender(page) {
  const grid = page.locator('#productGrid');
  await expect(grid).toBeVisible();
  await expect(page.locator('#productGrid .card').first()).toBeVisible({ timeout: 10000 });
}

async function registerAndLoginAndSaveState(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  const username = `e2eFavUser_${Date.now()}`;
  const password = 'Password123!';
  const email = `${username}@example.com`;

  await page.goto(`${BASE_URL}/register.html`);
  page.once('dialog', async (dialog) => dialog.accept());
  await page.fill('#registerUsername', username);
  await page.fill('#registerEmail', email);
  await page.fill('#registerPassword', password);
  await Promise.all([
    page.waitForNavigation({ url: '**/login.html' }),
    page.click('#registerSubmit'),
  ]);

  await page.fill('#loginUsername', username);
  await page.fill('#loginPassword', password);
  await Promise.all([
    page.waitForNavigation({ url: '**/index.html' }),
    page.click('#loginSubmit'),
  ]);

  await context.storageState({ path: storageStatePath });
  await context.close();
}

test.describe.serial('Store Favourites', () => {
  test.beforeAll(async ({ browser }) => {
    await registerAndLoginAndSaveState(browser);
  });

  test.afterAll(async () => {
    if (fs.existsSync(storageStatePath)) fs.unlinkSync(storageStatePath);
  });

  test('Logged out user clicking navbar favourite is redirected to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/store.html`);
    await waitForProductsToRender(page);

    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });
    await page.locator('#favBtn').click({ force: true });
    expect(dialogMessage.toLowerCase()).toContain('log in');

    await expect(page).toHaveURL(/login\.html/);
  });

  test('Toggle product favourite heart + filter favourites via navbar', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStatePath });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/store.html`);
    await waitForProductsToRender(page);

    const firstCard = page.locator('#productGrid .card').first();
    const firstFavBtn = firstCard.locator('.fav-chip');
    const productId = Number(await firstFavBtn.getAttribute('data-product-id'));
    expect(productId).toBeTruthy();

    // Toggle on
    await firstFavBtn.click();
    await expect(firstFavBtn).toHaveClass(/active/);

    // Persist after reload
    await page.reload();
    await waitForProductsToRender(page);
    await expect(page.locator(`.fav-chip[data-product-id="${productId}"]`).first()).toHaveClass(/active/);

    // Filter favourites-only
    await page.click('#favBtn');
    await expect(page.locator('#favBtn')).toHaveClass(/active/);
    await expect(page.locator('#productGrid .card')).toHaveCount(1);
    await expect(page.locator(`.fav-chip[data-product-id="${productId}"]`).first()).toHaveClass(/active/);

    // Unfavourite while filtered => list becomes empty
    await page.locator(`.fav-chip[data-product-id="${productId}"]`).first().click();
    await expect(page.locator('#productGrid .card')).toHaveCount(0);

    // Turn off filter => full list returns
    await page.click('#favBtn');
    await expect(page.locator('#favBtn')).not.toHaveClass(/active/);
    await expect(page.locator('#productGrid .card').first()).toBeVisible();

    await context.close();
  });
});
