const API_BASE = '/api/store';
const CHECKOUT_ORDER_KEY = 'fitcore_checkout_order';
const CART_POLL_MS = 5000;

const els = {
  grid: document.getElementById('productGrid'),
  count: document.getElementById('productCount'),
  search: document.getElementById('searchInput'),
  subnav: document.getElementById('subnav'),
  categoryBtns: Array.from(document.querySelectorAll('.subnav-link')),
  cartCount: document.getElementById('cartCount'),
  favBtn: document.getElementById('favBtn'),

  // cart drawer
  cartBtn: document.getElementById('cartBtn'),
  cartOverlay: document.getElementById('cartOverlay'),
  cartDrawer: document.getElementById('cartDrawer'),
  cartCloseBtn: document.getElementById('cartCloseBtn'),
  cartItems: document.getElementById('cartItems'),
  cartEmpty: document.getElementById('cartEmpty'),
  cartSubtext: document.getElementById('cartSubtext'),
  cartSubtotal: document.getElementById('cartSubtotal'),
  cartCheckoutBtn: document.getElementById('cartCheckoutBtn'),
};

let state = {
  category: null, // enum key: SUPPLEMENTS / WOMENS_CLOTHING / MENS_CLOTHING
  search: '',
  favouritesOnly: false,
  items: [],
  total: 0,
};

// Frontend-only cart view for now (we’ll sync badge + optionally render later)
let cart = { items: [], totalQty: 0 };
let timeoutNoticeShown = false;
let favouriteIds = new Set();

const qtyInFlight = new Set(); // productId currently patching

/* =========================
   AUTH + FETCH HELPERS
   ========================= */

function getAuthToken() {
  // IMPORTANT: this must match whatever your login page stores.
  // If your login stores under a different key, change 'token' here.
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
    // AUTH ERROR
    if (res.status === 401 && (data.error === 'AUTH_REQUIRED' || data.error === 'Missing token')) {
      if (String(url).includes('/favourites')) {
        throw new Error('Please log in to favourite products.');
      }
      throw new Error('Please log in to add items to your cart.');
    }

    // inventory / business errors
    if (res.status === 409 && data.error === 'Out of stock') {
      throw new Error('Sorry, this item is out of stock.');
    }
    if (res.status === 409 && String(data.error || '').toLowerCase().includes('timed out')) {
      throw new Error('Your checkout session timed out. Please add items to cart again.');
    }

    // fallback
    throw new Error(data.error || 'Something went wrong. Please try again.');
  }

  return data;
}

async function refreshCartBadgeFromServer() {
  const token = getAuthToken();
  if (!token) {
    // not logged in = no DB cart identity, show 0
    if (els.cartCount) els.cartCount.textContent = '0';
    return;
  }

  const data = await fetchJSON(`${API_BASE}/cart`);
  cart = data || { items: [], totalQty: 0 };

  if (els.cartCount) els.cartCount.textContent = String(cart.totalQty || 0);
}

async function refreshFavouritesFromServer() {
  const token = getAuthToken();
  if (!token) {
    favouriteIds = new Set();
    return;
  }

  const data = await fetchJSON(`${API_BASE}/favourites/ids`);
  const ids = Array.isArray(data?.productIds) ? data.productIds : [];
  favouriteIds = new Set(ids.map((x) => Number(x)));
}

/* =========================
   CART DRAWER UI (frontend)
   ========================= */

function openCart() {
  document.body.classList.add('cart-open');
  els.cartOverlay.hidden = false;
  els.cartDrawer.setAttribute('aria-hidden', 'false');
}

function maybeShowTimeoutNotice() {
  if (timeoutNoticeShown) return;
  const timedOut = cart?.sessionTimedOut || cart?.status === 'EXPIRED';
  if (!timedOut) return;

  timeoutNoticeShown = true;
  alert('Your cart session timed out after 30 minutes. Items were released and your cart is now empty.');
}

function closeCart() {
  document.body.classList.remove('cart-open');
  els.cartOverlay.hidden = true;
  els.cartDrawer.setAttribute('aria-hidden', 'true');
}

