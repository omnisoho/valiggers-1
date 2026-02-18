const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const storageStatePath = path.join(__dirname, 'cart.storageState.json');
const credsPath = path.join(__dirname, 'cart.e2eData.json');
const prisma = new PrismaClient();

async function releaseReservedForUserCart(userId) {
  const cart = await prisma.storeCart.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!cart) return;

  const items = await prisma.storeCartItem.findMany({
    where: { cartId: cart.id },
    select: { productId: true, quantity: true },
  });

  for (const it of items) {
    const p = await prisma.storeProduct.findUnique({
      where: { id: it.productId },
      select: { reservedQty: true },
    });
    const releaseQty = Math.min(Number(p?.reservedQty || 0), Number(it.quantity || 0));
    if (releaseQty > 0) {
      await prisma.storeProduct.update({
        where: { id: it.productId },
        data: { reservedQty: { decrement: releaseQty } },
      });
    }
  }

  await prisma.storeCartItem.deleteMany({ where: { cartId: cart.id } });
  await prisma.storeCart.update({ where: { id: cart.id }, data: { status: 'ACTIVE' } });
}

async function waitForProductsToRender(page) {
  const grid = page.locator('#productGrid');
  await expect(grid).toBeVisible();
  await expect(page.locator('#productGrid .card').first()).toBeVisible({ timeout: 10000 });
}

async function addAnyAvailableProductAndOpenCart(page) {
  const addButtons = page.locator('#productGrid .add-btn');
  const count = await addButtons.count();
  let outOfStockSeen = false;
  let dialogMessage = '';

  const onDialog = async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.accept().catch(() => {});
  };
  page.on('dialog', onDialog);

  try {
    for (let i = 0; i < count; i += 1) {
      if ((await page.locator('body').getAttribute('class'))?.includes('cart-open')) {
        // await page.keyboard.press('Escape').catch(() => {});
        // await page.click('#cartCloseBtn').catch(() => {});
        // await page.click('#cartOverlay').catch(() => {});

        // Try Escape key first
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
        
        // Check if still open
        const stillOpen = (await page.locator('body').getAttribute('class')).includes('cart-open');
        if (stillOpen) {
          // Try close button if it exists and is visible
          const closeBtn = page.locator('#cartCloseBtn');
          if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await closeBtn.click();
            await page.waitForTimeout(1000);
          }
        }

        await expect(page.locator('body')).not.toHaveClass(/cart-open/, { timeout: 2000 });
      }

      const btn = addButtons.nth(i);
      const productId = Number(await btn.getAttribute('data-product-id'));
      if (!productId) continue;

      dialogMessage = '';
      try {
        await btn.click();
      } catch (e) {
        continue;
      }

      try {
        await expect(page.locator('body')).toHaveClass(/cart-open/, { timeout: 4000 });
        const row = page.locator(`.qty-control[data-product-id="${productId}"]`).first();
        if ((await row.count()) > 0) {
          await expect(row).toBeVisible({ timeout: 4000 });
          return { productId };
        }
      } catch (err) {
        if (String(dialogMessage).toLowerCase().includes('out of stock')) {
          outOfStockSeen = true;
          continue;
        }
      }
    }
  } finally {
    page.off('dialog', onDialog);
  }

  throw new Error(outOfStockSeen ? 'All visible products are out of stock' : 'Could not add any product to cart');
}

async function openCartDrawer(page) {
  await page.click('#cartBtn');
  await expect(page.locator('body')).toHaveClass(/cart-open/);
  await expect(page.locator('#cartDrawer')).toHaveAttribute('aria-hidden', 'false');
}

async function closeCartDrawerByCloseBtn(page) {
  await page.click('#cartCloseBtn');
  await expect(page.locator('body')).not.toHaveClass(/cart-open/);
  await expect(page.locator('#cartDrawer')).toHaveAttribute('aria-hidden', 'true');
}

async function closeCartDrawerByOverlay(page) {
  // overlay exists even when hidden; click it when open
  await page.click('#cartOverlay');
  await expect(page.locator('body')).not.toHaveClass(/cart-open/);
  await expect(page.locator('#cartDrawer')).toHaveAttribute('aria-hidden', 'true');
}

