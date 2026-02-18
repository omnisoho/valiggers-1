const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
let BASE_URL = process.env.BASE_URL || '';
const storageStatePath = path.join(__dirname, 'payment.storageState.json');

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

async function resolveBaseUrl() {
  if (BASE_URL) return BASE_URL;

  const candidates = [
    `http://127.0.0.1:${process.env.PORT || 3001}`,
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://localhost:3000',
  ];

  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/login.html`, { method: 'GET' });
      if (res.ok) {
        BASE_URL = base;
        return BASE_URL;
      }
    } catch (err) {
      // try next candidate
    }
  }

  throw new Error('Could not resolve test base URL. Set BASE_URL env var explicitly.');
}

async function registerAndLoginAndSaveState(browser, creds) {
  const base = await resolveBaseUrl();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${base}/register.html`);
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

async function waitForStoreReady(page) {
  const base = await resolveBaseUrl();
  await page.goto(`${base}/store.html`);
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
        // If an unrelated dialog happened, continue trying other products.
      }
    }
  } finally {
    page.off('dialog', onDialog);
  }

  throw new Error(outOfStockSeen ? 'All visible products are out of stock' : 'Could not add any product to cart');
}

async function checkoutFirstProduct(page) {
  await waitForStoreReady(page);

  const { productId } = await addAnyAvailableProductAndOpenCart(page);
  await expect(page.locator('#cartItems .cart-row').first()).toBeVisible();
  await page.click('#cartCheckoutBtn');

  await expect(page).toHaveURL(/payment\.html\?orderId=/, { timeout: 10000 });
  const orderId = Number(new URL(page.url()).searchParams.get('orderId'));
  expect(orderId).toBeTruthy();

  return { orderId, productId };
}

async function fillValidPaymentForm(page) {
  await page.fill('#cardName', 'John Tan');
  await page.fill('#cardNumber', '4111111111111111');
  await page.fill('#cardExpiry', '0328');
  await page.fill('#cardCvv', '123');
  await page.fill('#billFirstName', 'John');
  await page.fill('#billLastName', 'Tan');
  await page.fill('#billAddress', '123 Fitness Street');
  await page.fill('#billPostal', '123456');
  await page.fill('#billCountry', 'Singapore');
}

