// js/products.js
// Cards interactions (qty/fav/cart + open modal)
// Requires store.js (addToCart/toggleFav/isFav/update badges/animateAdded)
// Modal logic lives in product-modal.js (window.openProductModal)

(function () {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  function moneyToNumber(v) {
    const n = parseFloat(String(v ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function getProductFromCard(card) {
    const priceNum = moneyToNumber(card.dataset.price);

    // IMPORTANT: pass imgs if present (from catalog-supa/search-supa/home-popular)
    let imgs = card.dataset.imgs;
    try {
      if (imgs && typeof imgs === "string" && imgs.trim().startsWith("[")) imgs = JSON.parse(imgs);
    } catch {}

    return {
      id: String(card.dataset.code || "").trim(),
      title: String(card.dataset.title || "").trim(),
      price: priceNum ? priceNum.toFixed(2) : String(card.dataset.price || "").trim(),
      img: String(card.dataset.img || "").trim(),
      desc: String(card.dataset.desc || "").trim(),
      imgs: imgs || undefined,
    };
  }

  function setFavBtnState(btn, active) {
    if (!btn) return;
    btn.classList.toggle("active", !!active);
    btn.textContent = active ? "♥️" : "♡";
  }

  function syncFavButtons(root = document) {
    if (typeof window.isFav !== "function") return;
    root.querySelectorAll(".product-card").forEach((card) => {
      const id = card.dataset.code;
      const btn = card.querySelector(".fav-btn");
      if (!btn || !id) return;
      setFavBtnState(btn, window.isFav(id));
    });
  }

  // expose for modal to refresh cards (product-modal.js calls refreshFavButtons if exists)
  window.refreshFavButtons = () => syncFavButtons(document);

  // initial
  try { window.updateFavBadge?.(); } catch {}
  try { window.updateCartBadge?.(); } catch {}
  syncFavButtons(grid);

  

  // ===== FAV CLICK (CAPTURE) =====
  // Иногда клики по сердцу могут "глотаться" другими обработчиками (или из‑за stopPropagation).
  // Поэтому ловим в capture-фазе на документе.
  document.addEventListener("click", (e) => {
    const btn = e.target?.closest?.(".fav-btn");
    if (!btn) return;

    const card = btn.closest?.(".product-card");
    if (!card) return;

    // only for product cards that have dataset code/id
    const pid = String(card.dataset.code || "").trim();
    if (!pid) return;

    e.preventDefault();
    e.stopPropagation();

    const p = getProductFromCard(card);
    if (!p.id) return;

    if (typeof window.toggleFav === "function") window.toggleFav(p);
    refreshFavButtons();
    try { window.updateFavBadge?.(); } catch {}
  }, true);

grid.addEventListener("click", (e) => {
    const t = e.target;
    const card = t.closest?.(".product-card");
    if (!card) return;

    // qty +/- inside card
    if (t.matches?.(".qty__btn")) {
      e.preventDefault();
      e.stopPropagation();
      const action = t.dataset.action;
      const input = card.querySelector(".qty__input");
      if (!input) return;
      let v = Math.max(1, parseInt(input.value || "1", 10) || 1);
      v = action === "plus" ? v + 1 : Math.max(1, v - 1);
      input.value = String(v);
      return;
    }

    // fav
    if (t.closest?.(".fav-btn")) {
      e.preventDefault();
      e.stopPropagation();
      const p = getProductFromCard(card);
      if (!p.id) return;
      window.toggleFav?.(p);
      try { window.updateFavBadge?.(); } catch {}
      syncFavButtons(card); // update this card
      return;
    }

    // cart
    if (t.closest?.(".cart-btn")) {
      e.preventDefault();
      e.stopPropagation();
      const p = getProductFromCard(card);
      if (!p.id) return;

      const q = Math.max(1, parseInt(card.querySelector(".qty__input")?.value || "1", 10) || 1);
      window.addToCart?.(p, q);
      try { window.updateCartBadge?.(); } catch {}
      window.animateAdded?.(t.closest(".cart-btn"), { duration: 700 });
      return;
    }

    // open modal (image/title/body)
    const clickForModal =
      t.closest?.(".product-card__img") ||
      t.closest?.(".product-card__title") ||
      t.closest?.(".product-card__body");

    if (clickForModal) {
      if (t.matches?.("input, button")) return;
      e.preventDefault();
      e.stopPropagation();

      const p = getProductFromCard(card);
      if (!p.id) return;

      if (typeof window.openProductModal === "function") {
        window.openProductModal(p);
      } else {
        console.warn("[products] openProductModal() not found. Add js/product-modal.js before products.js");
      }
    }
  });
})();
