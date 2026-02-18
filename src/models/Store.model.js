const prisma = require('./prismaClient');
const DEFAULT_STORE_SESSION_TIMEOUT_SECONDS = 30 * 60;

const STORE_PRODUCTS_FALLBACK = [
  {
    id: 10001,
    slug: 'whey-protein',
    name: 'Whey Protein',
    description: 'Premium 25g protein per serving. Low carb, fast-absorbing formula.',
    price: 54.99,
    imageUrl: 'https://www.bareperformancenutrition.com/cdn/shop/files/BPNWPC_VN-8_JR_RENDER_1024x1024.jpg?v=1753802657',
    category: 'SUPPLEMENTS',
    stockQty: 5,
    reservedQty: 0,
    inventoryStatus: 'AVAILABLE',
  },
  {
    id: 10002,
    slug: 'creatine-monohydrate',
    name: 'Creatine Monohydrate',
    description: 'Pure micronized creatine for strength and power gains.',
    price: 29.99,
    imageUrl: 'https://www.bareperformancenutrition.com/cdn/shop/files/BPNCREA-5_1024x1024.jpg?v=1728563526',
    category: 'SUPPLEMENTS',
    stockQty: 5,
    reservedQty: 0,
    inventoryStatus: 'AVAILABLE',
  },
  {
    id: 10003,
    slug: 'high-waist-leggings',
    name: 'High-Waist Leggings',
    description: 'Squat-proof compression leggings with phone pocket.',
    price: 48.99,
    imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcQ1UiXEj5184umXvAvp1rCEzVX1gVX12DN3HSr2VwfHGyRRVmstfvZ19wyTgVMSxcmR_58qR3sdh1L_ZaeMo9YfqVakjW6J1Ejh0ZotFCL4u0anTLLgATThtg',
    category: 'WOMENS_CLOTHING',
    stockQty: 5,
    reservedQty: 0,
    inventoryStatus: 'AVAILABLE',
  },
  {
    id: 10004,
    slug: 'seamless-sports-bra',
    name: 'Seamless Sports Bra',
    description: 'Light support bra with breathable stretch fabric.',
    price: 32.9,
    imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcQIm6-F9O2df3ed9j-IT3VAPPxTB9zuElDGyqU2rhpvMLQG0A2aM9j9gVbBjsTHN2LpbsQ_ihPgqy-3G1zsNuHhMo96sEB6',
    category: 'WOMENS_CLOTHING',
    stockQty: 5,
    reservedQty: 0,
    inventoryStatus: 'AVAILABLE',
  },
  {
    id: 10005,
    slug: 'performance-tank-top',
    name: 'Performance Tank Top',
    description: 'Breathable mesh fabric with moisture-wicking technology.',
    price: 34.99,
    imageUrl: 'https://tailoredathlete.co.uk/cdn/shop/files/Training_Vest_Black__14_2000x.jpg?v=1763490823',
    category: 'MENS_CLOTHING',
    stockQty: 5,
    reservedQty: 0,
    inventoryStatus: 'AVAILABLE',
  },
  {
    id: 10006,
    slug: 'training-shorts-core',
    name: 'Training Shorts (Core)',
    description: 'Lightweight shorts with zip pockets and stretch waist.',
    price: 38,
    imageUrl: 'https://tailoredathlete.co.uk/cdn/shop/files/Training_Shorts_Black__10_5000x.jpg?v=1763485325',
    category: 'MENS_CLOTHING',
    stockQty: 5,
    reservedQty: 0,
    inventoryStatus: 'AVAILABLE',
  },
];

const STORE_CATEGORIES = [
  { key: 'HOME', name: 'Home', value: null },
  { key: 'SUPPLEMENTS', name: 'Supplements', value: 'SUPPLEMENTS' },
  { key: 'WOMENS_CLOTHING', name: "Women's clothing", value: 'WOMENS_CLOTHING' },
  { key: 'MENS_CLOTHING', name: "Men's clothing", value: 'MENS_CLOTHING' },
];

