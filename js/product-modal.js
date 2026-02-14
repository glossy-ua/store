// js/product-modal.js
function $(sel) { return document.querySelector(sel); }

const modal = $('#productModal');
const pmImg = $('#pmImg');
const pmThumbs = $('#pmThumbs');
const pmPrev = $('#pmPrev');
const pmNext = $('#pmNext');

const pmTitle = $('#pmTitle');
const pmCode = $('#pmCode');
const pmPrice = $('#pmPrice');
const pmDesc = $('#pmDesc');
const pmFav = $('#pmFav');
const pmQty = $('#pmQty');
const pmAddToCart = $('#pmAddToCart');

let currentProduct = null;

// gallery state
let galleryUrls = [];
let galleryIndex = 0;

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safePrice(val) {
  const n = parseFloat(String(val ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function setFavBtnState(btn, active) {
  if (!btn) return;
  btn.classList.toggle('active', !!active);
  btn.textContent = active ? '♥️' : '♡';
}

function safeParseJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function normalizeImgs(p) {
  const arr =
    Array.isArray(p?.imgs) ? p.imgs :
    (typeof p?.imgs === "string" ? safeParseJson(p.imgs) : null);

  const urls = (arr && Array.isArray(arr) ? arr : [])
    .map(x => String(x || "").trim())
    .filter(Boolean);

  const main = String(p?.img || "").trim();
  if (main && !urls.includes(main)) urls.unshift(main);

  return urls.length ? urls : (main ? [main] : []);
}

function renderGallery(urls, startUrl = "") {
  galleryUrls = Array.isArray(urls) ? urls : [];
  galleryIndex = 0;

  if (!galleryUrls.length) {
    if (pmImg) pmImg.src = "";
    if (pmThumbs) { pmThumbs.innerHTML = ""; pmThumbs.style.display = "none"; }
    if (pmPrev) pmPrev.disabled = true;
    if (pmNext) pmNext.disabled = true;
    return;
  }

  if (startUrl) {
    const i = galleryUrls.indexOf(startUrl);
    if (i >= 0) galleryIndex = i;
  }

  setMainImage(galleryIndex);
  renderThumbs();
  syncNav();
}

function setMainImage(i) {
  if (!galleryUrls.length) return;

  // ✅ круг
  galleryIndex = (i + galleryUrls.length) % galleryUrls.length;
  const url = galleryUrls[galleryIndex];

  if (pmImg) {
    pmImg.src = url;
    pmImg.alt = currentProduct?.title || "";
  }

  if (pmThumbs) {
    pmThumbs.querySelectorAll('.pm-thumb').forEach((b, idx) => {
      b.classList.toggle('is-active', idx === galleryIndex);
    });
  }

  syncNav();
}

function renderThumbs() {
  if (!pmThumbs) return;

  if (galleryUrls.length <= 1) {
    pmThumbs.innerHTML = "";
    pmThumbs.style.display = "none";
    return;
  }

  pmThumbs.style.display = "";
  pmThumbs.innerHTML = galleryUrls.map((url, idx) => `
    <button class="pm-thumb ${idx === galleryIndex ? "is-active" : ""}" type="button" data-idx="${idx}">
      <img src="${escHtml(url)}" alt="">
    </button>
  `).join("");
}

function syncNav() {
  const multi = galleryUrls.length > 1;
  if (pmPrev) pmPrev.disabled = !multi;
  if (pmNext) pmNext.disabled = !multi;
}

function setDesc(desc) {
  if (!pmDesc) return;
  const text = String(desc || "").trim();
  if (!text) {
    pmDesc.textContent = "Опис буде додано пізніше 🙂";
    return;
  }
  const hasTags = /<\/?[a-z][\s\S]*>/i.test(text);
  pmDesc[hasTags ? "innerHTML" : "textContent"] = text;
}

// open/close
function openModal(product) {
  if (!modal) return;

  currentProduct = product || null;
  if (!currentProduct) return;

  const priceNum = safePrice(currentProduct.priceNum ?? currentProduct.price);
  const priceText = priceNum ? `${priceNum.toFixed(2)} грн.` : (currentProduct.priceText || "");

  if (pmTitle) pmTitle.textContent = currentProduct.title || '';
  if (pmCode) pmCode.textContent = currentProduct.id ? `Код: ${currentProduct.id}` : '';
  if (pmPrice) pmPrice.textContent = priceText || '';
  setDesc(currentProduct.desc);
  if (pmQty) pmQty.value = 1;

  // ✅ gallery
  const urls = normalizeImgs(currentProduct);
  renderGallery(urls, currentProduct.img || "");

  // fav
  if (typeof window.isFav === "function") setFavBtnState(pmFav, window.isFav(currentProduct.id));

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  window.lockBodyScroll?.();
}

function closeModal() {
  if (!modal) return;

  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');

  window.unlockBodyScroll?.();

  currentProduct = null;
  galleryUrls = [];
  galleryIndex = 0;
  if (pmThumbs) { pmThumbs.innerHTML = ""; pmThumbs.style.display = "none"; }
}

window.openProductModal = openModal;

// overlay / x close
document.addEventListener('click', (e) => {
  if (!modal?.classList.contains('open')) return;
  if (e.target?.dataset?.close === '1') closeModal();
});

// ESC + arrows
document.addEventListener('keydown', (e) => {
  if (!modal?.classList.contains('open')) return;

  if (e.key === 'Escape') closeModal();
  if (e.key === 'ArrowLeft') setMainImage(galleryIndex - 1);
  if (e.key === 'ArrowRight') setMainImage(galleryIndex + 1);
});

// thumbs click
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.pm-thumb');
  if (!btn || !modal?.classList.contains('open')) return;
  const idx = parseInt(btn.dataset.idx, 10);
  if (!Number.isFinite(idx)) return;
  setMainImage(idx);
});

// prev/next click
pmPrev?.addEventListener('click', () => setMainImage(galleryIndex - 1));
pmNext?.addEventListener('click', () => setMainImage(galleryIndex + 1));

/* ✅ SWIPE (по кругу) */
(function initModalSwipe(){
  // пробуем найти галерею в модалке
  const galleryEl = document.querySelector('#productModal .pm-gallery') || pmImg?.closest?.('.pm-gallery');
  if (!galleryEl) return;

  let x0 = null;
  let y0 = null;
  let active = false;

  galleryEl.addEventListener('pointerdown', (e) => {
    if (!modal?.classList.contains('open')) return;
    active = true;
    x0 = e.clientX;
    y0 = e.clientY;
    try { galleryEl.setPointerCapture(e.pointerId); } catch {}
  });

  galleryEl.addEventListener('pointerup', (e) => {
    if (!active) return;
    active = false;

    if (!modal?.classList.contains('open')) return;

    const dx = e.clientX - (x0 ?? e.clientX);
    const dy = e.clientY - (y0 ?? e.clientY);
    x0 = null; y0 = null;

    // если больше вертикально — это скролл, не листаем
    if (Math.abs(dy) > Math.abs(dx)) return;

    if (Math.abs(dx) < 30) return;

    if (dx < 0) setMainImage(galleryIndex + 1);
    else setMainImage(galleryIndex - 1);
  });

  galleryEl.addEventListener('pointercancel', () => {
    active = false;
    x0 = null; y0 = null;
  });
})();

// qty +/- inside modal
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.qty__btn');
  if (!btn) return;
  if (!modal?.classList.contains('open')) return;
  if (!btn.closest('.pmodal')) return;

  const wrap = btn.closest('.qty');
  const input = wrap?.querySelector('input');
  if (!input) return;

  let val = parseInt(input.value, 10) || 1;
  if (btn.dataset.action === 'plus') val++;
  if (btn.dataset.action === 'minus') val = Math.max(1, val - 1);
  input.value = val;
});

