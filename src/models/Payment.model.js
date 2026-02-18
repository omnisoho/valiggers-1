const {
  getOrderByUserIdAndId,
  payOrder,
  cancelOrder,
} = require('./Store.model');

async function getPaymentOrder({ userId, orderId }) {
  return getOrderByUserIdAndId({ userId, orderId });
}

async function payPaymentOrder({ userId, orderId }) {
  return payOrder({ userId, orderId });
}

async function cancelPaymentOrder({ userId, orderId }) {
  return cancelOrder({ userId, orderId });
}

module.exports = {
  getPaymentOrder,
  payPaymentOrder,
  cancelPaymentOrder,
};
