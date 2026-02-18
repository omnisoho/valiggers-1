const API_BASE = '/api/payment';
const CHECKOUT_ORDER_KEY = 'fitcore_checkout_order';
const SHIPPING_FEE = 4;
const ORDER_POLL_MS = 5000;
const TIMEOUT_REDIRECT_MS = 2200;

const els = {
  cardNumber: document.getElementById('cardNumber'),
  cardExpiry: document.getElementById('cardExpiry'),
  cardCvv: document.getElementById('cardCvv'),
  payBtn: document.getElementById('payBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  paymentLayout: document.getElementById('paymentLayout'),
  confirmPanel: document.getElementById('confirmPanel'),
  stepPayment: document.getElementById('stepPayment'),
  stepConfirm: document.getElementById('stepConfirm'),
  orderIdText: document.getElementById('orderIdText'),
  summaryItems: document.getElementById('summaryItems'),
  summaryCount: document.getElementById('summaryCount'),
  subtotalValue: document.getElementById('subtotalValue'),
  shippingValue: document.getElementById('shippingValue'),
  totalValue: document.getElementById('totalValue'),
  sessionMessage: document.getElementById('sessionMessage'),
  requiredInputs: [
    document.getElementById('cardName'),
    document.getElementById('cardNumber'),
    document.getElementById('cardExpiry'),
    document.getElementById('cardCvv'),
    document.getElementById('billFirstName'),
    document.getElementById('billLastName'),
    document.getElementById('billAddress'),
    document.getElementById('billPostal'),
    document.getElementById('billCountry'),
  ],
};

let currentOrderId = null;
let orderPollTimer = null;
let timeoutRedirectTimer = null;

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '$0.00';
}

function getAuthToken() {
  return localStorage.getItem('token');
}

async function fetchJSON(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) throw new Error('AUTH_REQUIRED');
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function getOrderIdFromContext() {
  const fromUrl = Number(new URLSearchParams(window.location.search).get('orderId'));
  if (Number.isFinite(fromUrl) && fromUrl > 0) return fromUrl;

  const fromStorage = Number(localStorage.getItem(CHECKOUT_ORDER_KEY));
  if (Number.isFinite(fromStorage) && fromStorage > 0) return fromStorage;

  return null;
}

function showSessionMessage(text, isError = false) {
  if (!els.sessionMessage) return;
  els.sessionMessage.textContent = text;
  els.sessionMessage.classList.remove('hidden', 'error');
  if (isError) els.sessionMessage.classList.add('error');
}

function renderSummaryFromOrder(order) {
  els.summaryItems.innerHTML = '';

  const items = order.items || [];
  const subtotal = Number(order.subtotal || 0);
  const shipping = items.length > 0 ? SHIPPING_FEE : 0;
  const total = subtotal + shipping;
  const totalQty = Number(order.totalQty || items.reduce((sum, item) => sum + Number(item.qty || 0), 0));

  els.summaryCount.textContent = `${totalQty} item${totalQty === 1 ? '' : 's'}`;
  els.subtotalValue.textContent = money(subtotal);
  els.shippingValue.textContent = money(shipping);
  els.totalValue.textContent = money(total);

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'summary-empty';
    empty.textContent = 'No order items found.';
    els.summaryItems.appendChild(empty);
    return;
  }

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'summary-row';
    row.innerHTML = `
      <div>
        <p class="item-name">${item.name || 'Product'}</p>
        <p class="item-meta">Qty x${Number(item.qty || 1)}</p>
      </div>
      <span>${money(item.lineTotal || 0)}</span>
    `;
    els.summaryItems.appendChild(row);
  }
}

function setTimedOutState() {
  els.payBtn.disabled = true;
  if (els.cancelBtn) els.cancelBtn.disabled = true;
  showSessionMessage(
    'Session timed out after 30 minutes. Items were released. Redirecting to store...',
    true
  );

  try {
    localStorage.removeItem(CHECKOUT_ORDER_KEY);
  } catch (err) {
    console.warn('Failed to clear checkout order id:', err);
  }

  if (!timeoutRedirectTimer) {
    timeoutRedirectTimer = window.setTimeout(() => {
      window.location.href = './store.html';
    }, TIMEOUT_REDIRECT_MS);
  }
}

function setCancelledState() {
  els.payBtn.disabled = true;
  if (els.cancelBtn) els.cancelBtn.disabled = true;
  showSessionMessage('Order was cancelled. Redirecting to store...', true);
  stopOrderPolling();

  try {
    localStorage.removeItem(CHECKOUT_ORDER_KEY);
  } catch (err) {
    console.warn('Failed to clear checkout order id:', err);
  }

  if (!timeoutRedirectTimer) {
    timeoutRedirectTimer = window.setTimeout(() => {
      window.location.href = './store.html';
    }, TIMEOUT_REDIRECT_MS);
  }
}

function stopOrderPolling() {
  if (!orderPollTimer) return;
  window.clearInterval(orderPollTimer);
  orderPollTimer = null;
}