async function getStoreCategories() {
  return STORE_CATEGORIES;
}

function deriveInventoryStatus(stockQty, reservedQty) {
  if (stockQty <= 0) return 'SOLD_OUT';
  if (reservedQty >= stockQty) return 'RESERVED';
  return 'AVAILABLE';
}

function logInv(tag, p) {
  console.log(
    `[INV:${tag}] productId=${p.id} stock=${p.stockQty} reserved=${p.reservedQty} available=${p.stockQty - p.reservedQty} status=${p.inventoryStatus}`
  );
}

async function recomputeAndLog(tx, productId, tag) {
  const p = await tx.storeProduct.findUnique({
    where: { id: productId },
    select: { id: true, stockQty: true, reservedQty: true, inventoryStatus: true },
  });
  if (!p) return;

  const next = deriveInventoryStatus(p.stockQty, p.reservedQty);

  if (next !== p.inventoryStatus) {
    const updated = await tx.storeProduct.update({
      where: { id: productId },
      data: { inventoryStatus: next },
      select: { id: true, stockQty: true, reservedQty: true, inventoryStatus: true },
    });
    logInv(`${tag}:recompute`, updated);
    return;
  }

  logInv(`${tag}:unchanged`, p);
}

function getStoreSessionCutoff() {
  const raw = Number(process.env.STORE_SESSION_TIMEOUT_SECONDS);
  const seconds = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_STORE_SESSION_TIMEOUT_SECONDS;
  return new Date(Date.now() - seconds * 1000);
}

async function releaseReservedQtySafe(tx, productId, requestedQty, tag) {
  const product = await tx.storeProduct.findUnique({
    where: { id: productId },
    select: { id: true, stockQty: true, reservedQty: true, inventoryStatus: true },
  });

  if (!product) return 0;

  const releaseQty = Math.max(0, Math.min(Number(requestedQty) || 0, Number(product.reservedQty) || 0));
  if (releaseQty === 0) {
    await recomputeAndLog(tx, productId, `${tag}:NO_RELEASE`);
    return 0;
  }

  await tx.storeProduct.update({
    where: { id: productId },
    data: { reservedQty: { decrement: releaseQty } },
  });

  await recomputeAndLog(tx, productId, `${tag}:RELEASE`);
  return releaseQty;
}

async function touchCartActivity(tx, cartId) {
  await tx.storeCart.update({
    where: { id: cartId },
    data: { updatedAt: new Date() },
    select: { id: true },
  });
}

async function expireStoreSessionForUser(userId) {
  return prisma.$transaction(async (tx) => {
    const cutoff = getStoreSessionCutoff();

    const cart = await tx.storeCart.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        items: { select: { productId: true, quantity: true } },
      },
    });

    const pendingOrder = await tx.storeOrder.findFirst({
      where: { userId, status: 'PENDING_PAYMENT' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        items: { select: { productId: true, quantity: true } },
      },
    });

    if (pendingOrder && pendingOrder.createdAt < cutoff) {
      for (const it of pendingOrder.items) {
        await releaseReservedQtySafe(tx, it.productId, it.quantity, 'EXPIRE_ORDER');
      }

      await tx.storeOrder.update({
        where: { id: pendingOrder.id },
        data: { status: 'EXPIRED' },
      });

      if (cart) {
        await tx.storeCartItem.deleteMany({ where: { cartId: cart.id } });
        await tx.storeCart.update({
          where: { id: cart.id },
          data: { status: 'EXPIRED' },
        });
      }

      return { expired: true, reason: 'PAYMENT_TIMEOUT', orderId: pendingOrder.id };
    }

    const activeCartTimedOut =
      cart &&
      cart.status === 'ACTIVE' &&
      cart.items.length > 0 &&
      cart.updatedAt < cutoff;

    if (activeCartTimedOut) {
      for (const it of cart.items) {
        await releaseReservedQtySafe(tx, it.productId, it.quantity, 'EXPIRE_CART');
      }

      await tx.storeCartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.storeCart.update({
        where: { id: cart.id },
        data: { status: 'EXPIRED' },
      });

      return { expired: true, reason: 'CART_TIMEOUT' };
    }

    return { expired: false };
  });
}

