/* =========================
   cart.js (cart page)
   ========================= */

function $(sel) { return document.querySelector(sel); }

function escAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;");
}

// ===== Render cart =====
function renderCart() {
  const list = $("#cartList");
  const empty = $("#cartEmpty");
  const totalEl = $("#cartTotal");

  if (!list || !empty || !totalEl) return;

  const cart = (typeof getCart === "function") ? getCart() : [];

  if (!cart.length) {
    list.innerHTML = "";
    empty.style.display = "block";
    totalEl.textContent = "0 грн.";
    return;
  }

  empty.style.display = "none";

  let total = 0;

  list.innerHTML = cart.map(item => {
    const price = (typeof formatPriceUAH === "function") ? formatPriceUAH(item.price) : 0;
    const qty = Number(item.qty) || 1;
    const sum = price * qty;
    total += sum;

    return `
      <article class="cart-item"
        data-id="${escAttr(item.id || "")}"
        data-title="${escAttr(item.title || "")}"
        data-price="${escAttr(item.price || "")}"
        data-img="${escAttr(item.img || "")}"
        data-desc="${escAttr(item.desc || "")}">

        <div class="cart-item__img">
          <img src="${item.img || ""}" alt="${escAttr(item.title || "")}">
        </div>

        <div class="cart-item__info">
          <h3 class="cart-item__title">${item.title || ""}</h3>
          <p class="cart-item__code">Код: ${item.id || ""}</p>

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
  }).join("");

  totalEl.textContent = total.toFixed(2) + " грн.";
}

// ===== wrap addToCart so cart page updates instantly after modal click =====
(function wrapAddToCartForCartPage() {
  if (window.__cartAddToCartWrapped) return;
  if (typeof window.addToCart !== "function") return;

  const orig = window.addToCart.bind(window);
  window.addToCart = function (prod, qty) {
    const res = orig(prod, qty);
    // ✅ обновляем страницу корзины сразу
    try { renderCart(); } catch {}
    return res;
  };

  window.__cartAddToCartWrapped = true;
})();

// ===== Click handlers =====
document.addEventListener("click", (e) => {
  const plusBtn = e.target.closest(".plus");
  const minusBtn = e.target.closest(".minus");
  const removeBtn = e.target.closest(".cart-item__remove");

  if (plusBtn || minusBtn || removeBtn) {
    const card = e.target.closest(".cart-item");
    if (!card) return;

    const id = String(card.dataset.id || "");
    let cart = (typeof getCart === "function") ? getCart() : [];

    const same = (a, b) => (typeof normId === "function")
      ? normId(a) === normId(b)
      : String(a) === String(b);

    const item = cart.find(p => same(p.id, id));

    if (plusBtn && item) item.qty = (Number(item.qty) || 1) + 1;
    if (minusBtn && item) item.qty = Math.max(1, (Number(item.qty) || 1) - 1);
    if (removeBtn) cart = cart.filter(p => !same(p.id, id));

    if (typeof setCart === "function") setCart(cart);
    renderCart();
    try { updateCartBadge?.(); } catch {}
    return;
  }

  // open modal on cart item click (but not on buttons)
  const cartItem = e.target.closest(".cart-item");
  if (cartItem) {
    if (e.target.closest(".cart-qty-btn, .cart-item__remove, input, button")) return;

    const product = {
      id: String(cartItem.dataset.id || ""),
      title: cartItem.dataset.title || "",
      price: cartItem.dataset.price || "",
      img: cartItem.dataset.img || "",
      desc: cartItem.dataset.desc || ""
      // imgs НЕ нужны: product-modal.js сам подтянет из Supabase по id, если есть imgs в БД
    };

    if (typeof window.openProductModal === "function") {
      window.openProductModal(product);
    }
    return;
  }

  // checkout guard
  const checkoutLink = e.target.closest('.cart-actions a[href="checkout.html"]');
  if (checkoutLink) {
    const cart = (typeof getCart === "function") ? getCart() : [];
    const count = cart.reduce((sum, p) => sum + (parseInt(p.qty, 10) || 0), 0);
    if (count <= 0) {
      e.preventDefault();
      alert("Ваша корзина пуста.");
      return;
    }

    if (!localStorage.getItem("sb_uid")) {
      try { window.setPostAuthRedirect?.(new URL("checkout.html", location.href).toString()); } catch {
        try { localStorage.setItem("post_auth_redirect", location.origin + location.pathname.replace(/[^/]*$/, "") + "checkout.html"); } catch {}
      }
    }
  }
});

// init
document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  try { updateCartBadge?.(); } catch {}
  try { updateFavBadge?.(); } catch {}
});
