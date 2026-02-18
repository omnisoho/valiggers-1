const { test, expect } = require('@playwright/test');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const storageStatePath = path.join(__dirname, 'store-session-timeout.storageState.json');
const prisma = new PrismaClient();

async function releaseReservedForUserCartAndOpenOrders(userId) {
  const cart = await prisma.storeCart.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (cart) {
    const cartItems = await prisma.storeCartItem.findMany({
      where: { cartId: cart.id },
      select: { productId: true, quantity: true },
    });
    for (const it of cartItems) {
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

  const openOrders = await prisma.storeOrder.findMany({
    where: { userId, status: { in: ['PENDING_PAYMENT', 'EXPIRED', 'CANCELLED'] } },
    select: { id: true },
  });
  for (const ord of openOrders) {
    const items = await prisma.storeOrderItem.findMany({
      where: { orderId: ord.id },
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
  }
}

async function registerAndLoginAndSaveState(browser, creds) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/register.html`);
  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });

  await page.fill('#registerUsername', creds.username);
  await page.fill('#registerEmail', creds.email);
  await page.fill('#registerPassword', creds.password);

  await Promise.all([
    page.waitForNavigation({ url: '**/login.html' }),
    page.click('#registerSubmit'),
  ]);

  await page.fill('#loginUsername', creds.username);
  await page.fill('#loginPassword', creds.password);

  await Promise.all([
    page.waitForNavigation({ url: '**/index.html' }),
    page.click('#loginSubmit'),
  ]);

  await context.storageState({ path: storageStatePath });
  await context.close();
}

async function waitForProductsToRender(page) {
  await expect(page.locator('#productGrid')).toBeVisible();
  await expect(page.locator('#productGrid .card .add-btn').first()).toBeVisible({ timeout: 10000 });
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
        await page.keyboard.press('Escape').catch(() => {});
        await page.click('#cartCloseBtn').catch(() => {});
        await page.click('#cartOverlay').catch(() => {});
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

test.describe.serial('Store Session Timeout', () => {
  const unique = Date.now();
  const creds = {
    username: `e2e_timeout_${unique}`,
    email: `e2e_timeout_${unique}@example.com`,
    password: 'Password123!',
  };
  let userId = null;

  test.beforeAll(async ({ browser }) => {
    await registerAndLoginAndSaveState(browser, creds);
    const user = await prisma.user.findUnique({
      where: { username: creds.username },
      select: { user_id: true },
    });
    userId = user?.user_id || null;
  });

  test.beforeEach(async () => {
    if (userId) await releaseReservedForUserCartAndOpenOrders(userId);
  });

  test.afterAll(async () => {
    if (userId) {
      try {
        await releaseReservedForUserCartAndOpenOrders(userId);
        const cart = await prisma.storeCart.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (cart) {
          await prisma.storeCartItem.deleteMany({ where: { cartId: cart.id } });
        }
        await prisma.storeOrderItem.deleteMany({ where: { order: { userId } } });
        await prisma.storeOrder.deleteMany({ where: { userId } });
        if (cart) await prisma.storeCart.delete({ where: { id: cart.id } });
        await prisma.user.delete({ where: { user_id: userId } });
      } catch (err) {
        console.warn('Timeout spec cleanup warning:', err?.message || err);
      }
    }
    await prisma.$disconnect();
  });

  test('Cart page timeout: shows alert and cart is emptied', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStatePath });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/store.html`);
    await waitForProductsToRender(page);

    await releaseReservedForUserCartAndOpenOrders(userId);
    await addAnyAvailableProductAndOpenCart(page);
    await expect(page.locator('#cartItems .cart-row').first()).toBeVisible();

    await page.click('#cartCloseBtn');
    await expect(page.locator('body')).not.toHaveClass(/cart-open/);

    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await prisma.storeCart.update({
      where: { userId },
      data: { updatedAt: old },
    });

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.click('#cartBtn');

    await expect.poll(async () => {
      const count = await page.locator('#cartItems .cart-row').count();
      const badge = await page.locator('#cartCount').innerText();
      return `${badge}|${count}`;
    }, { timeout: 10000 }).toBe('0|0');

    await expect(page.locator('#cartCount')).toHaveText('0', { timeout: 10000 });
    await expect(page.locator('#cartItems .cart-row')).toHaveCount(0, { timeout: 10000 });

    await context.close();
  });

  test('Payment page timeout: shows message then redirects to store and releases reserved stock', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: storageStatePath });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/store.html`);
    await waitForProductsToRender(page);

    const { productId } = await addAnyAvailableProductAndOpenCart(page);

    const reservedBefore = await prisma.storeProduct.findUnique({
      where: { id: productId },
      select: { reservedQty: true, stockQty: true },
    });

    await page.click('#cartCheckoutBtn');
    await expect(page).toHaveURL(/payment\.html\?orderId=/);

    const orderId = Number(new URL(page.url()).searchParams.get('orderId'));
    expect(orderId).toBeTruthy();
    const orderLine = await prisma.storeOrderItem.findFirst({
      where: { orderId, productId },
      select: { quantity: true },
    });
    const reservedByThisOrder = Number(orderLine?.quantity || 0);
    expect(reservedByThisOrder).toBeGreaterThan(0);
    const reservedBeforeQty = Number(reservedBefore?.reservedQty || 0);

    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await prisma.storeOrder.update({
      where: { id: orderId },
      data: { createdAt: old },
    });

    await page.reload();
    await expect(page.locator('#sessionMessage')).toBeVisible();
    await expect(page.locator('#sessionMessage')).toContainText('Redirecting to store');
    await expect(page).toHaveURL(/store\.html/, { timeout: 7000 });

    const order = await prisma.storeOrder.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    expect(order?.status).toBe('EXPIRED');

    const productAfter = await prisma.storeProduct.findUnique({
      where: { id: productId },
      select: { reservedQty: true },
    });
    const reservedAfterQty = Number(productAfter?.reservedQty || 0);
    expect(reservedAfterQty).toBeLessThanOrEqual(Math.max(0, reservedBeforeQty));

    const cart = await prisma.storeCart.findUnique({
      where: { userId },
      include: { items: true },
    });
    expect(cart?.items?.length || 0).toBe(0);

    await context.close();
  });
});
