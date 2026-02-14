/* =========================
   products.js (catalog pages)
   ========================= */

function $(sel) { return document.querySelector(sel); }

function getProductFromCard(card) {
  return {
    id: String(card.dataset.code || ''),
    title: card.dataset.title || card.querySelector('.product-card__title')?.innerText?.trim() || '',
    price: card.dataset.price || card.querySelector('.product-card__price')?.innerText?.trim() || '',
    img: card.dataset.img || card.querySelector('.product-card__img img')?.getAttribute('src') || '',
    desc: card.dataset.desc || '',
    imgs: String(card.dataset.imgs || '')
  };
}

function setFavBtnState(btn, active) {
  if (!btn) return;
  btn.classList.toggle('active', active);
  btn.textContent = active ? '♥️' : '♡';
}

// ===== MODAL refs =====
const modal = $('#productModal');
const pmImg = $('#pmImg');
const pmTitle = $('#pmTitle');
const pmCode = $('#pmCode');
const pmPrice = $('#pmPrice');
const pmDesc = $('#pmDesc');
const pmFav = $('#pmFav');
const pmQty = $('#pmQty');
const pmAddToCart = $('#pmAddToCart');

let currentProduct = null;

function openModal(product) {
  // ✅ if new gallery modal exists, use it
  if (typeof window.openProductModal === "function" && window.openProductModal !== openModal) {
    window.openProductModal(product);
    return;
  }
  if (!modal) return;
  currentProduct = product;

  if (pmImg) { pmImg.src = product.img || ''; pmImg.alt = product.title || ''; }
  if (pmTitle) pmTitle.textContent = product.title || '';
  if (pmCode) pmCode.textContent = product.id ? `Код: ${product.id}` : '';
  if (pmPrice) {
  const n = parseFloat(String(product.price || '').replace(',', '.').replace(/[^\d.]/g, '')) || 0;
  pmPrice.textContent = n ? `${n.toFixed(2)} грн.` : '';
}

  // в товарах desc может быть обычным текстом — выводим как текст
  if (pmDesc) pmDesc.textContent = product.desc || 'Опис буде додано пізніше 🙂';
  if (pmQty) pmQty.value = 1;

  if (pmFav) {
    pmFav.style.display = '';
    setFavBtnState(pmFav, isFav(product.id));
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  currentProduct = null;
}

// ===== qty +/- (карточки и модалка) =====
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.qty__btn');
  if (!btn) return;

  const wrap = btn.closest('.qty');
  if (!wrap) return;

  const input = wrap.querySelector('input');
  if (!input) return;

  let val = parseInt(input.value, 10) || 1;
  if (btn.dataset.action === 'plus') val++;
  if (btn.dataset.action === 'minus') val = Math.max(1, val - 1);
  input.value = val;
});

// ===== add to cart из карточки =====
document.addEventListener('click', (e) => {
  const cartBtn = e.target.closest('.product-card .cart-btn');
  if (!cartBtn) return;

  const card = cartBtn.closest('.product-card');
  if (!card) return;

  const p = getProductFromCard(card);
  if (!p.id) return;

  const qty = parseInt(card.querySelector('.qty__input')?.value, 10) || 1;

  addToCart(p, qty);
  updateCartBadge();
  animateAdded(cartBtn, { duration: 700 });
});

// ===== favorites на карточке =====
function refreshFavButtons() {
  updateFavBadge();

  document.querySelectorAll('[data-code]').forEach(card => {
    const id = card.dataset.code;
    const btn = card.querySelector('.fav-btn');
    if (!btn || !id) return;
    setFavBtnState(btn, isFav(id));
  });
}


document.addEventListener('click', (e) => {
  const favBtn = e.target.closest('.product-card .fav-btn');
  if (!favBtn) return;

  const card = favBtn.closest('.product-card');
  if (!card) return;

  const p = getProductFromCard(card);
  if (!p.id) return;

  toggleFav(p);
  refreshFavButtons();

  // если модалка открыта этого товара — обновим сердечко
  if (currentProduct && String(currentProduct.id) === String(p.id) && modal?.classList.contains('open')) {
    setFavBtnState(pmFav, isFav(p.id));
  }
});

// ===== open modal on card click =====
document.addEventListener('click', (e) => {
  const card = e.target.closest('.product-card');
  if (!card) return;

  // не открывать модалку по клику на кнопки/qty
  if (e.target.closest('button, .qty, input')) return;

  const p = getProductFromCard(card);
  if (!p.id) return;

  openModal(p);
});

// ===== modal close overlay/x =====
document.addEventListener('click', (e) => {
  if (!modal || !modal.classList.contains('open')) return;
  if (e.target?.dataset?.close === '1') closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal?.classList.contains('open')) closeModal();
});

// ===== modal fav =====
document.addEventListener('click', (e) => {
  if (document.getElementById('pmThumbs')) return; // new gallery modal handles this
  if (!e.target.closest('#pmFav')) return;
  if (!currentProduct) return;

  toggleFav(currentProduct);
  setFavBtnState(pmFav, isFav(currentProduct.id));
  refreshFavButtons();
});

// ===== modal add to cart =====
document.addEventListener('click', (e) => {
  if (document.getElementById('pmThumbs')) return; // new gallery modal handles this
  if (!e.target.closest('#pmAddToCart')) return;
  if (!currentProduct) return;

  const qty = parseInt(pmQty?.value, 10) || 1;
  addToCart(currentProduct, qty);
  updateCartBadge();

  animateAdded(pmAddToCart, { duration: 700, text: 'Додано' });
});

document.addEventListener('DOMContentLoaded', () => {
  refreshFavButtons();
  updateCartBadge();
});

window.addEventListener('storage', (e) => {
  if (e.key === 'favorites') refreshFavButtons();
  if (e.key === 'cart') updateCartBadge();
});
