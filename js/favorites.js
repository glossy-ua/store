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

function money(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.]/g, '')) || 0;
  return n.toFixed(2);
}

function getProductFromFavCard(card) {
  return {
    id: String(card.dataset.id || ''),
    title: card.dataset.title || '',
    price: card.dataset.price || '',
    img: card.dataset.img || '',
    desc: card.dataset.desc || ''
    // imgs НЕ нужны: product-modal.js сам подтянет imgs из Supabase по id
  };
}

function renderFavorites() {
  if (typeof updateFavBadge === "function") updateFavBadge();

  const list = $('#favoritesList');
  const empty = $('#favoritesEmpty');
  if (!list || !empty) return;

  const favs = typeof getFavorites === "function" ? getFavorites() : [];

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
          <div class="product-card__price">${money(p.price)} грн.</div>

          <div class="product-card__actions">
            <div class="qty" aria-label="Кількість">
              <button class="qty__btn" data-action="minus" type="button">—</button>
              <input class="qty__input" type="number" min="1" value="1" inputmode="numeric">
              <button class="qty__btn" data-action="plus" type="button">+</button>
            </div>

            <button class="cart-btn add-to-cart" type="button" title="Додати в кошик">🛒</button>
          </div>
        </div>
      </div>
    </article>
  `).join('');
}

// ✅ чтобы product-modal.js мог синхронизировать кнопки/список после toggleFav
window.refreshFavButtons = function () {
  try { renderFavorites(); } catch {}
};

// ===== EVENTS =====
document.addEventListener('click', (e) => {
  // remove from favorites (card heart)
  const heart = e.target.closest('#favoritesList .fav-btn');
  if (heart) {
    const card = heart.closest('.product-card');
    if (!card) return;

    const id = card.dataset.id;

    if (typeof setFavorites === "function" && typeof getFavorites === "function") {
      setFavorites(getFavorites().filter(p => String(p.id) !== String(id)));
    }

    renderFavorites();
    if (typeof updateFavBadge === "function") updateFavBadge();
    return;
  }

  // qty +/- in cards
  const qtyBtn = e.target.closest('#favoritesList .qty__btn');
  if (qtyBtn) {
    const wrap = qtyBtn.closest('.qty');
    const input = wrap?.querySelector('input');
    if (!input) return;

    let val = parseInt(input.value, 10) || 1;
    if (qtyBtn.dataset.action === 'plus') val++;
    if (qtyBtn.dataset.action === 'minus') val = Math.max(1, val - 1);
    input.value = val;
    return;
  }

  // add to cart (card)
  const addBtn = e.target.closest('#favoritesList .add-to-cart');
  if (addBtn) {
    const card = addBtn.closest('.product-card');
    if (!card) return;

    const p = getProductFromFavCard(card);
    const qty = parseInt(card.querySelector('.qty__input')?.value, 10) || 1;

    if (typeof addToCart === "function") addToCart(p, qty);
    if (typeof updateCartBadge === "function") updateCartBadge();
    if (typeof animateAdded === "function") animateAdded(addBtn, { duration: 700 });
    return;
  }

  // open modal on card click
  const card = e.target.closest('#favoritesList .product-card');
  if (card) {
    if (e.target.closest('button, .qty, input')) return;

    if (typeof window.openProductModal === "function") {
      window.openProductModal(getProductFromFavCard(card));
    }
    return;
  }
});

document.addEventListener('DOMContentLoaded', () => {
  renderFavorites();
  if (typeof updateCartBadge === "function") updateCartBadge();
});

window.addEventListener('storage', (e) => {
  if (e.key === 'favorites') renderFavorites();
  if (e.key === 'cart' && typeof updateCartBadge === "function") updateCartBadge();
});
