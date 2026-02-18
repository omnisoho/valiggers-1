const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');

const {
  getStoreCategories,
  getStoreProducts,
  getStoreProductBySlug,
  getFavouriteProductIds,
  getFavouriteProducts,
  toggleStoreFavourite,
  getCartByUserId,
  addCartItem,
  updateCartItemQty,
  checkoutCart,
} = require('../models/Store.model');

const router = express.Router();

/**
 * GET /api/store/categories
 * Public
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await getStoreCategories();
    return res.status(200).json(categories);
  } catch (err) {
    console.error('GET /api/store/categories error:', err);
    return res.status(500).json({ error: 'Failed to load categories' });
  }
});

/**
 * GET /api/store/products?category=&search=&take=&skip=
 * Public
 */
router.get('/products', async (req, res) => {
  try {
    const { category, search, take, skip } = req.query;

    const result = await getStoreProducts({
      category: category || null,
      search: search || null,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /api/store/products error:', err);
    return res.status(500).json({ error: 'Failed to load products' });
  }
});

/**
 * GET /api/store/products/:slug
 * Public
 */
router.get('/products/:slug', async (req, res) => {
  try {
    const product = await getStoreProductBySlug(req.params.slug);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.status(200).json(product);
  } catch (err) {
    console.error('GET /api/store/products/:slug error:', err);
    return res.status(500).json({ error: 'Failed to load product' });
  }
});

// GET /api/store/favourites/ids (requires login)
router.get('/favourites/ids', authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.userId);
    const productIds = await getFavouriteProductIds(userId);
    return res.status(200).json({ productIds });
  } catch (err) {
    console.error('GET /api/store/favourites/ids error:', err);
    return res.status(500).json({ error: 'Failed to load favourites' });
  }
});

// GET /api/store/favourites?category=&search=&take=&skip= (requires login)
router.get('/favourites', authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.userId);
    const { category, search, take, skip } = req.query;

    const result = await getFavouriteProducts({
      userId,
      category: category || null,
      search: search || null,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /api/store/favourites error:', err);
    return res.status(500).json({ error: 'Failed to load favourites' });
  }
});

// POST /api/store/favourites/:productId/toggle (requires login)
router.post('/favourites/:productId/toggle', authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.userId);
    const productId = Number(req.params.productId);
    if (!productId) return res.status(400).json({ error: 'Invalid product id' });

    const result = await toggleStoreFavourite({ userId, productId });
    return res.status(200).json(result);
  } catch (err) {
    if (String(err.message).includes('Invalid product')) {
      return res.status(400).json({ error: 'Invalid product' });
    }
    return res.status(500).json({ error: 'Failed to update favourite' });
  }
});

// GET /api/store/cart (requires login)
router.get('/cart', authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.userId);
    const cart = await getCartByUserId(userId);
    return res.status(200).json(cart);
  } catch (err) {
    console.error('GET /api/store/cart error:', err);
    return res.status(500).json({ error: 'Failed to load cart' });
  }
});

// POST /api/store/cart/items (requires login)
router.post('/cart/items', authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.userId);
    const productId = Number(req.body.productId);

    if (!productId) return res.status(400).json({ error: 'productId is required' });

    const cart = await addCartItem({ userId, productId, quantityDelta: 1 });
    return res.status(200).json(cart);
  } catch (err) {
    console.warn('POST /api/store/cart/items error:', err.message);

    if (String(err.message).includes('Invalid product')) {
      return res.status(400).json({ error: 'Invalid product' });
    }
    if (String(err.message) === 'OutOfStock') {
      return res.status(409).json({ error: 'Out of stock' });
    }
    if (String(err.message) === 'CartLocked') {
      return res.status(409).json({ error: 'Cart is locked. Please checkout or start a new cart.' });
    }

    return res.status(500).json({ error: 'Failed to add to cart' });
  }
});

// PATCH /api/store/cart/items/:productId (requires login)
router.patch('/cart/items/:productId', authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.userId);
    const productId = Number(req.params.productId);
    const delta = Number(req.body.delta);

    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }
    if (![1, -1].includes(delta)) {
      return res.status(400).json({ error: 'delta must be 1 or -1' });
    }

    const cart = await updateCartItemQty({ userId, productId, delta });
    return res.status(200).json(cart);

    } catch (err) {
    console.warn('PATCH /api/store/cart/items/:productId error:', err.message);

    if (String(err.message) === 'CartLocked') {
      return res.status(409).json({
        error: 'Cart is locked. Please checkout or start a new cart.',
      });
    }
    if (String(err.message) === 'OutOfStock') {
      return res.status(409).json({ error: 'Out of stock' });
    }

    return res.status(500).json({ error: 'Failed to update quantity' });
  }
});


// POST /api/store/cart/checkout (requires login)
router.post('/cart/checkout', authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.userId);
    const order = await checkoutCart(userId);
    return res.status(201).json(order);
  } catch (err) {
    if (String(err.message) === 'CartEmpty') return res.status(400).json({ error: 'Cart is empty' });
    if (String(err.message) === 'SessionTimeout') {
      return res.status(409).json({ error: 'Checkout session timed out. Please add items again.' });
    }
    if (String(err.message) === 'CartLocked') return res.status(409).json({ error: 'Cart already checked out' });
    return res.status(500).json({ error: 'Checkout failed' });
  }
});

module.exports = router;
