/* =========================
   favorites.js  (favorites page)
   ========================= */

function $(sel) { return document.querySelector(sel); }

function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeImg(src) {
  if (!src) return '';
  return src.startsWith('../') ? src.replace('../', '') : src;
}

function setFavBtnState(btn, active) {
  if (!btn) return;
  btn.classList.toggle('active', active);
  btn.textContent = active ? '♥️' : '♡';
}

function getProductFromFavCard(card) {
  return {
    id: String(card.dataset.id || ''),
    title: card.dataset.title || '',
    price: card.dataset.price || '',
    img: card.dataset.img || '',
    desc: card.dataset.desc || ''
  };
}

function renderFavorites() {
  updateFavBadge();

  const list = $('#favoritesList');
  const empty = $('#favoritesEmpty');
  if (!list || !empty) return;

  const favs = getFavorites();

  if (!favs.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  list.innerHTML = favs.map(p => `
    <article class="product-card"
      data-id="${escapeAttr(p.id)}"
      data-title="${escapeAttr(p.title)}"
      data-price="${escapeAttr(p.price)}"
      data-img="${escapeAttr(normalizeImg(p.img))}"
      data-desc="${escapeAttr(p.desc)}">

      <button class="fav-btn active" type="button" title="Убрать из избранного">♥️</button>

      <div class="product-card__img">
        <img src="${escapeAttr(normalizeImg(p.img))}" alt="${escapeAttr(p.title)}">
      </div>

      <div class="product-card__body">
        <h3 class="product-card__title">${p.title || ''}</h3>
        <p class="product-card__code">Код товара: <span>${p.id || ''}</span></p>

        <div class="product-card__bottom">
          <div class="product-card__price">${Number(p.price).toFixed(2)} грн
</div>

          <div class="product-card__actions">
            <button class="cart-btn add-to-cart" type="button" title="Додати в кошик">🛒</button>
          </div>
        </div>
      </div>
    </article>
  `).join('');
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
  if (!modal) return;
  currentProduct = product;

  if (pmImg) { pmImg.src = product.img || ''; pmImg.alt = product.title || ''; }
  if (pmTitle) pmTitle.textContent = product.title || '';
  if (pmCode) pmCode.textContent = product.id ? `Код: ${product.id}` : '';
  if (pmPrice) pmPrice.textContent = product.price ? `${product.price} грн.` : '';

  // В избранном desc может быть HTML (если ты так хранишь) — покажем как HTML.
  // Если у тебя desc простой текст — тоже ок.
  if (pmDesc) {
    const hasTags = /<\/?[a-z][\s\S]*>/i.test(product.desc || '');
    pmDesc[hasTags ? 'innerHTML' : 'textContent'] = product.desc || 'Опис буде додано пізніше 🙂';
  }

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

// ===== events (one delegated click) =====
document.addEventListener('click', (e) => {
  // remove from favorites (card heart)
  const heart = e.target.closest('#favoritesList .fav-btn');
  if (heart) {
    const card = heart.closest('.product-card');
    if (!card) return;

    const id = card.dataset.id;
    setFavorites(getFavorites().filter(p => String(p.id) !== String(id)));
    renderFavorites();
    updateFavBadge();

    // если открыта модалка этого товара — закрыть
    if (currentProduct && String(currentProduct.id) === String(id) && modal?.classList.contains('open')) {
      closeModal();
    }
    return;
  }

  // add to cart (card)
  const addBtn = e.target.closest('#favoritesList .add-to-cart');
  if (addBtn) {
    const card = addBtn.closest('.product-card');
    if (!card) return;

    const p = getProductFromFavCard(card);
    addToCart(p, 1);
    updateCartBadge();
    animateAdded(addBtn, { duration: 700 });
    return;
  }

  // open modal on card click
  const card = e.target.closest('#favoritesList .product-card');
  if (card) {
    if (e.target.closest('button, .qty, input')) return;
    openModal(getProductFromFavCard(card));
    return;
  }

  // close modal overlay/x
  if (modal?.classList.contains('open') && e.target?.dataset?.close === '1') {
    closeModal();
  }
});

// ESC close
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal?.classList.contains('open')) closeModal();
});

// qty +/- in modal
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.qty__btn');
  if (!btn) return;
  if (!modal || !modal.classList.contains('open')) return;

  const wrap = btn.closest('.qty');
  if (!wrap) return;

  const input = wrap.querySelector('input');
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

  toggleFav(currentProduct);
  setFavBtnState(pmFav, isFav(currentProduct.id));
  renderFavorites();
  updateFavBadge();
});

// modal add to cart
document.addEventListener('click', (e) => {
  if (!e.target.closest('#pmAddToCart')) return;
  if (!currentProduct) return;

  const qty = parseInt(pmQty?.value, 10) || 1;
  addToCart(currentProduct, qty);
  updateCartBadge();

  animateAdded(pmAddToCart, { duration: 700, text: 'Додано' });
});

document.addEventListener('DOMContentLoaded', () => {
  renderFavorites();
  updateCartBadge();
});

window.addEventListener('storage', (e) => {
  if (e.key === 'favorites') renderFavorites();
  if (e.key === 'cart') updateCartBadge();
});
