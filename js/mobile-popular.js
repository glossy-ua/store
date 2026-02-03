// js/mobile-popular.js
(async function () {
  if (window.innerWidth > 768) return; // ТОЛЬКО ДЛЯ MOBILE

  const track = document.getElementById("popularTrack");
  if (!track) return;

  const viewport = document.querySelector(".popular__viewport");
  const btnPrev = document.querySelector(".popular__nav--prev");
  const btnNext = document.querySelector(".popular__nav--next");

  const VISIBLE = 1; // 👈 только 1 карточка
  let start = 0;

  let popularProducts = [];
  try {
    popularProducts = await fetchProducts({ popular: true, limit: 10 });
  } catch (e) {
    popularProducts = [];
  }

  function render() {
    const slice = popularProducts.slice(start, start + VISIBLE);

    track.innerHTML = slice.map(p => {
      const price = parseFloat(p.price || 0).toFixed(2);

      return 
        <article class="product-card mobile-pop-card"
          data-code="${p.id}"
          data-title="${p.title}"
          data-price="${price}"
          data-img="${p.img}"
          data-desc="${p.desc}"
        >
          <div class="product-card__img">
            <img src="${p.img}" alt="${p.title}">
          </div>

          <div class="product-card__body">
            <div class="product-card__title">${p.title}</div>
            <div class="product-card__code">Код: ${p.id}</div>
            <div class="product-card__price">${price} грн.</div>

            <button class="cart-btn">🛒</button>
          </div>
        </article>
      ;
    }).join("");
  }

  function next() {
    start = (start + 1) % popularProducts.length;
    render();
  }

  function prev() {
    start = (start - 1 + popularProducts.length) % popularProducts.length;
    render();
  }

  btnNext?.addEventListener("click", next);
  btnPrev?.addEventListener("click", prev);

  // свайп
  let x0 = null;
  viewport?.addEventListener("pointerdown", e => x0 = e.clientX);
  viewport?.addEventListener("pointerup", e => {
    if (!x0) return;
    const dx = e.clientX - x0;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    x0 = null;
  });

  render();
})();