async function expireAllStoreSessions() {
  const cutoff = getStoreSessionCutoff();
  let expiredActiveCarts = [];
  let expiredPendingOrders = [];
  try {
    [expiredActiveCarts, expiredPendingOrders] = await Promise.all([
      prisma.storeCart.findMany({
        where: {
          status: 'ACTIVE',
          updatedAt: { lt: cutoff },
          items: { some: {} },
        },
        select: { userId: true },
      }),
      prisma.storeOrder.findMany({
        where: {
          status: 'PENDING_PAYMENT',
          createdAt: { lt: cutoff },
        },
        select: { userId: true },
      }),
    ]);
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      // CI/test DB may not have store tables yet; keep cron non-fatal.
      return { scannedUsers: 0, expiredCount: 0 };
    }
    throw err;
  }

  const userIds = new Set([
    ...expiredActiveCarts.map((x) => x.userId),
    ...expiredPendingOrders.map((x) => x.userId),
  ]);

  let expiredCount = 0;
  for (const userId of userIds) {
    const result = await expireStoreSessionForUser(userId);
    if (result?.expired) expiredCount += 1;
  }

  return { scannedUsers: userIds.size, expiredCount };
}

function assertCanReserve(product, qty) {
  const available = product.stockQty - product.reservedQty;
  if (available < qty) throw new Error('OutOfStock');
}