test.describe.serial('Payment E2E (non-timeout)', () => {
  let userId = null;
  let currentStorageStatePath = storageStatePath;

  test.beforeEach(async ({ browser }, testInfo) => {
    const unique = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const creds = {
      username: `e2e_payment_${unique}`,
      email: `e2e_payment_${unique}@example.com`,
      password: 'Password123!',
    };

    currentStorageStatePath = path.join(__dirname, `payment.${testInfo.retry}.${testInfo.title.replace(/\W+/g, '_')}.storageState.json`);
    await registerAndLoginAndSaveState(browser, creds);
    if (currentStorageStatePath !== storageStatePath && fs.existsSync(storageStatePath)) {
      fs.renameSync(storageStatePath, currentStorageStatePath);
    }

    const user = await prisma.user.findUnique({
      where: { username: creds.username },
      select: { user_id: true },
    });
    userId = user?.user_id || null;
    if (userId) {
      await releaseReservedForUserCartAndOpenOrders(userId);
    }
  });

  test.afterEach(async () => {
    try {
      if (userId) {
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
      }
      if (currentStorageStatePath && fs.existsSync(currentStorageStatePath)) {
        fs.unlinkSync(currentStorageStatePath);
      }
    } finally {
      userId = null;
      currentStorageStatePath = storageStatePath;
    }
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
    if (fs.existsSync(storageStatePath)) {
      fs.unlinkSync(storageStatePath);
    }
  });

  test('Checkout brings items into payment summary with pending order state', async ({ browser }) => {
    const context = await browser.newContext({ storageState: currentStorageStatePath });
    const page = await context.newPage();

    const { orderId } = await checkoutFirstProduct(page);

    await expect(page.locator('#summaryItems .summary-row')).toHaveCount(1);
    await expect(page.locator('#summaryCount')).not.toHaveText('0 items');
    await expect(page.locator('#subtotalValue')).not.toHaveText('$0.00');
    await expect(page.locator('#totalValue')).not.toHaveText('$0.00');

    const order = await prisma.storeOrder.findUnique({
      where: { id: orderId },
      select: { status: true, userId: true, items: true },
    });
    expect(order?.userId).toBe(userId);
    expect(order?.status).toBe('PENDING_PAYMENT');
    expect(order?.items?.length || 0).toBeGreaterThan(0);

    await context.close();
  });

  test('Card fields auto-format number spacing and expiry slash', async ({ browser }) => {
    const context = await browser.newContext({ storageState: currentStorageStatePath });
    const page = await context.newPage();

    await checkoutFirstProduct(page);

    await page.fill('#cardNumber', '');
    await page.type('#cardNumber', '1234567890123456');
    await expect(page.locator('#cardNumber')).toHaveValue('1234 5678 9012 3456');

    await page.fill('#cardExpiry', '');
    await page.type('#cardExpiry', '0328');
    await expect(page.locator('#cardExpiry')).toHaveValue('03/28');

    await page.fill('#cardCvv', '');
    await page.type('#cardCvv', '1234');
    await expect(page.locator('#cardCvv')).toHaveValue('1234');

    await context.close();
  });

  test('Pay order end-to-end: status becomes PAID, stock decrements, reserved clears, confirm shown', async ({ browser }) => {
    const context = await browser.newContext({ storageState: currentStorageStatePath });
    const page = await context.newPage();

    const { orderId, productId } = await checkoutFirstProduct(page);
    const orderLine = await prisma.storeOrderItem.findFirst({
      where: { orderId, productId },
      select: { quantity: true },
    });
    const fallbackOrderLine = orderLine || await prisma.storeOrderItem.findFirst({
      where: { orderId },
      select: { quantity: true, productId: true },
    });
    const effectiveProductId = Number(orderLine?.productId || fallbackOrderLine?.productId || productId);
    const orderQty = Number(orderLine?.quantity || fallbackOrderLine?.quantity || 0);
    expect(orderQty).toBeGreaterThan(0);

    const before = await prisma.storeProduct.findUnique({
      where: { id: effectiveProductId },
      select: { stockQty: true, reservedQty: true },
    });
    const beforeStock = Number(before?.stockQty || 0);
    const beforeReserved = Number(before?.reservedQty || 0);
    expect(beforeReserved).toBeGreaterThan(0);

    await fillValidPaymentForm(page);
    await page.click('#payBtn');

    await expect(page.locator('#confirmPanel')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#confirmPanel')).toContainText('Payment Successful');
    await expect(page.locator('#orderIdText')).toContainText(`FC-${orderId}`);

    const order = await prisma.storeOrder.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    expect(order?.status).toBe('PAID');

    const after = await prisma.storeProduct.findUnique({
      where: { id: effectiveProductId },
      select: { stockQty: true, reservedQty: true },
    });
    expect(Number(after?.stockQty || 0)).toBe(beforeStock - orderQty);
    expect(Number(after?.reservedQty || 0)).toBe(beforeReserved - orderQty);

    const cart = await prisma.storeCart.findUnique({
      where: { userId },
      include: { items: true },
    });
    expect(cart?.status).toBe('ACTIVE');
    expect(cart?.items?.length || 0).toBe(0);

    await context.close();
  });

  test('Cancel order end-to-end: status becomes CANCELLED, stock unchanged, reserved clears, redirects to store', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: currentStorageStatePath });
    const page = await context.newPage();

    const { orderId, productId } = await checkoutFirstProduct(page);

    const before = await prisma.storeProduct.findUnique({
      where: { id: productId },
      select: { stockQty: true, reservedQty: true },
    });
    const beforeStock = Number(before?.stockQty || 0);
    const beforeReserved = Number(before?.reservedQty || 0);
    expect(beforeReserved).toBeGreaterThan(0);

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.click('#cancelBtn');

    await expect(page.locator('#sessionMessage')).toBeVisible();
    await expect(page.locator('#sessionMessage')).toContainText('Order was cancelled');
    await expect(page).toHaveURL(/store\.html/, { timeout: 7000 });

    const order = await prisma.storeOrder.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    expect(order?.status).toBe('CANCELLED');

    const after = await prisma.storeProduct.findUnique({
      where: { id: productId },
      select: { stockQty: true, reservedQty: true },
    });
    expect(Number(after?.stockQty || 0)).toBe(beforeStock);
    expect(Number(after?.reservedQty || 0)).toBe(beforeReserved - 1);

    const cart = await prisma.storeCart.findUnique({
      where: { userId },
      include: { items: true },
    });
    expect(cart?.status).toBe('ACTIVE');
    expect(cart?.items?.length || 0).toBe(0);

    await context.close();
  });
});
