// js/home-popular.js
(async function () {
  "use strict";

  const track = document.getElementById("popularTrack");
  const viewport = document.querySelector(".popular__viewport");
  const btnPrev = document.querySelector(".popular__nav--prev");
  const btnNext = document.querySelector(".popular__nav--next");
  if (!track || !viewport || !btnPrev || !btnNext) return;

  if (typeof window.fetchProducts !== "function") {
    console.warn("[popular] fetchProducts() not found (js/db.js?)");
    return;
  }

  const mq = window.matchMedia("(max-width: 768px)");
  const AUTOPLAY_MS = 7000;

  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const getVisible = () => (mq.matches ? 1 : 4);

  function cardHTML(p) {
    const priceNum = parseFloat(String(p.price ?? 0).replace(",", ".")) || 0;

    return `
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
    `;
  }

  // ===== load products =====
  let products = [];
  try {
    products = await window.fetchProducts({ popular: true, limit: 20 });
  } catch (e) {
    console.error("[popular] fetch error:", e);
    return;
  }
  if (!Array.isArray(products) || products.length === 0) return;

  // ===== state =====
  let VISIBLE = getVisible();
  let index = 0; // position in track (with clones)
  let cardW = 0;
  let gap = 0;
  let isAnimating = false;

  let timer = null;
  let paused = false;

  function setCSSVars() {
    track.style.setProperty("--popular-visible", String(VISIBLE));
    // gap берём из computed track gap, но если его нет - оставим дефолт
  }

  function setTransition(on) {
    track.style.transition = on ? "transform 350ms ease" : "none";
  }

  function applyTranslate(px) {
    track.style.transform = `translate3d(${px}px,0,0)`;
  }

  function translateFor(i) {
    return -(i * (cardW + gap));
  }

  function measure() {
    const first = track.querySelector(".product-card");
    if (!first) return;

    const st = getComputedStyle(track);
    const rawGap = st.gap || st.columnGap || "0";
    gap = parseFloat(rawGap) || 0;

    cardW = first.getBoundingClientRect().width || 0;

    // на всякий — если gap не задан в css, зафиксируем дефолт
    if (!gap) {
      gap = 18;
      track.style.setProperty("--popular-gap", "18px");
    } else {
      track.style.setProperty("--popular-gap", `${gap}px`);
    }
  }

  function updateBadgesAndFavs() {
    try { window.updateFavBadge?.(); } catch {}
    try { window.updateCartBadge?.(); } catch {}

    // подсветка избранного (если есть isFav)
    try {
      if (typeof window.isFav === "function") {
        track.querySelectorAll(".product-card").forEach((card) => {
          const id = card.dataset.code;
          const btn = card.querySelector(".fav-btn");
          if (!btn || !id) return;
          const active = window.isFav(id);
          btn.classList.toggle("active", !!active);
          btn.textContent = active ? "♥️" : "♡";
        });
      }
    } catch {}
  }

  // ===== modal fallback (если твой products.js не даёт функцию) =====
  function openModalFromCard(card) {
    // если у тебя есть своя функция модалки — используем её
    if (typeof window.openProductModal === "function") {
      // пробуем передать объект
      window.openProductModal({
        id: card.dataset.code,
        title: card.dataset.title,
        price: card.dataset.price,
        img: card.dataset.img,
        desc: card.dataset.desc,
      });
      return;
    }

    const modal = document.getElementById("productModal");
    if (!modal) return;

    const pmImg = document.getElementById("pmImg");
    const pmTitle = document.getElementById("pmTitle");
    const pmCode = document.getElementById("pmCode");
    const pmPrice = document.getElementById("pmPrice");
    const pmDesc = document.getElementById("pmDesc");
    const pmQty = document.getElementById("pmQty");
    const pmAdd = document.getElementById("pmAddToCart");
    const pmFav = document.getElementById("pmFav");

    const id = card.dataset.code || "";
    const title = card.dataset.title || "";
    const price = card.dataset.price || "0";
    const img = card.dataset.img || "";
    const desc = card.dataset.desc || "";

    if (pmImg) pmImg.src = img;
    if (pmTitle) pmTitle.textContent = title;
    if (pmCode) pmCode.textContent = id ? `Код: ${id}` : "";
    if (pmPrice) pmPrice.textContent = `${price} грн.`;
    if (pmDesc) pmDesc.textContent = desc;
    if (pmQty) pmQty.value = "1";

    // fav state
    if (pmFav && typeof window.isFav === "function") {
      const active = window.isFav(id);
      pmFav.classList.toggle("active", !!active);
      pmFav.textContent = active ? "♥️" : "♡";
    }

    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    const close = () => {
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      modal.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };

    const onKey = (e) => { if (e.key === "Escape") close(); };

    const onClick = (e) => {
      const t = e.target;
      if (t?.dataset?.close || t?.closest?.("[data-close='1']")) close();
    };

    modal.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);

    // кнопки в модалке
    pmAdd?.onclick && (pmAdd.onclick = null);
    pmAdd?.addEventListener("click", () => {
      const q = Math.max(1, parseInt(pmQty?.value || "1", 10) || 1);
      window.addToCart?.(id, q);
      updateBadgesAndFavs();
    });

    pmFav?.onclick && (pmFav.onclick = null);
    pmFav?.addEventListener("click", () => {
      window.toggleFav?.(id);
      updateBadgesAndFavs();
      // синхроним кнопку в модалке
      if (typeof window.isFav === "function") {
        const active = window.isFav(id);
        pmFav.classList.toggle("active", !!active);
        pmFav.textContent = active ? "♥️" : "♡";
      }
    });
  }

  // ===== build loop =====
  function build() {
    VISIBLE = getVisible();
    setCSSVars();

    // если товаров мало — без лупа
    if (products.length <= VISIBLE) {
      track.innerHTML = products.map(cardHTML).join("");
      index = 0;

      requestAnimationFrame(() => {
        measure();
        setTransition(false);
        applyTranslate(translateFor(index));
        updateBadgesAndFavs();
      });
      return;
    }

    const n = products.length;
    const left = products.slice(n - VISIBLE, n);
    const right = products.slice(0, VISIBLE);
    const all = [...left, ...products, ...right];

    track.innerHTML = all.map(cardHTML).join("");
    index = VISIBLE;

    requestAnimationFrame(() => {
      measure();
      setTransition(false);
      applyTranslate(translateFor(index));
      updateBadgesAndFavs();
    });
  }

  function fixIfOnClone() {
    if (products.length <= VISIBLE) return;

    const n = products.length;
    const firstOriginal = VISIBLE;
    const lastOriginal = VISIBLE + n - 1;

    if (index < firstOriginal) {
      index = VISIBLE + n - 1;
      setTransition(false);
      applyTranslate(translateFor(index));
    } else if (index > lastOriginal) {
      index = VISIBLE;
      setTransition(false);
      applyTranslate(translateFor(index));
    }
  }

  function next() {
    if (products.length <= VISIBLE || isAnimating) return;
    isAnimating = true;
    index += 1;
    setTransition(true);
    applyTranslate(translateFor(index));
  }

  function prev() {
    if (products.length <= VISIBLE || isAnimating) return;
    isAnimating = true;
    index -= 1;
    setTransition(true);
    applyTranslate(translateFor(index));
  }

  btnNext.addEventListener("click", next);
  btnPrev.addEventListener("click", prev);

  track.addEventListener("transitionend", (e) => {
    if (e.target !== track) return;
    isAnimating = false;
    fixIfOnClone();
    setTransition(false);
    applyTranslate(translateFor(index));
  });

  // ===== делегирование кликов (чтобы не ломалось при перерисовке) =====
  track.addEventListener("click", (e) => {
    const t = e.target;
    const card = t.closest?.(".product-card");
    if (!card) return;

    // qty
    if (t.matches?.(".qty__btn")) {
      e.preventDefault();
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
      const id = card.dataset.code;
      window.toggleFav?.(id);
      updateBadgesAndFavs();
      return;
    }

    // cart
    if (t.closest?.(".cart-btn")) {
      e.preventDefault();
      const id = card.dataset.code;
      const q = Math.max(1, parseInt(card.querySelector(".qty__input")?.value || "1", 10) || 1);
      window.addToCart?.(id, q);
      updateBadgesAndFavs();
      return;
    }

    // open modal (клик по картинке/заголовку/карточке, но не по кнопкам)
    if (
      t.closest?.(".product-card__img") ||
      t.closest?.(".product-card__title") ||
      t.closest?.(".product-card__body")
    ) {
      // если кликнули по инпуту — не открываем
      if (t.matches?.("input, button")) return;
      openModalFromCard(card);
    }
  });

  // ===== autoplay pause =====
  function stopAutoplay() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function startAutoplay() {
    stopAutoplay();
    if (products.length <= VISIBLE) return;
    timer = setInterval(() => {
      if (!paused && !isAnimating) next();
    }, AUTOPLAY_MS);
  }

  viewport.addEventListener("mouseenter", () => {
    paused = true;
    stopAutoplay();
  });
  viewport.addEventListener("mouseleave", () => {
    paused = false;
    startAutoplay();
  });

  // ===== swipe (mobile) =====
  let x0 = null;
  viewport.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
  viewport.addEventListener("pointerup", (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) < 30) return;
    if (dx < 0) next(); else prev();
  });

  // ===== resize =====
  function onResize() {
    const newVisible = getVisible();
    if (newVisible !== VISIBLE) {
      build();
      startAutoplay();
      return;
    }
    requestAnimationFrame(() => {
      measure();
      setTransition(false);
      applyTranslate(translateFor(index));
    });
  }

  window.addEventListener("resize", onResize);
  mq.addEventListener?.("change", onResize);

  // ===== init =====
  build();
  startAutoplay();
})();