// For now, render from `cart.items` if backend returns them
function renderCart() {
  const totalItems = Number(cart.totalQty || 0);
  els.cartSubtext.textContent = `${totalItems} item${totalItems === 1 ? '' : 's'}`;

  els.cartItems.innerHTML = '';

  const isEmpty = !cart.items || cart.items.length === 0;
  els.cartEmpty.style.display = isEmpty ? 'block' : 'none';
  els.cartCheckoutBtn.disabled = isEmpty;

  // Subtotal placeholder for now
  els.cartSubtotal.textContent = money(cart.subtotal || 0);
  maybeShowTimeoutNotice();

  if (isEmpty) return;

  // Name + qty display only (no +/-/remove backend yet)
  for (const item of cart.items) {
    const row = document.createElement('div');
    row.className = 'cart-row';

    row.innerHTML = `
      <img class="cart-thumb" src="${item.imageUrl}" alt="${item.name}" loading="lazy"/>

      <div class="cart-info">
        <p class="cart-name">${item.name}</p>
        <div class="cart-meta">
          <span class="cart-price">${money(item.price)}</span>
          <span class="cart-dot">•</span>
          <div class="qty-control" data-product-id="${item.productId}">
            <button class="qty-btn-sm" data-action="dec" aria-label="Decrease quantity">−</button>
            <span class="qty-pill">${item.qty}</span>
            <button class="qty-btn-sm" data-action="inc" aria-label="Increase quantity">+</button>
          </div>
        </div>
      </div>

      <div class="cart-right">
        <div class="cart-line-total">${money(item.lineTotal)}</div>
      </div>
    `;

    els.cartItems.appendChild(row);
  }

    els.cartItems.querySelectorAll('.qty-control').forEach((wrap) => {
    const productId = Number(wrap.dataset.productId);

    wrap.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const action = btn.dataset.action;
      const delta = action === 'inc' ? 1 : -1;

      // ignore spam clicks but DON'T disable the button in DOM
      if (qtyInFlight.has(productId)) return;
      qtyInFlight.add(productId);

      try {
        const updatedCart = await fetchJSON(`${API_BASE}/cart/items/${productId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delta }),
        });

        cart = updatedCart || cart;
        if (els.cartCount) els.cartCount.textContent = String(cart.totalQty || 0);

        renderCart();
        if (window.lucide?.createIcons) window.lucide.createIcons();
      } catch (err) {
        console.error(err);
        alert(err.message || 'Failed to update quantity');
      } finally {
        qtyInFlight.delete(productId);
      }
    });
  });
}

/* =========================
   CATEGORY MAP
   ========================= */

// Map your UI labels to DB categories.
const UI_CATEGORY_TO_ENUM = {
  Home: null,
  Supplements: 'SUPPLEMENTS',
  "Women's clothing": 'WOMENS_CLOTHING',
  "Men's clothing": 'MENS_CLOTHING',
};

/* =========================
   HELPERS
   ========================= */

function money(price) {
  const n = Number(price);
  if (Number.isFinite(n)) return `$${n.toFixed(2)}`;
  return `$${price}`;
}

/* =========================
   RENDER + LOAD PRODUCTS
   ========================= */

function renderProducts() {
  els.grid.innerHTML = '';

  if (!state.items.length) {
    const empty = document.createElement('div');
    empty.className = 'products-empty';
    empty.textContent = state.favouritesOnly ? 'No favourite products found.' : 'No products found.';
    els.grid.appendChild(empty);
    els.count.textContent = '0 products';
    return;
  }

  for (const p of state.items) {
    const categoryNameMap = {
      SUPPLEMENTS: 'SUPPLEMENTS',
      WOMENS_CLOTHING: "WOMEN'S CLOTHING",
      MENS_CLOTHING: "MEN'S CLOTHING",
    };

    const categoryName = categoryNameMap[p.category] || '';

    const card = document.createElement('article');
    card.className = 'card';
    const isFav = favouriteIds.has(Number(p.id));

    card.innerHTML = `
      <div class="card-media">
        <button class="fav-chip ${isFav ? 'active' : ''}" data-product-id="${p.id}" aria-label="Toggle favourite" title="Toggle favourite">
          <i data-lucide="heart"></i>
        </button>
        <img src="${p.imageUrl}" alt="${p.name}" loading="lazy" />
      </div>

      <div class="card-body">
        <div class="card-tag">${categoryName}</div>
        <h3 class="card-name">${p.name}</h3>
        <p class="card-desc">${p.description}</p>

        <div class="card-bottom">
          <div class="price">${money(p.price)}</div>
          <button class="add-btn" data-product-id="${p.id}">
            <i data-lucide="shopping-cart"></i>
            Add
          </button>
        </div>
      </div>
    `;

    els.grid.appendChild(card);
  }

  els.count.textContent = `${state.total} product${state.total === 1 ? '' : 's'}`;

  // Refresh lucide icons for dynamically injected markup
  if (window.lucide?.createIcons) window.lucide.createIcons();

  // Wire Add buttons (REAL add-to-cart)
  els.grid.querySelectorAll('.add-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const productId = Number(btn.dataset.productId);

      // optimistic UI: disable button briefly
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Adding...';

      try {
        const updatedCart = await fetchJSON(`${API_BASE}/cart/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        });

        cart = updatedCart || cart;

        if (els.cartCount) els.cartCount.textContent = String(cart.totalQty || 0);

        // pop drawer to show it worked
        openCart();
        renderCart();
        if (window.lucide?.createIcons) window.lucide.createIcons();
      } catch (err) {
          alert(err.message);
          if (err.message.includes('log in')) {
            window.location.href = './login.html';
          }
      } finally {
        btn.disabled = false;
        btn.textContent = originalText || 'Add';
        if (window.lucide?.createIcons) window.lucide.createIcons();
      }
    });
  });

  // Wire favourite buttons
  els.grid.querySelectorAll('.fav-chip').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const token = getAuthToken();
      if (!token) {
        alert('Please log in to save favourites.');
        window.location.href = './login.html';
        return;
      }

      const productId = Number(btn.dataset.productId);
      if (!productId) return;

      btn.disabled = true;
      try {
        const result = await fetchJSON(`${API_BASE}/favourites/${productId}/toggle`, { method: 'POST' });
        const isNowFav = !!result?.favourited;

        if (isNowFav) favouriteIds.add(productId);
        else favouriteIds.delete(productId);

        if (state.favouritesOnly) {
          await loadProducts();
        } else {
          btn.classList.toggle('active', isNowFav);
          if (window.lucide?.createIcons) window.lucide.createIcons();
        }
      } catch (err) {
        alert(err.message || 'Failed to update favourite');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

async function loadProducts() {
  const params = new URLSearchParams();
  if (state.search) params.set('search', state.search);
  if (state.category) params.set('category', state.category);

  const endpoint = state.favouritesOnly ? `${API_BASE}/favourites` : `${API_BASE}/products`;
  const data = await fetchJSON(`${endpoint}?${params.toString()}`);
  state.items = data.items || [];
  state.total = data.total ?? state.items.length;

  try {
    await refreshFavouritesFromServer();
  } catch (e) {
    // Do not block product rendering when favourites API is unavailable.
    console.warn('Favourites refresh failed:', e);
    favouriteIds = new Set();
  }
  renderProducts();
}

/* =========================
   UI EVENTS
   ========================= */

function setActiveCategoryButton(btnEl) {
  els.categoryBtns.forEach((b) => b.classList.remove('active'));
  btnEl.classList.add('active');
}

function setupCategoryButtons() {
  els.categoryBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const uiLabel = btn.dataset.category;
      state.category = UI_CATEGORY_TO_ENUM[uiLabel] ?? null;

      setActiveCategoryButton(btn);
      await loadProducts();
    });
  });
}