function isDatabaseUnavailableError(err) {
  const text = String(err?.message || err || '');
  const name = String(err?.name || '');
  const code = String(err?.code || '');
  return (
    name.includes('PrismaClientInitializationError') ||
    name.includes('PrismaClientKnownRequestError') ||
    text.includes("Can't reach database server") ||
    text.includes('does not exist in the current database') ||
    text.includes('ECONNREFUSED') ||
    text.includes('ETIMEDOUT') ||
    code === 'P2021' || // table does not exist
    code === 'P1001' || // cannot reach DB
    code === 'P1002' // timeout talking to DB
  );
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function tokenizeWords(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function levenshteinDistance(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  const n = s.length;
  const m = t.length;
  if (n === 0) return m;
  if (m === 0) return n;

  const prev = new Array(m + 1);
  const curr = new Array(m + 1);

  for (let j = 0; j <= m; j += 1) prev[j] = j;

  for (let i = 1; i <= n; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= m; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= m; j += 1) prev[j] = curr[j];
  }

  return prev[m];
}

function scoreNameMatch(name, query) {
  const rawName = String(name || '').toLowerCase().trim();
  const rawQuery = String(query || '').toLowerCase().trim();
  if (!rawQuery) return 1;
  if (!rawName) return 0;

  const nameCompact = normalizeSearchText(rawName);
  const queryCompact = normalizeSearchText(rawQuery);
  if (!queryCompact) return 1;

  // Strong exact-ish matches first.
  if (rawName === rawQuery) return 3000;
  if (nameCompact === queryCompact) return 2800;
  if (rawName.includes(rawQuery)) return 2400 + rawQuery.length;
  if (nameCompact.includes(queryCompact)) return 2200 + queryCompact.length;

  // Token prefix support: "prot" -> "protein", multi-word tolerant.
  const queryTokens = tokenizeWords(rawQuery);
  const nameTokens = tokenizeWords(rawName);
  if (
    queryTokens.length > 0 &&
    queryTokens.every((qt) => nameTokens.some((nt) => nt.startsWith(qt)))
  ) {
    return 1800 + queryTokens.length * 10;
  }

  // Typo tolerance (Levenshtein on compact strings).
  const distance = levenshteinDistance(queryCompact, nameCompact);
  const maxLen = Math.max(queryCompact.length, nameCompact.length) || 1;
  const similarity = 1 - distance / maxLen;
  if (similarity >= 0.55) {
    return Math.round(1000 * similarity);
  }

  return 0;
}

function fuzzyFilterAndPaginate(items, search, take = 40, skip = 0) {
  if (!search) {
    const total = items.length;
    const start = Math.max(0, Number(skip) || 0);
    const end = start + Math.max(0, Number(take) || 40);
    return { items: items.slice(start, end), total };
  }

  const scored = items
    .map((item) => ({
      item,
      score: scoreNameMatch(item?.name, search),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || String(a.item.name).localeCompare(String(b.item.name)));

  const total = scored.length;
  const start = Math.max(0, Number(skip) || 0);
  const end = start + Math.max(0, Number(take) || 40);
  return { items: scored.slice(start, end).map((x) => x.item), total };
}

function getFallbackProducts({ category, search, take = 40, skip = 0 }) {
  let items = STORE_PRODUCTS_FALLBACK.slice();

  if (category) {
    items = items.filter((p) => p.category === category);
  }

  return fuzzyFilterAndPaginate(items, search, take, skip);
}

async function getStoreProducts({ category, search, take = 40, skip = 0 }) {
  const baseWhere = {
    isActive: true,
    ...(category ? { category } : {}),
  };

  const runQuery = async () => {
    if (!search) {
      const [items, total] = await Promise.all([
        prisma.storeProduct.findMany({
          where: baseWhere,
          orderBy: [{ createdAt: 'desc' }],
          take: Number(take),
          skip: Number(skip),
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            price: true,
            imageUrl: true,
            category: true,
            stockQty: true,
            reservedQty: true,
            inventoryStatus: true,
          },
        }),
        prisma.storeProduct.count({ where: baseWhere }),
      ]);

      return { items, total };
    }

    const items = await prisma.storeProduct.findMany({
      where: baseWhere,
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        category: true,
        stockQty: true,
        reservedQty: true,
        inventoryStatus: true,
      },
    });

    return fuzzyFilterAndPaginate(items, search, take, skip);
  };

  try {
    return await runQuery();
  } catch (err) {
    if (!isDatabaseUnavailableError(err)) throw err;

    // Brief retry to ride out transient migration/reset windows in shared CI DBs.
    await new Promise((r) => setTimeout(r, 250));

    try {
      return await runQuery();
    } catch (retryErr) {
      if (isDatabaseUnavailableError(retryErr)) {
        console.warn('Store DB unavailable. Serving fallback product data.');
        return getFallbackProducts({ category, search, take, skip });
      }
      throw retryErr;
    }
  }
}

async function getStoreProductBySlug(slug) {
  try {
    return prisma.storeProduct.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        category: true,
        stockQty: true,
        reservedQty: true,
        inventoryStatus: true,
      },
    });
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return STORE_PRODUCTS_FALLBACK.find((p) => p.slug === slug) || null;
    }
    throw err;
  }
}

async function getFavouriteProductIds(userId) {
  const rows = await prisma.storeFavourite.findMany({
    where: { userId },
    select: { productId: true },
  });
  return rows.map((r) => Number(r.productId));
}

async function toggleStoreFavourite({ userId, productId }) {
  const product = await prisma.storeProduct.findUnique({
    where: { id: productId },
    select: { id: true, isActive: true },
  });
  if (!product || !product.isActive) throw new Error('Invalid product');

  const existing = await prisma.storeFavourite.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.storeFavourite.delete({
      where: { userId_productId: { userId, productId } },
    });
    return { productId, favourited: false };
  }

  await prisma.storeFavourite.create({
    data: { userId, productId },
  });
  return { productId, favourited: true };
}

