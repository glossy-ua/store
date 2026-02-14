// js/product-modal.js
// Universal product modal with image gallery (arrows + swipe, looped)

(() => {
  const modal = document.getElementById("productModal");
  if (!modal) return;

  const overlay = modal.querySelector("[data-close]") || modal.querySelector(".pmodal__overlay");
  const closeBtn = modal.querySelector(".pmodal__close,[data-close-btn]");

  const imgWrap =
    modal.querySelector(".pmodal__img") ||
    modal.querySelector(".pm-img") ||
    modal;

  const imgEl =
    modal.querySelector("#pmImg") ||
    modal.querySelector("[data-pm-img]") ||
    imgWrap.querySelector("img");

  const titleEl =
    modal.querySelector("#pmTitle") ||
    modal.querySelector("[data-pm-title]");

  const priceEl =
    modal.querySelector("#pmPrice") ||
    modal.querySelector("[data-pm-price]");

  const descEl =
    modal.querySelector("#pmDesc") ||
    modal.querySelector("[data-pm-desc]");

  // Create nav buttons if missing
  let prevBtn = modal.querySelector(".pm-nav--prev");
  let nextBtn = modal.querySelector(".pm-nav--next");

  function ensureNav() {
    if (!prevBtn) {
      prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "pm-nav pm-nav--prev";
      prevBtn.setAttribute("aria-label", "Previous photo");
      prevBtn.innerHTML = "‹";
      imgWrap.appendChild(prevBtn);
    }
    if (!nextBtn) {
      nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "pm-nav pm-nav--next";
      nextBtn.setAttribute("aria-label", "Next photo");
      nextBtn.innerHTML = "›";
      imgWrap.appendChild(nextBtn);
    }
  }

  // Thumbs
  let thumbs = modal.querySelector("#pmThumbs") || modal.querySelector(".pm-thumbs");
  function ensureThumbs() {
    if (!thumbs) {
      thumbs = document.createElement("div");
      thumbs.className = "pm-thumbs";
      // try place under image
      const afterImg = imgWrap.parentElement || imgWrap;
      afterImg.insertAdjacentElement("afterend", thumbs);
    }
  }

  function normalizeImgs(p) {
    const out = [];
    const push = (u) => {
      const s = String(u || "").trim();
      if (!s) return;
      if (!out.includes(s)) out.push(s);
    };

    if (p) {
      if (p.img) push(p.img);
      if (p.image) push(p.image);
      if (p.images && Array.isArray(p.images)) p.images.forEach(push);

      const v = p.imgs ?? p.gallery ?? p.photos;
      if (Array.isArray(v)) v.forEach(push);
      else if (typeof v === "string") {
        const s = v.trim();
        if (s) {
          try {
            const j = JSON.parse(s);
            if (Array.isArray(j)) j.forEach(push);
            else push(s);
          } catch {
            // comma-separated fallback
            s.split(",").map(x => x.trim()).filter(Boolean).forEach(push);
          }
        }
      }
    }
    return out;
  }

  let imgs = [];
  let idx = 0;

  function setIndex(next) {
    if (!imgs.length) return;
    const n = imgs.length;
    idx = ((next % n) + n) % n;

    if (imgEl) imgEl.src = imgs[idx];

    if (thumbs) {
      thumbs.querySelectorAll("button[data-i]").forEach((b) => {
        b.classList.toggle("is-active", parseInt(b.dataset.i, 10) === idx);
      });
    }
  }

  function renderThumbs() {
    ensureThumbs();
    if (!thumbs) return;

    if (imgs.length <= 1) {
      thumbs.innerHTML = "";
      return;
    }

    thumbs.innerHTML = imgs.map((u, i) => `
      <button type="button" class="pm-thumb ${i === idx ? "is-active" : ""}" data-i="${i}">
        <img src="${u}" alt="">
      </button>
    `).join("");

    thumbs.querySelectorAll("button[data-i]").forEach((b) => {
      b.addEventListener("click", () => setIndex(parseInt(b.dataset.i, 10)));
    });
  }

  function open() {
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("open");
    document.body.classList.add("modal-open");
  }

  function close() {
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("open");
    document.body.classList.remove("modal-open");
  }

  overlay?.addEventListener("click", close);
  closeBtn?.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (!modal.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") setIndex(idx - 1);
    if (e.key === "ArrowRight") setIndex(idx + 1);
  });

  // Swipe (pointer)
  let startX = null;
  let startY = null;

  function onPointerDown(e) {
    if (!modal.classList.contains("open")) return;
    startX = e.clientX;
    startY = e.clientY;
  }
  function onPointerUp(e) {
    if (startX == null) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    startX = null;
    startY = null;

    // ignore vertical scroll gestures
    if (Math.abs(dy) > Math.abs(dx)) return;

    if (dx > 40) setIndex(idx - 1);
    else if (dx < -40) setIndex(idx + 1);
  }

  imgWrap.addEventListener("pointerdown", onPointerDown);
  imgWrap.addEventListener("pointerup", onPointerUp);
  imgWrap.addEventListener("pointercancel", () => { startX = null; startY = null; });

  ensureNav();
  prevBtn?.addEventListener("click", () => setIndex(idx - 1));
  nextBtn?.addEventListener("click", () => setIndex(idx + 1));

  // PUBLIC API
  function openProductModal(product) {
    const p = product || {};

    imgs = normalizeImgs(p);
    idx = 0;

    if (titleEl && p.title != null) titleEl.textContent = String(p.title);
    if (priceEl && p.price != null) priceEl.textContent = String(p.price);
    if (descEl && p.desc != null) descEl.textContent = String(p.desc);

    if (imgEl) imgEl.src = imgs[0] || "";

    renderThumbs();
    open();
  }

  window.openProductModal = openProductModal;
})();
