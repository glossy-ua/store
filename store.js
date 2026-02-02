/* =========================
   store.js  (CLEAN, NO DUPES)
   ========================= */

// ===== JSON helpers =====
function getJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function setJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getUid() {
  // ты уже кладёшь это в auth.js: localStorage.setItem("sb_uid", user.id)
  const uid = localStorage.getItem("sb_uid");
  return (uid && uid.trim()) ? uid.trim() : "guest";
}

function k(base) {
  return `${base}:${getUid()}`;
}

// ✅ НОРМАЛИЗАЦИЯ ID (ДОЛЖНА БЫТЬ ГЛОБАЛЬНО)
function normId(v) {
  // "000001" -> "1", " 00001 " -> "1"
  return String(v ?? '').trim().replace(/^0+/, '') || '0';
}

function getUserScopedKey(baseKey) {
  // uid сохраняем при логине/регистрации (можно и без этого, но так проще)
  const uid =
    localStorage.getItem("sb_uid") ||
    (window.sb ? null : null);

  return uid ? `${baseKey}:${uid}` : `${baseKey}:guest`;
}

// ===== Favorites =====
function getFavorites() {
  return getJSON(k('favorites'), []);
}
function setFavorites(arr) {
  setJSON(k('favorites'), Array.isArray(arr) ? arr : []);
}


function isFav(id) {
  const nid = normId(id);
  return getFavorites().some(p => normId(p.id) === nid);
}

function toggleFav(product) {
  const favs = getFavorites();
  const id = String(product.id || '').trim();

  const i = favs.findIndex(p => normId(p.id) === normId(id));

  if (i >= 0) {
    favs.splice(i, 1);
  } else {
    favs.push({
      id,
      title: product.title || '',
      price: product.price || '',
      img: product.img || '',
      desc: product.desc || ''
    });
  }

  setFavorites(favs);
  return favs;
}

function updateFavBadge() {
  const count = getFavorites().length;
  document.querySelectorAll('.header-actions a[title="Закладки"] .badge')
    .forEach(b => b.textContent = count);
}

// ===== Cart =====
function getCart() {
  return getJSON(k('cart'), []);
}
function setCart(arr) {
  setJSON(k('cart'), Array.isArray(arr) ? arr : []);
}



function addToCart(product, qty = 1) {
  const cart = getCart();
  const id = String(product.id || '').trim();
  const q = Number(qty) || 1;

  // ✅ лучше тоже сравнивать через normId, чтобы "000001" == "1"
  const item = cart.find(p => normId(p.id) === normId(id));

  if (item) {
    item.qty = (Number(item.qty) || 1) + q;
    item.title = product.title || item.title || '';
    item.price = String(product.price || item.price || '');
    item.img = product.img || item.img || '';
    item.desc = product.desc || item.desc || '';
    item.id = id; // сохраняем красивый оригинальный id
  } else {
    cart.push({
      id,
      title: product.title || '',
      price: String(product.price || ''),
      img: product.img || '',
      desc: product.desc || '',
      qty: q
    });
  }

  setCart(cart);
  return cart;
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
}

function updateCartBadge() {
  const count = getCartCount();
  document.querySelectorAll('.header-actions a[title="Кошик"] .badge')
    .forEach(b => b.textContent = count);
}



// ===== Price helper =====
function formatPriceUAH(value) {
  const num = parseFloat(String(value).replace(',', '.').replace(/[^\d.]/g, '')) || 0;
  return num;
}

// ===== animateAdded (универсальная, НЕ ломает иконки) =====
function animateAdded(btn, opts = {}) {
  if (!btn) return;

  const {
    duration = 700,
    text = null,
    keepText = null
  } = opts;

  btn.classList.remove('btn-added');
  btn.removeAttribute('data-added');
  void btn.offsetWidth;

  const oldText = btn.textContent;
  const isIconLike = oldText.trim().length <= 2;
  const shouldKeepText = (keepText !== null) ? keepText : isIconLike;

  if (text && !shouldKeepText) btn.textContent = text;

  btn.classList.add('btn-added');
  btn.setAttribute('data-added', '1');

  window.setTimeout(() => {
    btn.classList.remove('btn-added');
    btn.removeAttribute('data-added');
    if (text && !shouldKeepText) btn.textContent = oldText;
  }, duration);
}