async function getFavouriteProducts({ userId, category, search, take = 40, skip = 0 }) {
  const where = {
    userId,
    product: {
      isActive: true,
      ...(category ? { category } : {}),
    },
  };

  const rows = await prisma.storeFavourite.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    select: {
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          price: true,
          imageUrl: true,
          category: true,
          stockQty: true,
          reservedQty: true,
          inventoryStatus: true,
        },
      },
    },
  });

  const items = rows.map((r) => r.product);
  return fuzzyFilterAndPaginate(items, search, take, skip);
}

async function getOrCreateCart(userId) {
  const cart = await prisma.storeCart.upsert({
    where: { userId },
    update: {},
    create: { userId, status: 'ACTIVE' },
    select: { id: true, userId: true, status: true },
  });

  if (cart.status === 'EXPIRED') {
    return prisma.storeCart.update({
      where: { id: cart.id },
      data: { status: 'ACTIVE' },
      select: { id: true, userId: true, status: true },
    });
  }

  return cart;
}

async function getOrCreateCartTx(tx, userId) {
  const existing = await tx.storeCart.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (existing) return existing;

  return tx.storeCart.create({
    data: { userId, status: 'ACTIVE' },
    select: { id: true, status: true },
  });
}

function isCartUserUniqueError(err) {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  return code === 'P2002' && msg.includes('`userId`');
}

async function runStoreTxWithRetry(work, retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await prisma.$transaction(work, { maxWait: 5000, timeout: 15000 });
    } catch (err) {
      lastErr = err;
      if (!isCartUserUniqueError(err) || i === retries) throw err;
      await new Promise((r) => setTimeout(r, 25 * (i + 1)));
    }
  }
  throw lastErr;
}

async function getCartByUserIdWithClient(db, userId) {
  const cart = await db.storeCart.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      status: true,
      items: {
        orderBy: { createdAt: 'asc' },
        select: {
          productId: true,
          quantity: true,
          product: { select: { name: true, price: true, imageUrl: true } },
        },
      },
    },
  });

  if (!cart) return { userId, status: 'ACTIVE', items: [], totalQty: 0, subtotal: 0 };

  const items = cart.items.map((it) => ({
    productId: it.productId,
    name: it.product.name,
    price: Number(it.product.price),
    imageUrl: it.product.imageUrl,
    qty: it.quantity,
    lineTotal: Number(it.product.price) * it.quantity,
  }));

  const totalQty = items.reduce((s, it) => s + it.qty, 0);
  const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);

  return { userId: cart.userId, status: cart.status, items, totalQty, subtotal };
}

async function getCartByUserId(userId) {
  const session = await expireStoreSessionForUser(userId);
  const cart = await getCartByUserIdWithClient(prisma, userId);

  if (session?.expired) {
    return {
      ...cart,
      sessionTimedOut: true,
      timeoutReason: session.reason || 'TIMEOUT',
    };
  }

  return cart;
}

async function addCartItem({ userId, productId, quantityDelta = 1 }) {
  if (quantityDelta <= 0) throw new Error('Invalid quantity');
  await expireStoreSessionForUser(userId);

  await runStoreTxWithRetry(async (tx) => {
    const product = await tx.storeProduct.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true, stockQty: true, reservedQty: true, inventoryStatus: true },
    });

    if (!product || !product.isActive) throw new Error('Invalid product');

    // enforce inventory
    assertCanReserve(product, quantityDelta);

    let cart = await getOrCreateCartTx(tx, userId);

    if (cart.status === 'EXPIRED') {
      cart = await tx.storeCart.update({
        where: { id: cart.id },
        data: { status: 'ACTIVE' },
        select: { id: true, status: true },
      });
    }

    if (cart.status !== 'ACTIVE') throw new Error('CartLocked');

    await tx.storeCartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      update: { quantity: { increment: quantityDelta } },
      create: { cartId: cart.id, productId, quantity: quantityDelta },
    });
    await touchCartActivity(tx, cart.id);

    // reserve inventory
    const updated = await tx.storeProduct.update({
      where: { id: productId },
      data: { reservedQty: { increment: quantityDelta } },
      select: { id: true, stockQty: true, reservedQty: true, inventoryStatus: true },
    });

    if (updated.reservedQty > updated.stockQty) {
      throw new Error('OutOfStock');
    }

    // recompute status + log it to terminal
    await recomputeAndLog(tx, productId, 'ADD');
  });
  return getCartByUserId(userId);
}

