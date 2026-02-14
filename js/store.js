/* =========================
   store.js  (CLEAN, NO DUPES)
   + MERGE guest -> user
   + SAFE INPUT (string/object)
   + POST-AUTH REDIRECT helpers
   + (optional) Supabase auth sync
   ========================= */

/* ===== JSON helpers ===== */
function getJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function setJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getUid() {
  const uid = localStorage.getItem("sb_uid");
  return (uid && uid.trim()) ? uid.trim() : "guest";
}

function k(base, uid = getUid()) {
  return `${base}:${uid}`;
}

/* ===== Post-auth redirect ===== */
function setPostAuthRedirect(url) {
  try {
    const u = String(url || location.href);
    localStorage.setItem("post_auth_redirect", u);
  } catch {}
}
function popPostAuthRedirect() {
  try {
    const v = localStorage.getItem("post_auth_redirect") || "";
    if (v) localStorage.removeItem("post_auth_redirect");
    return v;
  } catch { return ""; }
}

/* ✅ НОРМАЛИЗАЦИЯ ID */
function normId(v) {
  return String(v ?? '').trim().replace(/^0+/, '') || '0';
}

/* ✅ приводим вход к объекту товара (даже если прилетела строка) */
function asProduct(input) {
  if (input && typeof input === "object") return input;
  return { id: String(input || "").trim() };
}

/* ✅ безопасный id */
function safeId(input) {
  const id = String(input ?? "").trim();
  const nid = normId(id);
  if (!id || !nid || nid === "0") return "";
  return id;
}

/* ===== Favorites ===== */
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

function toggleFav(productOrId) {
  const product = asProduct(productOrId);
  const favs = getFavorites();

  const id = safeId(product.id);
  if (!id) return favs; // ✅ НЕ пушим пустышки

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

/* ===== Cart ===== */
function getCart(uid) {
  return getJSON(k('cart', uid), []);
}
function setCart(arr, uid) {
  setJSON(k('cart', uid), Array.isArray(arr) ? arr : []);
}

function addToCart(productOrId, qty = 1) {
  const product = asProduct(productOrId);
  const cart = getCart();

  const id = safeId(product.id);
  if (!id) return cart; // ✅ НЕ пушим пустышки

  const q = Number(qty) || 1;

  const item = cart.find(p => normId(p.id) === normId(id));

  if (item) {
    item.qty = (Number(item.qty) || 1) + q;
    item.title = product.title || item.title || '';
    item.price = String(product.price || item.price || '');
    item.img = product.img || item.img || '';
    item.desc = product.desc || item.desc || '';
    item.id = id;
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

/* ===== MERGE guest -> user =====
   Важно: после мержа чистим guest, чтобы при логауте не "возвращалось" */
function mergeGuestToUser(newUid) {
  const uid = String(newUid || '').trim();
  if (!uid || uid === 'guest') return;

  const guestFav = getFavorites('guest');
  const guestCart = getCart('guest');

  if ((!guestFav || guestFav.length === 0) && (!guestCart || guestCart.length === 0)) return;

  const userFav = getFavorites(uid);
  const userCart = getCart(uid);

  const favMap = new Map();
  [...userFav, ...guestFav].forEach(p => {
    const id = safeId(p?.id);
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

  const cartMap = new Map();
  [...userCart, ...guestCart].forEach(p => {
    const idRaw = safeId(p?.id);
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

  // ✅ критично: чистим гостевые ключи
  localStorage.removeItem(k('favorites', 'guest'));
  localStorage.removeItem(k('cart', 'guest'));

  try { updateFavBadge(); } catch {}
  try { updateCartBadge(); } catch {}
}

/* ===== animateAdded ===== */
function animateAdded(btn, opts = {}) {
  if (!btn) return;

  const { duration = 700, text = null, keepText = null } = opts;

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

function formatPriceUAH(value) {
  return parseFloat(String(value).replace(',', '.').replace(/[^\d.]/g, '')) || 0;
}
window.formatPriceUAH = formatPriceUAH;

/* ===== scroll lock for modals (no layout shift + header safe) ===== */
(function () {
  let locked = false;
  let savedY = 0;

  const prev = {
    body: {
      position: "",
      top: "",
      left: "",
      right: "",
      width: "",
      paddingRight: "",
    },
    header: {
      paddingRight: "",
    }
  };

  function getScrollbarWidth() {
    return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  }

  function lockBodyScroll() {
    if (locked) return;
    locked = true;

    savedY = window.scrollY || document.documentElement.scrollTop || 0;

    const header = document.querySelector(".site-header");
    const sbw = getScrollbarWidth();

    // сохраняем текущие инлайны
    prev.body.paddingRight = document.body.style.paddingRight;
    prev.body.position = document.body.style.position;
    prev.body.top = document.body.style.top;
    prev.body.left = document.body.style.left;
    prev.body.right = document.body.style.right;
    prev.body.width = document.body.style.width;

    if (header) prev.header.paddingRight = header.style.paddingRight;

    // 1) компенсация скроллбара (body + header)
    if (sbw > 0) {
      const bodyPR = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = (bodyPR + sbw) + "px";

      if (header) {
        const headerPR = parseFloat(getComputedStyle(header).paddingRight) || 0;
        header.style.paddingRight = (headerPR + sbw) + "px";
      }
    }

    // 2) фиксируем body
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function unlockBodyScroll() {
    if (!locked) return;
    locked = false;

    const header = document.querySelector(".site-header");

    // возвращаем body
    document.body.style.position = prev.body.position;
    document.body.style.top = prev.body.top;
    document.body.style.left = prev.body.left;
    document.body.style.right = prev.body.right;
    document.body.style.width = prev.body.width;
    document.body.style.paddingRight = prev.body.paddingRight;

    // возвращаем header
    if (header) header.style.paddingRight = prev.header.paddingRight;

    requestAnimationFrame(() => {
      window.scrollTo(0, savedY);
    });
  }

  window.lockBodyScroll = lockBodyScroll;
  window.unlockBodyScroll = unlockBodyScroll;
})();

/* ===== Optional: sync with Supabase auth changes =====
   Это страховка: если где-то произошёл SIGNED_IN, мы:
   - сохраняем sb_uid
   - делаем merge guest -> user (один раз, гостевые ключи потом пустые)
*/
(function initSupabaseAuthSync(){
  try {
    const sb = window.sb;
    if (!sb?.auth?.onAuthStateChange) return;

    sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.id) {
        const uid = session.user.id;
        localStorage.setItem("sb_uid", uid);
        try { mergeGuestToUser(uid); } catch {}
      }

      if (event === "SIGNED_OUT") {
        // чистим только маркеры сессии (user key остаётся в localStorage под uid, но недоступен без sb_uid)
        localStorage.removeItem("sb_uid");
        localStorage.removeItem("user");
      }
    });
  } catch {}
})();

/* ===== expose ===== */
window.getJSON = getJSON;
window.setJSON = setJSON;
window.getUid = getUid;
window.k = k;

window.normId = normId;
window.asProduct = asProduct;
window.safeId = safeId;

window.getFavorites = getFavorites;
window.setFavorites = setFavorites;
window.isFav = isFav;
window.toggleFav = toggleFav;
window.updateFavBadge = updateFavBadge;

window.getCart = getCart;
window.setCart = setCart;
window.addToCart = addToCart;
window.getCartCount = getCartCount;
window.updateCartBadge = updateCartBadge;

window.mergeGuestToUser = mergeGuestToUser;

window.animateAdded = animateAdded;

window.setPostAuthRedirect = setPostAuthRedirect;
window.popPostAuthRedirect = popPostAuthRedirect;