function setupSearch() {
  let t = null;
  els.search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      state.search = els.search.value.trim();
      await loadProducts();
    }, 250);
  });
}

function setupFavouriteFilter() {
  els.favBtn?.addEventListener('click', async () => {
    const token = getAuthToken();
    if (!token) {
      alert('Please log in to view favourites.');
      window.location.href = './login.html';
      return;
    }

    state.favouritesOnly = !state.favouritesOnly;
    els.favBtn.classList.toggle('active', state.favouritesOnly);
    await loadProducts();
  });
}

// Subnav hide-on-scroll
function setupSubnavScrollBehavior() {
  let lastY = window.scrollY;

  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;

      if (y > lastY && y > 40) {
        els.subnav.classList.add('hidden');
      } else {
        els.subnav.classList.remove('hidden');
      }

      lastY = y;
    },
    { passive: true }
  );
}

async function init() {
  setupCategoryButtons();
  setupSearch();
  setupFavouriteFilter();
  setupSubnavScrollBehavior();

  // Cart drawer open/close
  els.cartBtn?.addEventListener('click', async () => {
    // refresh from server when opening (so it’s always accurate)
    try {
      await refreshCartBadgeFromServer();
    } catch (e) {
      // if token invalid/expired, treat as logged out
      console.warn('Cart refresh failed:', e);
    }

    openCart();
    renderCart();
    if (window.lucide?.createIcons) window.lucide.createIcons();
  });

  els.cartCloseBtn?.addEventListener('click', closeCart);
  els.cartOverlay?.addEventListener('click', closeCart);
  els.cartCheckoutBtn?.addEventListener('click', async () => {
    const hasItems = Array.isArray(cart.items) && cart.items.length > 0;
    if (!hasItems) return;

    const token = getAuthToken();
    if (!token) {
      window.location.href = './login.html';
      return;
    }

    els.cartCheckoutBtn.disabled = true;
    const originalText = els.cartCheckoutBtn.textContent;
    els.cartCheckoutBtn.textContent = 'Processing...';

    try {
      const order = await fetchJSON(`${API_BASE}/cart/checkout`, { method: 'POST' });
      localStorage.setItem(CHECKOUT_ORDER_KEY, String(order.id));
      window.location.href = `./payment.html?orderId=${encodeURIComponent(order.id)}`;
    } catch (err) {
      alert(err.message || 'Checkout failed');
      await refreshCartBadgeFromServer();
      renderCart();
    } finally {
      els.cartCheckoutBtn.textContent = originalText;
      els.cartCheckoutBtn.disabled = !hasItems;
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCart();
  });

  // initial load
  await loadProducts();

  // load cart badge (only if logged in)
  try {
    await refreshCartBadgeFromServer();
    await refreshFavouritesFromServer();
  } catch (e) {
    console.warn('Initial cart badge fetch failed:', e);
  }

  window.setInterval(async () => {
    if (document.hidden) return;
    if (!getAuthToken()) return;

    try {
      await refreshCartBadgeFromServer();
      const cartOpen = document.body.classList.contains('cart-open');
      if (cartOpen) {
        renderCart();
        if (window.lucide?.createIcons) window.lucide.createIcons();
      }
    } catch (e) {
      console.warn('Cart poll failed:', e);
    }
  }, CART_POLL_MS);
}

init().catch((err) => {
  console.error('Store init error:', err);
  els.count.textContent = 'Failed to load products';
});
