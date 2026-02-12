/* =========================
   store.js  (CLEAN, NO DUPES)
   + MERGE guest -> user
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
  // auth.js кладёт: localStorage.setItem("sb_uid", user.id)
  const uid = localStorage.getItem("sb_uid");
  return (uid && uid.trim()) ? uid.trim() : "guest";
}

function k(base, uid = getUid()) {
  return `${base}:${uid}`;
}

// ✅ НОРМАЛИЗАЦИЯ ID (ДОЛЖНА БЫТЬ ГЛОБАЛЬНО)
function normId(v) {
  // "000001" -> "1", " 00001 " -> "1"
  return String(v ?? '').trim().replace(/^0+/, '') || '0';
}

// ===== Favorites =====
function getFavorites(uid) {
  return getJSON(k('favorites', uid), []);
}
function setFavorites(arr, uid) {
  setJSON(k('favorites', uid), Array.isArray(arr) ? arr : []);
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
function getCart(uid) {
  return getJSON(k('cart', uid), []);
}
function setCart(arr, uid) {
  setJSON(k('cart', uid), Array.isArray(arr) ? arr : []);
}

function addToCart(product, qty = 1) {
  const cart = getCart();
  const id = String(product.id || '').trim();
  const q = Number(qty) || 1;

  // ✅ сравнение через normId, чтобы "000001" == "1"
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

// ===== MERGE guest -> user =====
function mergeGuestToUser(newUid) {
  const uid = String(newUid || '').trim();
  if (!uid || uid === 'guest') return;

  const guestFav = getFavorites('guest');
  const guestCart = getCart('guest');

  if ((!guestFav || guestFav.length === 0) && (!guestCart || guestCart.length === 0)) return;

  const userFav = getFavorites(uid);
  const userCart = getCart(uid);

  // FAV: union по normId
  const favMap = new Map();
  [...userFav, ...guestFav].forEach(p => {
    const id = String(p?.id || '').trim();
    if (!id) return;
    favMap.set(normId(id), {
      id,
      title: p.title || '',
      price: p.price || '',
      img: p.img || '',
      desc: p.desc || ''
    });
  });
  const mergedFav = Array.from(favMap.values());

  // CART: merge по normId, qty суммируем
  const cartMap = new Map();
  [...userCart, ...guestCart].forEach(p => {
    const idRaw = String(p?.id || '').trim();
    if (!idRaw) return;

    const key = normId(idRaw);
    const qty = Math.max(1, parseInt(p?.qty, 10) || 1);

    if (!cartMap.has(key)) {
      cartMap.set(key, {
        id: idRaw,
        title: p.title || '',
        price: String(p.price || ''),
        img: p.img || '',
        desc: p.desc || '',
        qty
      });
    } else {
      const prev = cartMap.get(key);
      prev.qty = (parseInt(prev.qty, 10) || 1) + qty;
      // добиваем данные если пустые
      prev.title = prev.title || p.title || '';
      prev.price = prev.price || String(p.price || '');
      prev.img = prev.img || p.img || '';
      prev.desc = prev.desc || p.desc || '';
      prev.id = prev.id || idRaw;
      cartMap.set(key, prev);
    }
  });
  const mergedCart = Array.from(cartMap.values());

  setFavorites(mergedFav, uid);
  setCart(mergedCart, uid);

  // чистим гостя
  localStorage.removeItem(k('favorites', 'guest'));
  localStorage.removeItem(k('cart', 'guest'));

  // UI
  try { updateFavBadge(); } catch {}
  try { updateCartBadge(); } catch {}
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

// ===== expose (чтобы auth.js мог дернуть merge) =====
window.mergeGuestToUser = mergeGuestToUser;
window.normId = normId;
window.isFav = isFav;
window.toggleFav = toggleFav;
window.addToCart = addToCart;
window.updateFavBadge = updateFavBadge;
window.updateCartBadge = updateCartBadge;
window.getCart = getCart;
window.getFavorites = getFavorites;
