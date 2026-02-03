/* =========================
   cart.js (cart page + modal + fav)
   ========================= */

function $(sel) { return document.querySelector(sel); }

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
  if (!modal) return;
  currentProduct = product;

  if (pmImg) { pmImg.src = product.img || ''; pmImg.alt = product.title || ''; }
  if (pmTitle) pmTitle.textContent = product.title || '';
  if (pmCode) pmCode.textContent = product.id ? `Код: ${product.id}` : '';
  if (pmPrice) pmPrice.textContent = product.price ? `${product.price} грн.` : '';

  // desc может быть HTML — покажем корректно
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

// ===== Render cart =====
function renderCart() {
  const list = $('#cartList');
  const empty = $('#cartEmpty');
  const totalEl = $('#cartTotal');

  if (!list || !empty || !totalEl) return;

  const cart = getCart();

  if (!cart.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    totalEl.textContent = '0 грн.';
    return;
  }

  empty.style.display = 'none';

  let total = 0;

  list.innerHTML = cart.map(item => {
    const price = formatPriceUAH(item.price);
    const qty = Number(item.qty) || 1;
    const sum = price * qty;
    total += sum;

    return `
      <article class="cart-item"
        data-id="${String(item.id || '')}"
        data-title="${String(item.title || '').replace(/"/g,'&quot;')}"
        data-price="${String(item.price || '')}"
        data-img="${String(item.img || '')}"
        data-desc="${String(item.desc || '').replace(/"/g,'&quot;')}">

        <div class="cart-item__img">
          <img src="${item.img || ''}" alt="${item.title || ''}">
        </div>

        <div class="cart-item__info">
          <h3 class="cart-item__title">${item.title || ''}</h3>
          <p class="cart-item__code">Код: ${item.id || ''}</p>

          <div class="cart-item__controls">
            <button class="cart-qty-btn minus" type="button" aria-label="Зменшити">−</button>
            <input class="cart-qty-input" type="number" min="1" value="${qty}" readonly>
            <button class="cart-qty-btn plus" type="button" aria-label="Збільшити">+</button>
          </div>
        </div>

        <div class="cart-item__price">
          <small>${price.toFixed(2)} грн.</small>
          <strong>${sum.toFixed(2)} грн.</strong>
        </div>

        <button class="cart-item__remove" type="button" aria-label="Видалити">✕</button>
      </article>
    `;
  }).join('');

  totalEl.textContent = total.toFixed(2) + ' грн.';
}

// ===== Global click handler =====
document.addEventListener('click', (e) => {
  // qty +/- and remove
  const plusBtn = e.target.closest('.plus');
  const minusBtn = e.target.closest('.minus');
  const removeBtn = e.target.closest('.cart-item__remove');

  if (plusBtn || minusBtn || removeBtn) {
    const card = e.target.closest('.cart-item');
    if (!card) return;

    const id = String(card.dataset.id);
    let cart = getCart();
    const item = cart.find(p => String(p.id) === id);

    if (plusBtn && item) item.qty = (Number(item.qty) || 1) + 1;
    if (minusBtn && item) item.qty = Math.max(1, (Number(item.qty) || 1) - 1);
    if (removeBtn) cart = cart.filter(p => String(p.id) !== id);

    setCart(cart);
    renderCart();
    updateCartBadge();
    return;
  }

  // open modal on cart-item click
  const cartItem = e.target.closest('.cart-item');
  if (cartItem) {
    if (e.target.closest('.cart-qty-btn, .cart-item__remove, input, button')) return;

    const product = {
      id: String(cartItem.dataset.id || ''),
      title: cartItem.dataset.title || '',
      price: cartItem.dataset.price || '',
      img: cartItem.dataset.img || '',
      desc: cartItem.dataset.desc || ''
    };

    openModal(product);
    return;
  }

  // close modal overlay/x
  if (modal?.classList.contains('open') && e.target?.dataset?.close === '1') {
    closeModal();
  }
});

// ESC
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
  updateFavBadge();
});

// modal add more (добавить ещё)
document.addEventListener('click', (e) => {
  if (!e.target.closest('#pmAddToCart')) return;
  if (!currentProduct) return;

  const qty = parseInt(pmQty?.value, 10) || 1;

  // добавляем именно currentProduct (без undefined переменных)
  addToCart(currentProduct, qty);

  renderCart();
  updateCartBadge();

  animateAdded(pmAddToCart, { duration: 700, text: 'Додано' });
});

// init
document.addEventListener('DOMContentLoaded', () => {
  renderCart();
  updateCartBadge();
  updateFavBadge();
});

document.addEventListener('click', (e) => {
  const link = e.target.closest('.cart-actions a[href="checkout.html"]');
  if (!link) return;

  const cart = (typeof getCart === "function")
    ? getCart()
    : (JSON.parse(localStorage.getItem("cart") || "[]"));

  const count = cart.reduce((sum, p) => sum + (parseInt(p.qty, 10) || 0), 0);

  if (count <= 0) {
    e.preventDefault();
    alert("Ваша корзина пуста.");
  }
});

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const { items, total } = renderCheckoutSummary();

  

  // ✅ ЖЕЛЕЗНАЯ ЗАЩИТА
  if (!items || !items.length || total <= 0) {
    alert("Ваша корзина пуста.");
    return;
  }

  // дальше твой код оформления...
});
