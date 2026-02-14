// js/product-modal.js
(function(){
  "use strict";

  function $(sel){ return document.querySelector(sel); }

  const modal = $('#productModal');
  if(!modal) return;

  const pmImg = $('#pmImg');
  const pmThumbs = $('#pmThumbs');
  const pmPrev = $('#pmPrev');
  const pmNext = $('#pmNext');

  const pmTitle = $('#pmTitle');
  const pmCode  = $('#pmCode');
  const pmPrice = $('#pmPrice');
  const pmDesc  = $('#pmDesc');
  const pmFav   = $('#pmFav');
  const pmQty   = $('#pmQty');
  const pmAddToCart = $('#pmAddToCart');

  let currentProduct = null;

  // gallery state
  let galleryUrls = [];
  let galleryIndex = 0;

  function safeParseJson(s){
    try{ return JSON.parse(s); }catch{ return null; }
  }

  function normalizeImgs(p){
    const arr =
      Array.isArray(p?.imgs) ? p.imgs :
      (typeof p?.imgs === "string" ? safeParseJson(p.imgs) : null);

    const urls = (arr && Array.isArray(arr) ? arr : [])
      .map(x => String(x || "").trim())
      .filter(Boolean);

    const main = String(p?.img || "").trim();
    if(main && !urls.includes(main)) urls.unshift(main);

    return urls.length ? urls : (main ? [main] : []);
  }

  function setMainImage(i){
    if(!galleryUrls.length) return;
    galleryIndex = (i + galleryUrls.length) % galleryUrls.length;

    const url = galleryUrls[galleryIndex];
    if(pmImg){
      pmImg.src = url;
      pmImg.alt = currentProduct?.title || "";
    }

    if(pmThumbs){
      pmThumbs.querySelectorAll(".pm-thumb").forEach((b, idx)=>{
        b.classList.toggle("is-active", idx === galleryIndex);
      });
    }
    syncNav();
  }

  function renderThumbs(){
    if(!pmThumbs) return;
    if(galleryUrls.length <= 1){
      pmThumbs.innerHTML = "";
      pmThumbs.style.display = "none";
      return;
    }
    pmThumbs.style.display = "";
    pmThumbs.innerHTML = galleryUrls.map((url, idx)=>(
      `<button class="pm-thumb ${idx===galleryIndex?'is-active':''}" type="button" data-idx="${idx}" aria-label="Фото ${idx+1}">
         <img src="${url}" alt="">
       </button>`
    )).join("");
  }

  function syncNav(){
    const multi = galleryUrls.length > 1;
    if(pmPrev) pmPrev.disabled = !multi;
    if(pmNext) pmNext.disabled = !multi;
  }

  function renderGallery(urls, startUrl=""){
    galleryUrls = Array.isArray(urls) ? urls : [];
    galleryIndex = 0;

    if(!galleryUrls.length){
      if(pmImg) pmImg.src = "";
      if(pmThumbs){ pmThumbs.innerHTML=""; pmThumbs.style.display="none"; }
      if(pmPrev) pmPrev.disabled = true;
      if(pmNext) pmNext.disabled = true;
      return;
    }

    if(startUrl){
      const i = galleryUrls.indexOf(startUrl);
      if(i >= 0) galleryIndex = i;
    }

    setMainImage(galleryIndex);
    renderThumbs();
    syncNav();
  }

  function setText(el, text){
    if(!el) return;
    el.textContent = text == null ? "" : String(text);
  }

  function safePrice(val){
    const n = parseFloat(String(val ?? "").replace(",", ".")) || 0;
    return n ? n.toFixed(2) : String(val ?? "").trim();
  }

  function setFavBtnState(active){
    if(!pmFav) return;
    pmFav.classList.toggle("active", !!active);
    pmFav.textContent = active ? "♥️" : "♡";
  }

  async function fetchImgsById(id){
    const SUPABASE_URL = window.SUPABASE_URL;
    const KEY = window.SUPABASE_ANON_KEY;
    if(!SUPABASE_URL || !KEY || !id) return null;

    const url = `${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}&select=img,imgs`;
    const res = await fetch(url, {
      headers:{
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type":"application/json"
      }
    });
    if(!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) && data[0] ? data[0] : null;
  }

  async function openProductModal(product){
    if(!product) return;

    currentProduct = {
      id: product.id,
      title: product.title,
      price: product.price,
      img: product.img,
      desc: product.desc,
      imgs: product.imgs
    };

    // fill meta
    setText(pmTitle, currentProduct.title || "");
    setText(pmCode, currentProduct.id ? `Код: ${currentProduct.id}` : "");
    setText(pmPrice, safePrice(currentProduct.price) ? `${safePrice(currentProduct.price)} грн.` : "");

    // desc
    if(pmDesc){
      const text = String(currentProduct.desc || "").trim();
      pmDesc.textContent = text || "Опис буде додано пізніше 🙂";
    }

    // fav state (если store.js есть)
    try{
      const inFav = typeof window.isInFavorites === "function" && currentProduct.id
        ? window.isInFavorites(currentProduct.id)
        : false;
      setFavBtnState(inFav);
    }catch{ setFavBtnState(false); }

    // qty default
    if(pmQty) pmQty.value = "1";

    // gallery from product first
    let urls = normalizeImgs(currentProduct);

    // if only 0/1 image -> try fetch from DB by id (чтоб не зависеть от data-imgs)
    if(urls.length <= 1 && currentProduct.id){
      try{
        const row = await fetchImgsById(currentProduct.id);
        if(row){
          const merged = { ...currentProduct, ...row };
          urls = normalizeImgs(merged);
          currentProduct.img = merged.img;
          currentProduct.imgs = merged.imgs;
        }
      }catch{}
    }

    renderGallery(urls, currentProduct.img || "");

    // show
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal(){
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    currentProduct = null;
  }

  // expose
  window.openProductModal = openProductModal;
  window.closeProductModal = closeModal;

  // thumb click
  pmThumbs?.addEventListener("click", (e)=>{
    const btn = e.target.closest(".pm-thumb");
    if(!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    if(!Number.isFinite(idx)) return;
    setMainImage(idx);
  });

  // prev/next click
  pmPrev?.addEventListener("click", ()=> setMainImage(galleryIndex - 1));
  pmNext?.addEventListener("click", ()=> setMainImage(galleryIndex + 1));

  // swipe (mobile)
  (function initSwipe(){
    const box = modal.querySelector(".pm-gallery") || modal.querySelector(".pmodal__img") || modal;
    if(!box) return;
    let x0 = null;
    box.addEventListener("touchstart", (e)=>{
      if(!e.touches || e.touches.length!==1) return;
      x0 = e.touches[0].clientX;
    }, {passive:true});
    box.addEventListener("touchend", (e)=>{
      if(x0==null) return;
      const x1 = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : x0;
      const dx = x1 - x0;
      x0 = null;
      if(Math.abs(dx) < 40) return;
      setMainImage(galleryIndex + (dx < 0 ? 1 : -1));
    }, {passive:true});
  })();

  // open via delegation on cards (click except on buttons/inputs)
  document.addEventListener("click", (e)=>{
    const closeBtn = e.target.closest("[data-close='1']");
    if(closeBtn){ e.preventDefault(); closeModal(); return; }

    if(e.key === "Escape") return;

    const card = e.target.closest(".product-card");
    if(!card) return;

    // don't open modal on action controls
    if(e.target.closest("button") || e.target.closest("input") || e.target.closest("a")) {
      // allow click on image/title area if it's not a control
      if(e.target.closest(".product-card__img") || e.target.closest(".product-card__title")) {
        // ok
      } else {
        return;
      }
    }

    const product = {
      id: card.dataset.code || "",
      title: card.dataset.title || card.querySelector(".product-card__title")?.innerText?.trim() || "",
      price: card.dataset.price || "",
      img: card.dataset.img || card.querySelector(".product-card__img img")?.getAttribute("src") || "",
      desc: card.dataset.desc || "",
      imgs: card.dataset.imgs || ""
    };

    openProductModal(product);
  });

  // close on overlay/esc
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });
})();
