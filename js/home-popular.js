// js/home-popular.js
(async function () {
  "use strict";

  const track = document.getElementById("popularTrack");
  const viewport = document.querySelector(".popular__viewport");
  const btnPrev = document.querySelector(".popular__nav--prev");
  const btnNext = document.querySelector(".popular__nav--next");
  if (!track || !viewport || !btnPrev || !btnNext) return;

  if (typeof window.fetchProducts !== "function") {
    console.warn("[popular] fetchProducts() not found");
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

  function getProductFromCard(card) {
    const priceNum = parseFloat(String(card.dataset.price ?? "0").replace(",", ".")) || 0;

    return {
      id: String(card.dataset.code || "").trim(),
      title: String(card.dataset.title || "").trim(),
      price: priceNum ? priceNum.toFixed(2) : String(card.dataset.price || "").trim(),
      img: String(card.dataset.img || "").trim(),
      desc: String(card.dataset.desc || "").trim(),
    };
  }

  function setFavBtnState(btn, active) {
    if (!btn) return;
    btn.classList.toggle("active", !!active);
    btn.textContent = active ? "♥️" : "♡";
  }

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
  let index = 0;
  let cardW = 0;
  let gap = 0;
  let isAnimating = false;

  let timer = null;
  let paused = false;

  function setCSSVars() {
    track.style.setProperty("--popular-visible", String(VISIBLE));
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

    try {
      if (typeof window.isFav === "function") {
        track.querySelectorAll(".product-card").forEach((card) => {
          const id = card.dataset.code;
          const btn = card.querySelector(".fav-btn");
          if (!btn || !id) return;
          setFavBtnState(btn, window.isFav(id));
        });
      }
    } catch {}
  }

  function openModalFromCard(card) {
    const p = getProductFromCard(card);
    if (!p.id) return;

    // если есть глобальная модалка — пусть она ведёт себя как в каталоге
    if (typeof window.openProductModal === "function") {
      window.openProductModal(p);
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

    if (pmImg) pmImg.src = p.img || "";
    if (pmTitle) pmTitle.textContent = p.title || "";
    if (pmCode) pmCode.textContent = p.id ? `Код: ${p.id}` : "";
    if (pmPrice) pmPrice.textContent = `${p.price || "0"} грн.`;
    if (pmDesc) pmDesc.textContent = p.desc || "Опис буде додано пізніше 🙂";
    if (pmQty) pmQty.value = "1";

    // ✅ важное: сразу выставили правильное сердце в модалке
    if (pmFav && typeof window.isFav === "function") {
      setFavBtnState(pmFav, window.isFav(p.id));
    }

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    const onKey = (e) => { if (e.key === "Escape") close(); };
    const onClick = (e) => {
      const t = e.target;
      if (t?.dataset?.close === "1" || t?.closest?.("[data-close='1']")) close();
    };

    const close = () => {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      modal.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };

    modal.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);

    // ✅ кнопка "в корзину" из модалки
    if (pmAdd) {
      pmAdd.onclick = () => {
        const q = Math.max(1, parseInt(pmQty?.value || "1", 10) || 1);
        window.addToCart?.(p, q);
        window.updateCartBadge?.();
        window.animateAdded?.(pmAdd, { duration: 700, text: "Додано", keepText: false });
      };
    }

    // ✅ ФИКС: избранное в модалке (после клика обновляем и модалку, и карточки)
    if (pmFav) {
      pmFav.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        window.toggleFav?.(p);

        const active = (typeof window.isFav === "function") ? window.isFav(p.id) : false;
        setFavBtnState(pmFav, active);

        updateBadgesAndFavs();
      };
    }
  }

  // ===== build loop =====
  function build() {
    VISIBLE = getVisible();
    setCSSVars();

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

  // ===== clicks =====
  track.addEventListener("click", (e) => {
    const t = e.target;
    const card = t.closest?.(".product-card");
    if (!card) return;

    // qty
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

    // fav on card
    if (t.closest?.(".fav-btn")) {
      e.preventDefault();
      e.stopPropagation();
      const p = getProductFromCard(card);
      if (!p.id) return;
      window.toggleFav?.(p);
      updateBadgesAndFavs();
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
      window.updateCartBadge?.();

      window.animateAdded?.(t.closest(".cart-btn"), { duration: 700 });

      updateBadgesAndFavs();
      return;
    }

    // open modal
    if (
      t.closest?.(".product-card__img") ||
      t.closest?.(".product-card__title") ||
      t.closest?.(".product-card__body")
    ) {
      if (t.matches?.("input, button")) return;
      e.preventDefault();
      e.stopPropagation();
      openModalFromCard(card);
    }
  });

  // ===== autoplay =====
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

  // ===== swipe =====
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