async function registerAndLoginAndSaveState(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  const username = `e2eCartUser_${Date.now()}`;
  const password = 'Password123!';
  const email = `${username}@example.com`;

  // --- REGISTER ---
  await page.goto(`${BASE_URL}/register.html`);
  await page.fill('#registerUsername', username);
  await page.fill('#registerEmail', email);
  await page.fill('#registerPassword', password);

  await Promise.all([
    page.waitForNavigation({ url: '**/login.html' }),
    page.click('#registerSubmit'),
  ]);

  // --- LOGIN ---
  await page.fill('#loginUsername', username);
  await page.fill('#loginPassword', password);

  await Promise.all([
    page.waitForNavigation({ url: '**/index.html' }),
    page.click('#loginSubmit'),
  ]);

  // Persist state (cookies/localStorage token) so other tests are already logged in
  await context.storageState({ path: storageStatePath });

  // Optional: keep creds for debugging/reruns
  fs.writeFileSync(credsPath, JSON.stringify({ username, password, email }, null, 2));

  await context.close();
}

/* =========================================================
   PUBLIC (NOT LOGGED IN)
   ========================================================= */

test.describe('Store Cart (public access)', () => {
  test('Can access store without logging in (no forced redirect)', async ({ page }) => {
    await page.goto(`${BASE_URL}/store.html`);

    // Just assert we stayed on store + can see UI pieces.
    await expect(page).toHaveURL(/store\.html/);
    await expect(page.locator('#productGrid')).toBeVisible();
    await expect(page.locator('#cartBtn')).toBeVisible();

    // Products should render (minimal check; store.spec.js already covers filters/details)
    await waitForProductsToRender(page);
  });

  test('Trying to add to cart while logged out shows login-required alert and redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/store.html`);
    await waitForProductsToRender(page);

    // Capture alert robustly even if redirect happens quickly after accept.
    let alertMessage = '';
    page.once('dialog', async (dialog) => {
      alertMessage = dialog.message();
      await dialog.accept().catch(() => {});
    });

    await page.locator('#productGrid .add-btn').first().click();
    await expect.poll(() => alertMessage, { timeout: 5000 }).toContain('log in');

    // store.js redirects to ./login.html after the alert when message includes "log in"
    await expect(page).toHaveURL(/login\.html/);
  });
});

/* =========================================================
   AUTHENTICATED CART BEHAVIOR (SERIAL, SHARED USER)
   ========================================================= */