async function updateCartItemQty({ userId, productId, delta }) {
  if (![1, -1].includes(delta)) throw new Error('Invalid delta');
  await expireStoreSessionForUser(userId);

  await runStoreTxWithRetry(async (tx) => {
    let cart = await getOrCreateCartTx(tx, userId);

    if (cart.status === 'EXPIRED') {
      cart = await tx.storeCart.update({
        where: { id: cart.id },
        data: { status: 'ACTIVE' },
        select: { id: true, status: true },
      });
    }

    if (cart.status !== 'ACTIVE') throw new Error('CartLocked');

    const existing = await tx.storeCartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
      select: { quantity: true },
    });

    if (!existing) return;

    // +1 => need reserve
    if (delta === 1) {
      const product = await tx.storeProduct.findUnique({
        where: { id: productId },
        select: { id: true, isActive: true, stockQty: true, reservedQty: true, inventoryStatus: true },
      });
      if (!product || !product.isActive) throw new Error('Invalid product');

      assertCanReserve(product, 1);

      await tx.storeCartItem.update({
        where: { cartId_productId: { cartId: cart.id, productId } },
        data: { quantity: { increment: 1 } },
      });
      await touchCartActivity(tx, cart.id);

      const updated = await tx.storeProduct.update({
        where: { id: productId },
        data: { reservedQty: { increment: 1 } },
        select: { id: true, stockQty: true, reservedQty: true, inventoryStatus: true },
      });

      // ✅ oversell safety check
      if (updated.reservedQty > updated.stockQty) {
        throw new Error('OutOfStock');
      }

      await recomputeAndLog(tx, productId, 'INC');
      return;
    }

    // -1 => release reserve
    const nextQty = existing.quantity - 1;

    if (nextQty <= 0) {
      await tx.storeCartItem.delete({
        where: { cartId_productId: { cartId: cart.id, productId } },
      });
    } else {
      await tx.storeCartItem.update({
        where: { cartId_productId: { cartId: cart.id, productId } },
        data: { quantity: nextQty },
      });
    }
    await touchCartActivity(tx, cart.id);

    await tx.storeProduct.update({
      where: { id: productId },
      data: { reservedQty: { decrement: 1 } },
    });

    await recomputeAndLog(tx, productId, 'DEC');
  });
  return getCartByUserId(userId);
}

async function getOrderByUserIdAndId({ userId, orderId }) {
  await expireStoreSessionForUser(userId);

  const order = await prisma.storeOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      status: true,
      subtotal: true,
      createdAt: true,
      updatedAt: true,
      items: {
        orderBy: { id: 'asc' },
        select: {
          productId: true,
          quantity: true,
          unitPrice: true,
          product: {
            select: {
              name: true,
              imageUrl: true,
            },
          },
        },
      },
    },
  });

  if (!order || order.userId !== userId) throw new Error('OrderNotFound');

  const items = order.items.map((it) => ({
    productId: it.productId,
    name: it.product?.name || 'Product',
    imageUrl: it.product?.imageUrl || '',
    qty: it.quantity,
    price: Number(it.unitPrice),
    lineTotal: Number(it.unitPrice) * it.quantity,
  }));

  const totalQty = items.reduce((sum, it) => sum + Number(it.qty || 0), 0);

  return {
    id: order.id,
    status: order.status,
    subtotal: Number(order.subtotal),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    totalQty,
    items,
  };
}

