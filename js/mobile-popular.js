// js/mobile-popular.js
(function () {
  const isMobile = window.matchMedia("(max-width: 700px)").matches;
  if (!isMobile) return;

  const track = document.getElementById("popularTrack");
  if (!track) return;

  const btnPrev = document.querySelector(".popular__nav--prev");
  const btnNext = document.querySelector(".popular__nav--next");
  const viewport = document.querySelector(".popular__viewport");

  // если вдруг home-popular.js уже навесил обработчики — на мобиле забираем управление
  if (btnPrev) btnPrev.onclick = null;
  if (btnNext) btnNext.onclick = null;

  const VISIBLE = 1;
  let start = 0;
  let items = [];

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function load() {
    try {
      // fetchProducts() должен быть в js/db.js
      items = await fetchProducts({ popular: true, limit: 12 });
    } catch (e) {
      console.error("mobile-popular load error:", e);
      items = [];
    }
    start = 0;
    render();
  }

  function updateNav() {
    const maxStart = Math.max(0, items.length - VISIBLE);
    if (btnPrev) btnPrev.disabled = start <= 0;
    if (btnNext) btnNext.disabled = start >= maxStart;
  }

  function render() {
    const slice = items.slice(start, start + VISIBLE);

    track.innerHTML = slice.map(p => {
      const priceNum = parseFloat(String(p.price ?? 0).replace(",", ".")) || 0;

      // оставляем классы/атрибуты, чтобы твой store.js мог обработать добавление в корзину
      return 
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
      ;
    }).join("");

    // обновим бейджи, если функции есть
    if (typeof updateCartBadge === "function") updateCartBadge();
    if (typeof updateFavBadge === "function") updateFavBadge();

    updateNav();
  }

  function next() {
    const maxStart = Math.max(0, items.length - VISIBLE);
    start = Math.min(maxStart, start + 1);
    render();
  }

  function prev() {
    start = Math.max(0, start - 1);
    render();
  }

  btnNext?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    next();
  }, { passive: false });

  btnPrev?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    prev();
  }, { passive: false });

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

  load();
})();