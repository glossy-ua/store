/* =========================
   cart.js (cart page + modal + fav)
   ========================= */

function $(sel) { return document.querySelector(sel); }

function escAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;");
}

function setFavBtnState(btn, active) {
  if (!btn) return;
  btn.classList.toggle("active", active);
  btn.textContent = active ? "♥️" : "♡";
}

// ===== MODAL refs =====
const modal = $("#productModal");
const pmImg = $("#pmImg");
const pmTitle = $("#pmTitle");
const pmCode = $("#pmCode");
const pmPrice = $("#pmPrice");
const pmDesc = $("#pmDesc");
const pmFav = $("#pmFav");
const pmQty = $("#pmQty");
const pmAddToCart = $("#pmAddToCart");

let currentProduct = null;

function openModal(product) {
  if (!modal) return;
  currentProduct = product;

  if (pmImg) { pmImg.src = product.img || ""; pmImg.alt = product.title || ""; }
  if (pmTitle) pmTitle.textContent = product.title || "";
  if (pmCode) pmCode.textContent = product.id ? `Код: ${product.id}` : "";

  if (pmPrice) {
    const n = (typeof formatPriceUAH === "function")
      ? formatPriceUAH(product.price)
      : (parseFloat(String(product.price || "").replace(",", ".").replace(/[^\d.]/g, "")) || 0);
    pmPrice.textContent = n ? `${n.toFixed(2)} грн.` : "";
  }

  if (pmDesc) {
    const hasTags = /<\/?[a-z][\s\S]*>/i.test(product.desc || "");
    pmDesc[hasTags ? "innerHTML" : "textContent"] = product.desc || "Опис буде додано пізніше 🙂";
  }

  if (pmQty) pmQty.value = 1;

  if (pmFav) {
    pmFav.style.display = "";
    setFavBtnState(pmFav, typeof isFav === "function" ? isFav(product.id) : false);
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");

  // ✅ ФИКС: блокируем фон
  if (typeof window.lockBodyScroll === "function") window.lockBodyScroll();
  else document.body.style.overflow = "hidden";
}

function closeModal() {
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");

  // ✅ ФИКС: возвращаем фон
  if (typeof window.unlockBodyScroll === "function") window.unlockBodyScroll();
  else document.body.style.overflow = "";

  currentProduct = null;
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

  const cartItem = e.target.closest(".cart-item");
  if (cartItem) {
    if (e.target.closest(".cart-qty-btn, .cart-item__remove, input, button")) return;

    const product = {
      id: String(cartItem.dataset.id || ""),
      title: cartItem.dataset.title || "",
      price: cartItem.dataset.price || "",
      img: cartItem.dataset.img || "",
      desc: cartItem.dataset.desc || ""
    };

    openModal(product);
    return;
  }

  if (modal?.classList.contains("open") && (e.target?.dataset?.close === "1" || e.target?.closest?.("[data-close='1']"))) {
    closeModal();
  }

  const checkoutLink = e.target.closest('.cart-actions a[href="checkout.html"]');
  if (checkoutLink) {
    const cart = (typeof getCart === "function") ? getCart() : [];
    const count = cart.reduce((sum, p) => sum + (parseInt(p.qty, 10) || 0), 0);
    if (count <= 0) {
      e.preventDefault();
      alert("Ваша корзина пуста.");
      return;
    }

    // ✅ если не залогинен — запомним куда вернуться (а дальше checkout сам кинет на auth)
    if (!localStorage.getItem("sb_uid")) {
      try { window.setPostAuthRedirect?.(new URL("checkout.html", location.href).toString()); } catch {
        try { localStorage.setItem("post_auth_redirect", location.origin + location.pathname.replace(/[^/]*$/, "") + "checkout.html"); } catch {}
      }
    }
  }
});

// ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal?.classList.contains("open")) closeModal();
});

// qty +/- in modal
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".qty__btn");
  if (!btn) return;
  if (!modal || !modal.classList.contains("open")) return;

  const wrap = btn.closest(".qty");
  if (!wrap) return;

  const input = wrap.querySelector("input");
  if (!input) return;

  let val = parseInt(input.value, 10) || 1;
  if (btn.dataset.action === "plus") val++;
  if (btn.dataset.action === "minus") val = Math.max(1, val - 1);
  input.value = val;
});

// modal fav
document.addEventListener("click", (e) => {
  if (!e.target.closest("#pmFav")) return;
  if (!currentProduct) return;

  if (typeof toggleFav === "function") toggleFav(currentProduct);
  setFavBtnState(pmFav, typeof isFav === "function" ? isFav(currentProduct.id) : false);
  try { updateFavBadge?.(); } catch {}
});

// modal add more
document.addEventListener("click", (e) => {
  if (!e.target.closest("#pmAddToCart")) return;
  if (!currentProduct) return;

  const qty = parseInt(pmQty?.value, 10) || 1;

  if (typeof addToCart === "function") addToCart(currentProduct, qty);

  renderCart();
  try { updateCartBadge?.(); } catch {}

  try { animateAdded?.(pmAddToCart, { duration: 700, text: "Додано" }); } catch {}
});

// init
document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  try { updateCartBadge?.(); } catch {}
  try { updateFavBadge?.(); } catch {}
});