async function payOrder({ userId, orderId }) {
  await expireStoreSessionForUser(userId);

  return prisma.$transaction(async (tx) => {
    const order = await tx.storeOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
        items: { select: { productId: true, quantity: true } },
      },
    });

    if (!order || order.userId !== userId) throw new Error('OrderNotFound');
    if (order.status === 'EXPIRED') throw new Error('SessionTimeout');
    if (order.status !== 'PENDING_PAYMENT') throw new Error('OrderLocked');

    for (const it of order.items) {
      // convert reserved -> sold
      await tx.storeProduct.update({
        where: { id: it.productId },
        data: {
          stockQty: { decrement: it.quantity },
          reservedQty: { decrement: it.quantity },
        },
      });
      await recomputeAndLog(tx, it.productId, 'PAY');
    }

    await tx.storeOrder.update({
      where: { id: orderId },
      data: { status: 'PAID' },
    });

    const cart = await tx.storeCart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (cart) {
      await tx.storeCartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.storeCart.update({
        where: { id: cart.id },
        data: { status: 'ACTIVE' },
      });
    }

    console.log(`[ORDER:PAY] orderId=${orderId} -> PAID`);
    return { id: orderId, status: 'PAID' };
  });
}

async function cancelOrder({ userId, orderId }) {
  await expireStoreSessionForUser(userId);

  return prisma.$transaction(async (tx) => {
    const order = await tx.storeOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
        items: { select: { productId: true, quantity: true } },
      },
    });

    if (!order || order.userId !== userId) throw new Error('OrderNotFound');
    if (order.status === 'EXPIRED') throw new Error('SessionTimeout');
    if (order.status !== 'PENDING_PAYMENT') throw new Error('OrderLocked');

    for (const it of order.items) {
      await tx.storeProduct.update({
        where: { id: it.productId },
        data: { reservedQty: { decrement: it.quantity } },
      });
      await recomputeAndLog(tx, it.productId, 'CANCEL');
    }

    await tx.storeOrder.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    });

    const cart = await tx.storeCart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (cart) {
      await tx.storeCartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.storeCart.update({
        where: { id: cart.id },
        data: { status: 'ACTIVE' },
      });
    }

    console.log(`[ORDER:CANCEL] orderId=${orderId} -> CANCELLED`);
    return { id: orderId, status: 'CANCELLED' };
  });
}

// State transition: ACTIVE -> CHECKED_OUT
async function checkoutCart(userId) {
  await expireStoreSessionForUser(userId);

  return prisma.$transaction(async (tx) => {
    const cart = await tx.storeCart.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            product: { select: { price: true } },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) throw new Error('CartEmpty');
    if (cart.status !== 'ACTIVE') {
      if (cart.status === 'EXPIRED') throw new Error('SessionTimeout');
      throw new Error('CartLocked');
    }

    // compute subtotal
    const subtotal = cart.items.reduce(
      (s, it) => s + Number(it.product.price) * it.quantity,
      0
    );

    // create order
    const order = await tx.storeOrder.create({
      data: {
        userId,
        status: 'PENDING_PAYMENT',
        subtotal,
        items: {
          create: cart.items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.product.price,
          })),
        },
      },
      select: { id: true, status: true, subtotal: true },
    });

    // lock cart
    await tx.storeCart.update({
      where: { id: cart.id },
      data: { status: 'CHECKED_OUT' },
    });

    return order;
  });
}

module.exports = {
  getStoreCategories,
  getStoreProducts,
  getStoreProductBySlug,
  getFavouriteProductIds,
  getFavouriteProducts,
  toggleStoreFavourite,
  getOrCreateCart,
  getCartByUserId,
  addCartItem,
  updateCartItemQty,
  checkoutCart,
  getOrderByUserIdAndId,
  expireStoreSessionForUser,
  expireAllStoreSessions,
  payOrder,
  cancelOrder,
};
