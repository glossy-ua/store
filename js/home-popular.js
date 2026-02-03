// js/home-popular.js
(async function () {
  const track = document.getElementById("popularTrack");
  if (!track) return;

  const viewport = document.querySelector(".popular__viewport");
  const btnPrev = document.querySelector(".popular__nav--prev");
  const btnNext = document.querySelector(".popular__nav--next");

  const mq = window.matchMedia("(max-width: 768px)");
  let VISIBLE = mq.matches ? 1 : 4;   // 👈 мобилка 1, десктоп 4
  let start = 0;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // 1) Берём популярные товары из БД
  let popularProducts = [];
  try {
    popularProducts = await fetchProducts({ popular: true, limit: 8 });
    console.log("POPULAR:", popularProducts);
  } catch (e) {
    console.error(e);
    popularProducts = [];
  }

  function getMaxStart() {
    return Math.max(0, popularProducts.length - VISIBLE);
  }

  function updateNavState() {
    const maxStart = getMaxStart();
    if (btnPrev) btnPrev.disabled = start <= 0;
    if (btnNext) btnNext.disabled = start >= maxStart;
  }

  function render() {
    // на всякий случай поджимаем start при смене VISIBLE
    const maxStart = getMaxStart();
    start = Math.max(0, Math.min(start, maxStart));

    const slice = popularProducts.slice(start, start + VISIBLE);

    track.innerHTML = slice.map(p => {
      const priceNum = parseFloat(String(p.price ?? 0).replace(",", ".")) || 0;

      return `
        <article class="product-card"
          data-code="${esc(p.id)}"
          data-title="${esc(p.title)}"
          data-price="${esc(priceNum.toFixed(2))}"
          data-img="${esc(p.img || '')}"
          data-desc="${esc(p.desc || '')}"
        >
          <button class="fav-btn" type="button" title="В обране">♡</button>

          <div class="product-card__img">
            <img src="${esc(p.img || '')}" alt="${esc(p.title)}">
          </div>

          <div class="product-card__body">
            <div class="product-card__title">${esc(p.title)}</div>
            <div class="product-card__code">Код: ${esc(p.id)}</div>

            <div class="product-card__bottom">
              <div class="product-card__price">${esc(priceNum.toFixed(2))} грн.</div>

              <div class="product-card__actions">
                <div class="qty">
                  <button class="qty__btn" data-action="minus" type="button">—</button>
                  <input class="qty__input" type="number" min="1" value="1">
                  <button class="qty__btn" data-action="plus" type="button">+</button>
                </div>

                <button class="cart-btn" type="button" title="В кошик">🛒</button>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join("");

    if (typeof updateFavBadge === "function") updateFavBadge();
    if (typeof updateCartBadge === "function") updateCartBadge();

    if (typeof isFav === "function") {
      document.querySelectorAll("#popularTrack .product-card").forEach(card => {
        const id = card.dataset.code;
        const btn = card.querySelector(".fav-btn");
        if (!btn || !id) return;
        const active = isFav(id);
        btn.classList.toggle("active", active);
        btn.textContent = active ? "♥️" : "♡";
      });
    }

    updateNavState();
  }

  function next() {
    start = Math.min(getMaxStart(), start + 1);
    render();
  }

  function prev() {
    start = Math.max(0, start - 1);
    render();
  }

  btnNext?.addEventListener("click", next);
  btnPrev?.addEventListener("click", prev);

  // свайп
  let x0 = null;
  viewport?.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
  viewport?.addEventListener("pointerup", (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) < 30) return;
    if (dx < 0) next(); else prev();
  });

  // 👇 реагируем на смену брейкпоинта (поворот/ресайз)
  function applyVisibleFromMedia() {
    const newVisible = mq.matches ? 1 : 4;
    if (newVisible === VISIBLE) return;
    VISIBLE = newVisible;
    render();
  }

  // Safari старый: addListener, новый: addEventListener
  if (mq.addEventListener) mq.addEventListener("change", applyVisibleFromMedia);
  else mq.addListener(applyVisibleFromMedia);

  render();
})();
