// js/product-modal.js
// ЕДИНАЯ логика модалки товара + галерея (стрелки/миниатюры/свайп)
// Другие страницы должны только звать: window.openProductModal(productLike)
//
// productLike минимально: { id, title, price, img, desc, imgs? }
// Если imgs нет — попробуем подтянуть товар из Supabase по id и взять imgs оттуда.

(function () {
  const modal = document.getElementById("productModal");
  if (!modal) return;

  // ------- DOM -------
  const pmImg = document.getElementById("pmImg");
  const pmThumbs = document.getElementById("pmThumbs");
  const pmPrev = document.getElementById("pmPrev");
  const pmNext = document.getElementById("pmNext");

  const pmTitle = document.getElementById("pmTitle");
  const pmCode = document.getElementById("pmCode");
  const pmPrice = document.getElementById("pmPrice");
  const pmDesc = document.getElementById("pmDesc");
  const pmFav = document.getElementById("pmFav");
  const pmQty = document.getElementById("pmQty");
  const pmAddToCart = document.getElementById("pmAddToCart");

  // ------- STATE -------
  let currentProduct = null;
  let gallery = [];
  let index = 0;

  // ------- UTILS -------
  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safePrice(val) {
    const n = parseFloat(String(val ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function hasHtml(s) {
    return /<\/?[a-z][\s\S]*>/i.test(String(s || ""));
  }

  function normalizeImgs(p) {
    if (!p) return [];
    let arr = [];

    if (Array.isArray(p.imgs)) {
      arr = p.imgs;
    } else if (typeof p.imgs === "string" && p.imgs.trim()) {
      try {
        const parsed = JSON.parse(p.imgs);
        if (Array.isArray(parsed)) arr = parsed;
      } catch {}
    }

    arr = arr
      .map(x => String(x || "").trim())
      .filter(Boolean);

    const main = String(p.img || "").trim();
    if (main && !arr.includes(main)) arr.unshift(main);

    const uniq = [];
    const seen = new Set();
    for (const u of arr) {
      const key = u;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      uniq.push(u);
    }

    return uniq.length ? uniq : (main ? [main] : []);
  }

  function preload(url) {
    if (!url) return;
    const img = new Image();
    img.src = url;
  }

  function preloadNeighbors() {
    if (!gallery.length) return;
    if (gallery.length === 1) {
      preload(gallery[0]);
      return;
    }
    const prev = gallery[(index - 1 + gallery.length) % gallery.length];
    const next = gallery[(index + 1) % gallery.length];
    preload(prev);
    preload(next);
  }

  // ------- SUPABASE FETCH (страховка если imgs не передали) -------
  async function fetchProductById(id) {
    const SUPABASE_URL = window.SUPABASE_URL;
    const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

    const select = "id,title,price,img,desc,imgs";
    const q = new URLSearchParams();
    q.set("select", select);
    q.set("id", `eq.${id}`);
    q.set("limit", "1");

    const url = `${SUPABASE_URL}/rest/v1/products?${q.toString()}`;

    try {
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        }
      });
      if (!res.ok) return null;
      const rows = await res.json();
      return rows?.[0] || null;
    } catch {
      return null;
    }
  }

  // ------- GALLERY -------
  function setHidden(el, hidden) {
    if (!el) return;
    if (hidden) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  }

  function updateNav() {
    const multi = gallery.length > 1;
    setHidden(pmPrev, !multi);
    setHidden(pmNext, !multi);
    setHidden(pmThumbs, !multi);
  }

  function setImage(i) {
    if (!gallery.length || !pmImg) return;

    index = (i + gallery.length) % gallery.length;

    pmImg.src = gallery[index];
    pmImg.draggable = false;

    if (pmThumbs) {
      pmThumbs.querySelectorAll(".pm-thumb").forEach((el, idx) => {
        el.classList.toggle("is-active", idx === index);
      });
    }

    preloadNeighbors();
  }

  function renderThumbs() {
    if (!pmThumbs) return;

    if (gallery.length <= 1) {
      pmThumbs.innerHTML = "";
      return;
    }

    pmThumbs.innerHTML = gallery.map((url, i) => `
      <button class="pm-thumb ${i === index ? "is-active" : ""}" type="button" data-pm-thumb="${i}">
        <img src="${escHtml(url)}" alt="">
      </button>
    `).join("");
  }

  function initGallery(urls) {
    gallery = Array.isArray(urls) ? urls : [];
    index = 0;

    if (!gallery.length) {
      if (pmImg) pmImg.src = "";
      if (pmThumbs) pmThumbs.innerHTML = "";
      updateNav();
      return;
    }

    renderThumbs();
    setImage(0);
    updateNav();
  }

  // ------- OPEN / CLOSE -------
  async function openModal(productLike) {
    if (!productLike) return;

    let p = { ...productLike };
    const id = String(p.id || "").trim();

    // если imgs не пришло — подгружаем из базы по id (если сможем)
    // (оставил твою логику: если imgs пусто/строка — пробуем докинуть из БД)
    if ((!p.imgs || (Array.isArray(p.imgs) && p.imgs.length === 0) || typeof p.imgs === "string") && id) {
      const dbP = await fetchProductById(id);
      if (dbP) p = { ...p, ...dbP };
    }

    currentProduct = {
      id: id,
      title: p.title || "",
      price: p.price ?? "",
      priceNum: safePrice(p.price),
      img: String(p.img || "").trim(),
      desc: p.desc || "",
      imgs: p.imgs
    };

    if (pmTitle) pmTitle.textContent = currentProduct.title;
    if (pmCode) pmCode.textContent = currentProduct.id ? `Код: ${currentProduct.id}` : "";

    if (pmPrice) {
      const n = safePrice(currentProduct.price);
      pmPrice.textContent = n ? `${n.toFixed(2)} грн` : "";
    }

    if (pmDesc) {
      const d = currentProduct.desc || "Опис буде додано пізніше 🙂";
      pmDesc[hasHtml(d) ? "innerHTML" : "textContent"] = d;
    }

    if (pmQty) pmQty.value = 1;

    // fav state
    if (pmFav) {
      pmFav.style.display = "";
      const active = typeof window.isFav === "function" ? window.isFav(currentProduct.id) : false;
      pmFav.classList.toggle("active", !!active);
      pmFav.textContent = active ? "♥️" : "♡";
    }

    initGallery(normalizeImgs(currentProduct));

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    currentProduct = null;
    gallery = [];
    index = 0;
    if (pmThumbs) pmThumbs.innerHTML = "";
  }

  window.openProductModal = openModal;

  // ------- EVENTS -------
  document.addEventListener("click", (e) => {
    if (!modal.classList.contains("open")) return;

    // close
    if (e.target?.dataset?.close === "1") {
      closeModal();
      return;
    }

    // prev/next
    if (e.target.closest("#pmPrev")) {
      e.preventDefault();
      setImage(index - 1);
      return;
    }
    if (e.target.closest("#pmNext")) {
      e.preventDefault();
      setImage(index + 1);
      return;
    }

    // thumb
    const th = e.target.closest("[data-pm-thumb]");
    if (th) {
      const i = parseInt(th.getAttribute("data-pm-thumb"), 10);
      if (Number.isFinite(i)) setImage(i);
      return;
    }

    // fav
    if (e.target.closest("#pmFav")) {
      if (!currentProduct) return;
      if (typeof window.toggleFav === "function") window.toggleFav(currentProduct);

      const active = typeof window.isFav === "function" ? window.isFav(currentProduct.id) : false;
      pmFav?.classList.toggle("active", !!active);
      if (pmFav) pmFav.textContent = active ? "♥️" : "♡";

      if (typeof window.updateFavBadge === "function") window.updateFavBadge();
      if (typeof window.refreshFavButtons === "function") window.refreshFavButtons();
      return;
    }

    // add to cart
    if (e.target.closest("#pmAddToCart")) {
      if (!currentProduct) return;

      const qty = Math.max(1, parseInt(pmQty?.value, 10) || 1);

      const prod = {
        id: currentProduct.id,
        title: currentProduct.title,
        price: String(currentProduct.priceNum || currentProduct.price || ""),
        img: currentProduct.img,
        desc: currentProduct.desc || ""
      };

      if (typeof window.addToCart === "function") window.addToCart(prod, qty);
      if (typeof window.updateCartBadge === "function") window.updateCartBadge();
      if (typeof window.animateAdded === "function") {
        window.animateAdded(pmAddToCart, { duration: 700, text: "Додано", keepText: false });
      }
      return;
    }
  });

  // qty +/- (универсально)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".qty__btn");
    if (!btn) return;

    const wrap = btn.closest(".qty");
    if (!wrap) return;

    const input = wrap.querySelector("input");
    if (!input) return;

    let val = parseInt(input.value, 10) || 1;
    if (btn.dataset.action === "plus") val++;
    if (btn.dataset.action === "minus") val = Math.max(1, val - 1);
    input.value = val;
  });

  document.addEventListener("keydown", (e) => {
    if (!modal.classList.contains("open")) return;

    if (e.key === "Escape") closeModal();
    if (e.key === "ArrowLeft") setImage(index - 1);
    if (e.key === "ArrowRight") setImage(index + 1);
  });

  // ------- SWIPE (pointer) -------
  let startX = null;
  let startY = null;
  let activePointerId = null;

  function onPointerDown(e) {
    if (!modal.classList.contains("open")) return;
    if (!gallery || gallery.length <= 1) return;
    if (!e.target.closest("#pmImg")) return;

    activePointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;

    try { e.target.setPointerCapture?.(activePointerId); } catch {}
  }

  function finishPointer(e) {
    if (activePointerId === null) return;
    if (e.pointerId !== activePointerId) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    startX = null;
    startY = null;
    activePointerId = null;

    // вертикальный скролл — не листаем
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (Math.abs(dx) < 40) return;

    if (dx < 0) setImage(index + 1);
    else setImage(index - 1);
  }

  function onPointerUp(e) {
    if (!modal.classList.contains("open")) return;
    finishPointer(e);
  }

  function onPointerCancel(e) {
    // просто сбрасываем состояние
    if (activePointerId === null) return;
    if (e.pointerId !== activePointerId) return;
    startX = null;
    startY = null;
    activePointerId = null;
  }

  pmImg?.addEventListener("pointerdown", onPointerDown);
  pmImg?.addEventListener("pointerup", onPointerUp);
  pmImg?.addEventListener("pointercancel", onPointerCancel);
})();
