// product-modal.js
function $(sel) { return document.querySelector(sel); }

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

function getCardProduct(card) {
  const id = String(card.dataset.code || '');
  const title = card.dataset.title || card.querySelector('.product-card__title')?.innerText?.trim() || '';
  const img = card.dataset.img || card.querySelector('.product-card__img img')?.getAttribute('src') || '';
  const desc = card.dataset.desc || '';

  // price: data-price у тебя "250.00" → красиво покажем "250.00 грн."
  const rawPrice = card.dataset.price || card.querySelector('.product-card__price')?.innerText?.trim() || '0';
  const num = parseFloat(String(rawPrice).replace(',', '.').replace(/[^\d.]/g, '')) || 0;
  const priceText = num.toFixed(2) + ' грн.';

  return { id, title, img, desc, priceText, priceNum: num };
}

function setFavBtnState(btn, active) {
  if (!btn) return;
  btn.classList.toggle('active', active);
  btn.textContent = active ? '♥' : '♡';
}

function openModal(product) {
  if (!modal) return;

  currentProduct = product;

  if (pmImg) { pmImg.src = product.img || ''; pmImg.alt = product.title || ''; }
  if (pmTitle) pmTitle.textContent = product.title || '';
  if (pmCode) pmCode.textContent = product.id ? `Код: ${product.id}` : '';
  if (pmPrice) pmPrice.textContent = product.priceText || '';
  if (pmDesc) pmDesc.textContent = product.desc || 'Опис буде додано пізніше 🙂';
  if (pmQty) pmQty.value = 1;

  setFavBtnState(pmFav, isFav(product.id));

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

// Открытие: клик по карточке, кроме интерактивных элементов
document.addEventListener('click', (e) => {
  const card = e.target.closest('.product-card');
  if (!card) return;

  // если клик по кнопкам/инпутам/qty — НЕ открываем
  if (e.target.closest('.fav-btn, .cart-btn, .qty, input, button')) return;

  const product = getCardProduct(card);
  if (!product.id) return;

  openModal(product);
});

// Закрытие: overlay / крестик
document.addEventListener('click', (e) => {
  if (!modal || !modal.classList.contains('open')) return;
  if (e.target?.dataset?.close === '1') closeModal();
});

// ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal?.classList.contains('open')) closeModal();
});

// Сердечко в модалке
document.addEventListener('click', (e) => {
  if (!e.target.closest('#pmFav')) return;
  if (!currentProduct) return;

  toggleFav({
    id: currentProduct.id,
    title: currentProduct.title,
    price: String(currentProduct.priceNum || ''),
    img: currentProduct.img
  });

  setFavBtnState(pmFav, isFav(currentProduct.id));
  // обновим сердца на карточках
  if (typeof refreshFavButtons === 'function') refreshFavButtons();
});

// Добавить в корзину из модалки
document.addEventListener('click', (e) => {
  if (!e.target.closest('#pmAddToCart')) return;
  if (!currentProduct) return;

  const qty = Math.max(1, parseInt(pmQty?.value) || 1);

  addToCart({
    id: currentProduct.id,
    title: currentProduct.title,
    price: String(currentProduct.priceNum || 0),
    img: currentProduct.img
  }, qty);

  updateCartBadge();

  const btn = pmAddToCart;
  const old = btn.textContent;
  btn.textContent = '✅ Додано';
  setTimeout(() => (btn.textContent = old), 700);
});
