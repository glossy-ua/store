// js/mobile-popular.js
(async function () {
  // запускаемся ТОЛЬКО на телефоне
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

  // грузим популярные
  let popularProducts = [];
  try {
    // fetchProducts() приходит из js/db.js
    popularProducts = await fetchProducts({ popular: true, limit: 12 });
  } catch (e) {
    console.error(e);
    popularProducts = [];
  }

  let idx = 0;

  function updateNavState() {
    if (btnPrev) btnPrev.disabled = (idx <= 0);
    if (btnNext) btnNext.disabled = (idx >= popularProducts.length - 1);
  }

  function renderOne() {
    if (!popularProducts.length) {
      track.innerHTML = "";
      if (btnPrev) btnPrev.disabled = true;
      if (btnNext) btnNext.disabled = true;
      return;
    }

    const p = popularProducts[idx];
    const priceNum = parseFloat(String(p.price ?? 0).replace(",", ".")) || 0;

    track.innerHTML = 
      <article class="product-card"
        data-code="${esc(p.id)}"
        data-title="${esc(p.title)}"
        data-price="${esc(priceNum.toFixed(2))}"
        data-img="${esc(p.img || "")}"
        data-desc="${esc(p.desc || "")}"
      >
        <button class="fav-btn" type="button" title="В обране">♡</button>

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

    // обновим бейджи
    if (typeof updateFavBadge === "function") updateFavBadge();
    if (typeof updateCartBadge === "function") updateCartBadge();

    // состояние сердечка
    if (typeof isFav === "function") {
      const card = track.querySelector(".product-card");
      const id = card?.dataset.code;
      const btn = card?.querySelector(".fav-btn");
      if (id && btn) {
        const active = isFav(id);
        btn.classList.toggle("active", active);
        btn.textContent = active ? "♥️" : "♡";
      }
    }

    updateNavState();
  }

  function next() {
    if (idx < popularProducts.length - 1) idx++;
    renderOne();
  }

  function prev() {
    if (idx > 0) idx--;
    renderOne();
  }

  btnNext?.addEventListener("click", next);
  btnPrev?.addEventListener("click", prev);

  // свайп по карточке (влево/вправо)
  const viewport = document.querySelector(".popular__viewport");
  let x0 = null;

  viewport?.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
  viewport?.addEventListener("pointerup", (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) < 30) return;
    if (dx < 0) next(); else prev();
  });

  renderOne();
})();
