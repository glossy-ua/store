// js/mobile-popular.js
(function () {
  // ✅ нельзя делать return на верхнем уровне файла, поэтому оборачиваем в IIFE
  if (!window.matchMedia("(max-width: 700px)").matches) return;

  const track = document.getElementById("popularTrack");
  if (!track) return;

  const btnPrev = document.querySelector(".popular__nav--prev");
  const btnNext = document.querySelector(".popular__nav--next");

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  let products = [];
  let index = 0;

  async function init() {
    try {
      // fetchProducts() приходит из js/db.js
      products = await fetchProducts({ popular: true, limit: 10 });
    } catch (e) {
      console.error("mobile-popular fetch error:", e);
      products = [];
    }

    if (!products.length) {
      track.innerHTML = "";
      return;
    }

    // ✅ на мобиле только 1 карточка
    render();
    updateNav();
  }

  function updateNav() {
    // можно делать циклично или с disabled — ты хотел стрелки как на рефе.
    // оставлю циклично (всегда активны), как “карусель”.
    if (btnPrev) btnPrev.disabled = products.length <= 1;
    if (btnNext) btnNext.disabled = products.length <= 1;
  }

  function render() {
    const p = products[index];
    if (!p) return;

    const priceNum = parseFloat(String(p.price ?? 0).replace(",", ".")) || 0;

    track.innerHTML = 
      <article class="product-card mobile-card"
        data-code="${esc(p.id)}"
        data-title="${esc(p.title)}"
        data-price="${esc(priceNum.toFixed(2))}"
        data-img="${esc(p.img || "")}"
        data-desc="${esc(p.desc || "")}"
      >
        <div class="product-card__img">
          <img src="${esc(p.img || "")}" alt="${esc(p.title)}">
        </div>

        <div class="product-card__body">
          <div class="product-card__title">${esc(p.title)}</div>
          <div class="product-card__code">Код: ${esc(p.id)}</div>

          <div class="product-card__bottom">
            <div class="product-card__price">${esc(priceNum.toFixed(2))} грн.</div>

            <div class="product-card__actions">
              <button class="cart-btn" type="button" title="В кошик">🛒</button>
            </div>
          </div>
        </div>
      </article>
    ;

    // ✅ чтобы бейджи/кнопка корзины работали как везде
    if (typeof bindProductCard === "function") {
      // если у тебя есть такая функция — ок
      bindProductCard(track.querySelector(".product-card"));
    }

    if (typeof updateCartBadge === "function") updateCartBadge();
    if (typeof updateFavBadge === "function") updateFavBadge();
  }

  function next() {
    if (!products.length) return;
    index = (index + 1) % products.length;
    render();
  }

  function prev() {
    if (!products.length) return;
    index = (index - 1 + products.length) % products.length;
    render();
  }

  btnNext?.addEventListener("click", next);
  btnPrev?.addEventListener("click", prev);

  init();
})();