function formatCardNumber(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 16);
  const chunks = digits.match(/.{1,4}/g) || [];
  return chunks.join(' ');
}

function formatExpiry(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function formatCvv(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 4);
}

function setupCardInputFormatting() {
  els.cardNumber?.addEventListener('input', (e) => {
    e.target.value = formatCardNumber(e.target.value);
  });

  els.cardExpiry?.addEventListener('input', (e) => {
    e.target.value = formatExpiry(e.target.value);
  });

  els.cardCvv?.addEventListener('input', (e) => {
    e.target.value = formatCvv(e.target.value);
  });
}

function validateForm() {
  for (const input of els.requiredInputs) {
    if (!input || !input.value.trim()) {
      input?.focus();
      return false;
    }
  }
  return true;
}

function markConfirmed(orderId) {
  els.paymentLayout.classList.add('hidden');
  els.confirmPanel.classList.remove('hidden');
  els.stepPayment.classList.remove('current');
  els.stepPayment.classList.add('done');
  els.stepConfirm.classList.add('current');
  els.orderIdText.textContent = `FC-${String(orderId)}`;

  try {
    localStorage.removeItem(CHECKOUT_ORDER_KEY);
  } catch (err) {
    console.warn('Failed to clear checkout order id:', err);
  }

  if (window.lucide?.createIcons) window.lucide.createIcons();
}

async function loadOrderOrFail() {
  currentOrderId = getOrderIdFromContext();
  if (!currentOrderId) {
    showSessionMessage('No active checkout found. Return to store and checkout again.', true);
    els.payBtn.disabled = true;
    return;
  }

  try {
    const order = await fetchJSON(`${API_BASE}/orders/${currentOrderId}`);
    renderSummaryFromOrder(order);

    if (order.status === 'EXPIRED') {
      stopOrderPolling();
      setTimedOutState();
      return;
    }

    if (order.status === 'PAID') {
      stopOrderPolling();
      markConfirmed(order.id);
      return;
    }

    if (order.status === 'CANCELLED') {
      setCancelledState();
      return;
    }

    if (order.status !== 'PENDING_PAYMENT') {
      els.payBtn.disabled = true;
      if (els.cancelBtn) els.cancelBtn.disabled = true;
      stopOrderPolling();
      showSessionMessage(`Order is ${order.status}.`, true);
      return;
    }

    els.payBtn.disabled = false;
    if (els.cancelBtn) els.cancelBtn.disabled = false;
  } catch (err) {
    if (err.message === 'AUTH_REQUIRED') {
      window.location.href = './login.html';
      return;
    }
    showSessionMessage(err.message || 'Failed to load order.', true);
    els.payBtn.disabled = true;
  }
}

function setupPayAction() {
  els.payBtn.addEventListener('click', async () => {
    if (els.payBtn.disabled) return;

    if (!validateForm()) {
      alert('Please complete all payment and billing fields.');
      return;
    }
    if (!currentOrderId) {
      alert('No active order found.');
      return;
    }

    els.payBtn.disabled = true;
    const original = els.payBtn.textContent;
    els.payBtn.textContent = 'Processing...';

    try {
      const paid = await fetchJSON(`${API_BASE}/orders/${currentOrderId}/pay`, { method: 'POST' });
      markConfirmed(paid.id || currentOrderId);
      stopOrderPolling();
    } catch (err) {
      if (String(err.message).toLowerCase().includes('timed out')) {
        setTimedOutState();
      } else if (err.message === 'AUTH_REQUIRED') {
        window.location.href = './login.html';
      } else {
        alert(err.message || 'Payment failed');
        els.payBtn.disabled = false;
      }
    } finally {
      els.payBtn.textContent = original;
    }
  });
}

function setupCancelAction() {
  els.cancelBtn?.addEventListener('click', async () => {
    if (!currentOrderId) return;

    const confirmed = window.confirm('Cancel this order? Reserved items will be released.');
    if (!confirmed) return;

    els.cancelBtn.disabled = true;

    try {
      await fetchJSON(`${API_BASE}/orders/${currentOrderId}/cancel`, { method: 'POST' });
      setCancelledState();
    } catch (err) {
      if (String(err.message).toLowerCase().includes('timed out')) {
        setTimedOutState();
      } else if (err.message === 'AUTH_REQUIRED') {
        window.location.href = './login.html';
      } else {
        alert(err.message || 'Cancel failed');
        els.cancelBtn.disabled = false;
      }
    }
  });
}

async function init() {
  setupCardInputFormatting();
  setupPayAction();
  setupCancelAction();
  await loadOrderOrFail();
  if (!els.payBtn.disabled) {
    orderPollTimer = window.setInterval(() => {
      loadOrderOrFail().catch((err) => console.warn('Order poll failed:', err));
    }, ORDER_POLL_MS);
  }
  if (window.lucide?.createIcons) window.lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', init);
