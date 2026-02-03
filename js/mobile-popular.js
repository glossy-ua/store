// js/mobile-popular.js
if (!window.matchMedia("(max-width: 700px)").matches) return;
(async function () {
  

  const track = document.getElementById("popularTrack");
  if (!track) return;

  const btnPrev = document.querySelector(".popular__nav--prev");
  const btnNext = document.querySelector(".popular__nav--next");

  let products = await fetchProducts({ popular: true, limit: 10 });
  let index = 0;

  function render() {
    const p = products[index];
    if (!p) return;

    track.innerHTML = 
      <article class="product-card mobile-card">
        <div class="product-card__img">
          <img src="${p.img}" alt="${p.title}">
        </div>

        <div class="product-card__body">
          <div class="product-card__title">${p.title}</div>
          <div class="product-card__code">Код: ${p.id}</div>
          <div class="product-card__price">${p.price} грн.</div>

          <button class="cart-btn">🛒</button>
        </div>
      </article>
    ;
  }

  btnNext?.addEventListener("click", () => {
    index = (index + 1) % products.length;
    render();
  });

  btnPrev?.addEventListener("click", () => {
    index = (index - 1 + products.length) % products.length;
    render();
  });

  render();
})();

