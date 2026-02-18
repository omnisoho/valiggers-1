const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const {
  getPaymentOrder,
  payPaymentOrder,
  cancelPaymentOrder,
} = require('../models/Payment.model');

const router = express.Router();

// GET /api/payment/orders/:orderId
router.get('/orders/:orderId', authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.userId);
    const orderId = Number(req.params.orderId);
    if (!orderId) return res.status(400).json({ error: 'Invalid order id' });

    const order = await getPaymentOrder({ userId, orderId });
    return res.status(200).json(order);
  } catch (err) {
    if (String(err.message) === 'OrderNotFound') {
      return res.status(404).json({ error: 'Order not found' });
    }
    return res.status(500).json({ error: 'Failed to load order' });
  }
});

// POST /api/payment/orders/:orderId/pay
router.post('/orders/:orderId/pay', authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.userId);
    const orderId = Number(req.params.orderId);
    if (!orderId) return res.status(400).json({ error: 'Invalid order id' });

    const paid = await payPaymentOrder({ userId, orderId });
    return res.status(200).json(paid);
  } catch (err) {
    if (String(err.message) === 'OrderNotFound') {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (String(err.message) === 'SessionTimeout') {
      return res.status(409).json({ error: 'Checkout session timed out. Please add items again.' });
    }
    if (String(err.message) === 'OrderLocked') {
      return res.status(409).json({ error: 'Order is no longer payable.' });
    }
    return res.status(500).json({ error: 'Payment failed' });
  }
});

// POST /api/payment/orders/:orderId/cancel
router.post('/orders/:orderId/cancel', authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.userId);
    const orderId = Number(req.params.orderId);
    if (!orderId) return res.status(400).json({ error: 'Invalid order id' });

    const cancelled = await cancelPaymentOrder({ userId, orderId });
    return res.status(200).json(cancelled);
  } catch (err) {
    if (String(err.message) === 'OrderNotFound') {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (String(err.message) === 'SessionTimeout') {
      return res.status(409).json({ error: 'Checkout session timed out. Please add items again.' });
    }
    if (String(err.message) === 'OrderLocked') {
      return res.status(409).json({ error: 'Order is no longer cancellable.' });
    }
    return res.status(500).json({ error: 'Cancel failed' });
  }
});

module.exports = router;