test.describe.serial('Store Cart (logged-in cart drawer + qty controls)', () => {
  let userId = null;

  test.beforeAll(async ({ browser }) => {
    // Create a fresh user + storageState for this suite
    await registerAndLoginAndSaveState(browser);
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    const user = await prisma.user.findUnique({
      where: { username: creds.username },
      select: { user_id: true },
    });
    userId = user?.user_id || null;
  });

  test.beforeEach(async () => {
    if (userId) await releaseReservedForUserCart(userId);
  });

  test.afterEach(async () => {
    if (userId) await releaseReservedForUserCart(userId);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });
  test('Can open cart drawer from cart icon and close it (close button + overlay)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStatePath });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/store.html`);
    await waitForProductsToRender(page);

    await openCartDrawer(page);
    await closeCartDrawerByCloseBtn(page);

    // Open again and close by overlay click
    await openCartDrawer(page);
    await closeCartDrawerByOverlay(page);

    await context.close();
  });

  test('Adding to cart works (drawer opens, badge increases, item appears)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStatePath });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/store.html`);
      await waitForProductsToRender(page);

      const { productId } = await addAnyAvailableProductAndOpenCart(page);

      // Drawer should pop open on successful add
      await expect(page.locator('body')).toHaveClass(/cart-open/);

      // Badge should be >= 1
      await expect(page.locator('#cartCount')).not.toHaveText('0');

      // Item row should exist
      const row = page.locator(`.qty-control[data-product-id="${productId}"]`).first();
      await expect(row).toBeVisible();

      // Qty pill should be at least 1
      await expect(row.locator('.qty-pill')).toHaveText(/^[1-9]\d*$/);

      // Close to prep next tests
      await closeCartDrawerByCloseBtn(page);
    } finally {
      await context.close();
    }
  });

  test('Increasing quantity in the cart drawer works (+ button increments qty + badge)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStatePath });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/store.html`);
    await waitForProductsToRender(page);

    const { productId } = await addAnyAvailableProductAndOpenCart(page);
    const wrap = page.locator(`.qty-control[data-product-id="${productId}"]`).first();
    await expect(wrap).toBeVisible();

    const qtyPill = wrap.locator('.qty-pill');

    const beforeQty = Number((await qtyPill.innerText()).trim());
    await wrap.locator('button[data-action="inc"]').click();

    await expect(qtyPill).toHaveText(String(beforeQty + 1));

    // Badge should also reflect total qty (at least before+1)
    const badge = page.locator('#cartCount');
    const badgeValue = Number((await badge.innerText()).trim());
    expect(badgeValue).toBeGreaterThanOrEqual(beforeQty + 1);

    await closeCartDrawerByCloseBtn(page);

    await context.close();
  });

  test('Decreasing quantity to < 1 removes the item completely from cart drawer', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStatePath });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/store.html`);
      await waitForProductsToRender(page);

      const { productId } = await addAnyAvailableProductAndOpenCart(page);
      await expect(page.locator(`.qty-control[data-product-id="${productId}"]`).first()).toBeVisible();

      // Keep clicking "-" until the row disappears.
      // Re-query each loop because the cart DOM is re-rendered after every PATCH.
      for (let i = 0; i < 12; i += 1) {
        const wrapNow = page.locator(`.qty-control[data-product-id="${productId}"]`).first();
        if (!(await wrapNow.count())) break;

        const decBtn = wrapNow.locator('button[data-action="dec"]');
        await decBtn.click({ timeout: 5000 });
        await page.waitForTimeout(120);
      }

      await expect(page.locator(`.qty-control[data-product-id="${productId}"]`)).toHaveCount(0, { timeout: 8000 });
      await expect(page.locator('#cartItems .cart-row')).toHaveCount(0, { timeout: 8000 });
      await expect(page.locator('#cartCount')).toHaveText('0');
      await expect(page.locator('#cartEmpty')).toHaveCount(1);
    } finally {
      await context.close();
    }
  });

  test('Stock limit: after qty reaches 5, cannot increase further; shows "out of stock" alert; cannot add more of same item', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStatePath });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/store.html`);
    await waitForProductsToRender(page);

    // Add an available product to open cart + create row
    const { productId } = await addAnyAvailableProductAndOpenCart(page);
    expect(productId).toBeTruthy();

    const wrapSelector = `.qty-control[data-product-id="${productId}"]`;
    let wrap = page.locator(wrapSelector).first();
    await expect(wrap).toBeVisible();

    const qtyPill = wrap.locator('.qty-pill');

    // Drive qty up to 5 (best effort: if it starts higher due to previous tests, just top up)
    let qty = Number((await qtyPill.innerText()).trim());
    while (qty < 5) {
      await wrap.locator('button[data-action="inc"]').click();
      await expect(qtyPill).toHaveText(String(qty + 1));
      qty += 1;
    }

    // Now attempt to go past 5 -> should alert "out of stock" and qty stays 5
    const dialogPromise = page.waitForEvent('dialog');
    await wrap.locator('button[data-action="inc"]').click();
    const dialog = await dialogPromise;

    expect(dialog.message().toLowerCase()).toContain('out of stock');
    await dialog.accept();

    // qty should remain 5
    // (re-query after rerender just in case)
    wrap = page.locator(wrapSelector).first();
    await expect(wrap.locator('.qty-pill')).toHaveText('5');

    await closeCartDrawerByCloseBtn(page);
    
    // Also: clicking "Add" for the SAME product should also alert out-of-stock (server returns 409)
    const dialogPromise2 = page.waitForEvent('dialog');
    await page.locator(`#productGrid .add-btn[data-product-id="${productId}"]`).first().click();
    const dialog2 = await dialogPromise2;

    expect(dialog2.message().toLowerCase()).toContain('out of stock');
    await dialog2.accept();

    // Qty should still be 5
    await expect(page.locator(wrapSelector).first().locator('.qty-pill')).toHaveText('5');

    await context.close();
  });
});