// modal fav
document.addEventListener('click', (e) => {
  if (!e.target.closest('#pmFav')) return;
  if (!currentProduct) return;

  const prod = {
    id: currentProduct.id,
    title: currentProduct.title,
    price: String(safePrice(currentProduct.priceNum ?? currentProduct.price) || currentProduct.price || ""),
    img: currentProduct.img,
    desc: currentProduct.desc || "",
    imgs: normalizeImgs(currentProduct),
  };

  window.toggleFav?.(prod);
  if (typeof window.isFav === "function") setFavBtnState(pmFav, window.isFav(currentProduct.id));
  window.refreshFavButtons?.();
  window.updateFavBadge?.();
});

// modal add to cart
document.addEventListener('click', (e) => {
  if (!e.target.closest('#pmAddToCart')) return;
  if (!currentProduct) return;

  const qty = Math.max(1, parseInt(pmQty?.value, 10) || 1);

  const prod = {
    id: currentProduct.id,
    title: currentProduct.title,
    price: String(safePrice(currentProduct.priceNum ?? currentProduct.price) || currentProduct.price || ""),
    img: currentProduct.img,
    desc: currentProduct.desc || "",
    imgs: normalizeImgs(currentProduct),
  };

  window.addToCart?.(prod, qty);
  window.updateCartBadge?.();

  window.animateAdded?.(pmAddToCart, { duration: 700, text: "Додано", keepText: false });
});
