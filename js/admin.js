// js/admin.js
// Admin panel: Products + Orders (filters, search, bulk actions, realtime, export, stock-deduct on done)
// Uses global window.sb from supabaseClient.js

(() => {
  const sb = window.sb;
  const BUCKET = "products";

  // ---------- DOM (common) ----------
  const authBox = document.getElementById("adminAuth");
  const appBox = document.getElementById("adminApp");

  const emailInput = document.getElementById("email");
  const passInput = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // Tabs + sections
  const tabProducts = document.getElementById("tabProducts");
  const tabOrders = document.getElementById("tabOrders");
  const productsSection = document.getElementById("productsSection");
  const ordersSection = document.getElementById("ordersSection");

  const toastEl = document.getElementById("adminToast");

  // ---------- DOM (products) ----------
  const addBtn = document.getElementById("addProductBtn");
  const grid = document.getElementById("productsGrid");

  // product filters
  const prodSearch = document.getElementById("prodSearch");
  const prodCategoryFilter = document.getElementById("prodCategoryFilter");
  const prodActiveFilter = document.getElementById("prodActiveFilter");
  const prodPopularFilter = document.getElementById("prodPopularFilter");
  const prodLowStock = document.getElementById("prodLowStock");
  const prodLowStockN = document.getElementById("prodLowStockN");
  const prodSort = document.getElementById("prodSort");

  // product pager
  const prodPrev = document.getElementById("prodPrev");
  const prodNext = document.getElementById("prodNext");
  const prodPageEl = document.getElementById("prodPage");
  const prodPagesEl = document.getElementById("prodPages");

  // product toolbar / bulk
  const prodToolbar = document.getElementById("prodToolbar");
  const prodSelectAll = document.getElementById("prodSelectAll");
  const prodSelectedCount = document.getElementById("prodSelectedCount");
  const bulkActivate = document.getElementById("bulkActivate");
  const bulkDeactivate = document.getElementById("bulkDeactivate");
  const bulkPopular = document.getElementById("bulkPopular");
  const bulkUnpopular = document.getElementById("bulkUnpopular");
  const bulkDelete = document.getElementById("bulkDelete");

  // ---------- DOM (product modal) ----------
  const modal = document.getElementById("productModal");
  const admModalTitle = document.getElementById("admModalTitle");
  const admTitle = document.getElementById("admTitle");
  const admPrice = document.getElementById("admPrice");
  const admStock = document.getElementById("admStock");
  const admCategory = document.getElementById("admCategory");
  const admDesc = document.getElementById("admDesc");
  const admImg = document.getElementById("admImg");
  const admActive = document.getElementById("admActive");
  const admPopular = document.getElementById("admPopular");
  const admSave = document.getElementById("admSave");
  const admCancel = document.getElementById("admCancel");
  const admErr = document.getElementById("admErr");
  const pmImg = document.getElementById("pmImg");

  const admDrop = document.getElementById("admDrop");
  const admPick = document.getElementById("admPick");
  const admFile = document.getElementById("admFile");

  
  const admDropMore = document.getElementById("admDropMore");
  const admPickMore = document.getElementById("admPickMore");
  const admFilesMore = document.getElementById("admFilesMore");
  const admImgsList = document.getElementById("admImgsList");
// ---------- DOM (orders) ----------
  const ordersGrid = document.getElementById("ordersGrid");
  const orderStatusFilter = document.getElementById("orderStatusFilter");
  const orderSearch = document.getElementById("orderSearch");
  const ordersRefresh = document.getElementById("ordersRefresh");
  const ordersExport = document.getElementById("ordersExport");

  // ---------- STATE ----------
  let editingId = null;
  let selectedFile = null;
  let existingImgUrl = "";

  
  let galleryItems = []; // [{url, file?, objectUrl?, isNew?}]
let ordersLoadedOnce = false;
  let currentTab = "products";
  let allOrdersCache = [];
  let categoriesCache = []; // [{id, slug, title, sort, is_active}]
  let productsCache = [];   // raw list from DB

  // products view state
  const PAGE_SIZE = 12;
  let prodPage = 1;
  let prodFiltered = [];
  const selectedProductIds = new Set();

  // realtime
  let ordersChannel = null;

  // ---------- HELPERS ----------
  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function show(el) { if (el) el.hidden = false; }
  function hide(el) { if (el) el.hidden = true; }

  function setErr(text) {
    if (admErr) admErr.textContent = text || "";
  }

  function safePrice(val) {
    const n = parseFloat(String(val ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function safeInt(val) {
    const n = parseInt(String(val ?? "").replace(/[^\d-]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  }

  function setPreview(url) {
    if (pmImg) pmImg.src = url || "";
  }

  function previewFromFile(file) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  function parseImgsField(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === "string") {
      const s = v.trim();
      if (!s) return [];
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        // allow comma-separated fallback
        if (s.includes(",")) return s.split(",").map(x => x.trim()).filter(Boolean);
        return [];
      }
    }
    return [];
  }

  function revokeObjectUrl(it) {
    if (it?.objectUrl) {
      try { URL.revokeObjectURL(it.objectUrl); } catch {}
      it.objectUrl = "";
    }
  }

  function clearGallery() {
    galleryItems.forEach(revokeObjectUrl);
    galleryItems = [];
    renderGallery();
  }

  function uniqUrls(urls) {
    const out = [];
    const set = new Set();
    for (const u of urls) {
      const s = String(u || "").trim();
      if (!s || set.has(s)) continue;
      set.add(s);
      out.push(s);
    }
    return out;
  }

  function ensureMainFirst() {
    // first item is main; also keep admImg in sync
    const main = galleryItems[0]?.url || "";
    if (admImg) admImg.value = main && !galleryItems[0]?.isNew ? main : (admImg.value || "");
    setPreview(main || "");
  }

  function setAsMain(idx) {
    const i = Number(idx);
    if (!Number.isFinite(i) || i < 0 || i >= galleryItems.length) return;
    if (i === 0) return;
    const [it] = galleryItems.splice(i, 1);
    galleryItems.unshift(it);
    renderGallery();
    ensureMainFirst();
  }

  function removeFromGallery(idx) {
    const i = Number(idx);
    if (!Number.isFinite(i) || i < 0 || i >= galleryItems.length) return;
    const [it] = galleryItems.splice(i, 1);
    revokeObjectUrl(it);
    renderGallery();
    ensureMainFirst();
  }

  function renderGallery() {
    if (!admImgsList) return;
    if (!galleryItems.length) {
      admImgsList.innerHTML = "";
      return;
    }
    admImgsList.innerHTML = galleryItems.map((it, idx) => {
      const isMain = idx === 0;
      const url = escHtml(it.url || "");
      return `
        <div class="adm-thumb ${isMain ? "is-main" : ""}" data-idx="${idx}">
          ${isMain ? `<div class="adm-thumb__badge">MAIN</div>` : ""}
          <img src="${url}" alt="">
          <div class="adm-thumb__bar">
            <button type="button" class="adm-thumb__btn" data-action="main" data-idx="${idx}" title="Зробити головним">⭐</button>
            <button type="button" class="adm-thumb__btn" data-action="remove" data-idx="${idx}" title="Видалити">✕</button>
          </div>
        </div>
      `;
    }).join("");
  }

  function addFilesToGallery(files) {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;

    list.forEach((file) => {
      const objectUrl = URL.createObjectURL(file);
      galleryItems.push({ url: objectUrl, file, objectUrl, isNew: true });
    });

    renderGallery();
    if (galleryItems.length === list.length) {
      // gallery was empty before
      ensureMainFirst();
    }
  }

  function fmtDate(dt) {
    try {
      return new Date(dt).toLocaleString("uk-UA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(dt || "");
    }
  }

  function money(v) {
    const n = parseFloat(String(v).replace(",", ".").replace(/[^\d.]/g, "")) || 0;
    return n.toFixed(2);
  }

  function statusLabel(s) {
    const map = {
      new: "Нове",
      processing: "В роботі",
      ready: "Готово",
      done: "Завершено",
      cancelled: "Скасовано",
    };
    return map[s] || s || "new";
  }

  function statusClass(s) {
    return "st-" + String(s || "new");
  }

  function toast(text, type = "info", ms = 2400) {
    if (!toastEl) return;
    toastEl.textContent = text || "";
    toastEl.className = "adm-toast " + type;
    toastEl.hidden = false;
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => { toastEl.hidden = true; }, ms);
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      toast("Скопійовано ✅", "ok", 1400);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = String(text || "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); toast("Скопійовано ✅", "ok", 1400); } catch {}
      document.body.removeChild(ta);
    }
  }

  // ---------- AUTH ----------
  async function doLogin() {
    const email = (emailInput?.value || "").trim();
    const password = (passInput?.value || "").trim();

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return alert(error.message);

    if (data?.user?.id) localStorage.setItem("sb_uid", data.user.id);
    if (data?.user?.email) localStorage.setItem("sb_email", data.user.email);

    await init();
  }

  async function doLogout() {
    try { await sb.auth.signOut(); } catch {}

    localStorage.removeItem("sb_uid");
    localStorage.removeItem("sb_email");
    localStorage.removeItem("user");

    ordersLoadedOnce = false;
    currentTab = "products";
    allOrdersCache = [];
    productsCache = [];
    selectedProductIds.clear();
    prodPage = 1;

    stopOrdersRealtime();

    await init();
  }

  loginBtn?.addEventListener("click", doLogin);
  logoutBtn?.addEventListener("click", doLogout);

  // ---------- CHECK ADMIN ----------
  async function checkAdmin() {
    const { data: uData, error: userErr } = await sb.auth.getUser();
    const user = uData?.user;
    if (userErr || !user) return false;

    const { data, error } = await sb
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return false;
    return !!data;
  }

  // ---------- TABS ----------
  function setActiveTab(which, opts = {}) {
    const { keep = false } = opts;
    if (!keep) currentTab = which;

    const isProducts = which === "products";

    tabProducts?.classList.toggle("is-active", isProducts);
    tabOrders?.classList.toggle("is-active", !isProducts);

    if (productsSection) productsSection.hidden = !isProducts;
    if (ordersSection) ordersSection.hidden = isProducts;

    if (!isProducts && !ordersLoadedOnce) {
      ordersLoadedOnce = true;
      loadOrders();
      startOrdersRealtime();
    }
    if (isProducts) {
      // stop realtime to reduce noise (optional)
      startOrdersRealtime(); // keep on anyway (new orders toast even on products)
    }
  }

  tabProducts?.addEventListener("click", () => setActiveTab("products"));
  tabOrders?.addEventListener("click", () => setActiveTab("orders"));

  // =========================
  // CATEGORIES
  // =========================
  async function loadCategories() {
    const { data, error } = await sb
      .from("categories")
      .select("id, slug, title, sort, is_active")
      .order("sort", { ascending: true })
      .order("title", { ascending: true });

    if (error) {
      console.error("loadCategories error:", error);
      categoriesCache = [];
      renderCategorySelectOptions();
      renderCategoryFilterOptions();
      return;
    }

    categoriesCache = (data || []).filter(c => c.is_active !== false);
    renderCategorySelectOptions();
    renderCategoryFilterOptions();
  }

  function renderCategorySelectOptions() {
    if (!admCategory) return;

    const opts = categoriesCache.length
      ? categoriesCache
          .map(c => `<option value="${escHtml(c.id)}">${escHtml(c.title || c.slug || "")}</option>`)
          .join("")
      : `<option value="" disabled>Немає категорій</option>`;

    admCategory.innerHTML = opts;
  }

  function renderCategoryFilterOptions() {
    if (!prodCategoryFilter) return;
    const cur = prodCategoryFilter.value || "all";
    prodCategoryFilter.innerHTML =
      `<option value="all">Всі</option>` +
      categoriesCache.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.title || c.slug || "")}</option>`).join("");
    prodCategoryFilter.value = cur;
  }

  function findCategoryById(id) {
    return categoriesCache.find(c => String(c.id) === String(id));
  }

  function findCategoryBySlug(slug) {
    return categoriesCache.find(c => String(c.slug) === String(slug));
  }

  // =========================
  // PRODUCTS
  // =========================
  async function loadProducts() {
    const { data, error } = await sb
      .from("products")
      .select(`
        id, title, price, stock, img, imgs, desc, is_popular, is_active, created_at, updated_at,
        category, category_id,
        categories:category_id ( id, slug, title )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Помилка завантаження товарів: " + (error.message || ""));
      return;
    }

    productsCache = data || [];
    prodPage = 1;
    selectedProductIds.clear();
    applyProductsFilter();
  }

  function getProductFilters() {
    return {
      q: (prodSearch?.value || "").trim().toLowerCase(),
      catId: (prodCategoryFilter?.value || "all"),
      active: (prodActiveFilter?.value || "all"),
      popular: (prodPopularFilter?.value || "all"),
      lowStockOn: !!prodLowStock?.checked,
      lowN: Math.max(0, safeInt(prodLowStockN?.value ?? 3)),
      sort: (prodSort?.value || "new"),
    };
  }

  function applyProductsFilter() {
    const f = getProductFilters();

    let rows = [...productsCache];

    // search (title or id)
    if (f.q) {
      rows = rows.filter(p => {
        const t = String(p?.title || "").toLowerCase();
        const id = String(p?.id || "").toLowerCase();
        return t.includes(f.q) || id.includes(f.q);
      });
    }

    // category
    if (f.catId && f.catId !== "all") {
      rows = rows.filter(p => String(p?.category_id || "") === String(f.catId));
    }

    // active
    if (f.active === "active") rows = rows.filter(p => p?.is_active !== false);
    if (f.active === "inactive") rows = rows.filter(p => p?.is_active === false);

    // popular
    if (f.popular === "popular") rows = rows.filter(p => p?.is_popular === true);
    if (f.popular === "not_popular") rows = rows.filter(p => p?.is_popular !== true);

    // low stock
    if (f.lowStockOn) {
      rows = rows.filter(p => safeInt(p?.stock) <= f.lowN);
    }

    // sorting
    const by = (fn) => rows.sort((a,b) => fn(a) - fn(b));
    switch (f.sort) {
      case "old":
        rows.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "price_asc":
        rows.sort((a,b) => safePrice(a.price) - safePrice(b.price));
        break;
      case "price_desc":
        rows.sort((a,b) => safePrice(b.price) - safePrice(a.price));
        break;
      case "stock_asc":
        rows.sort((a,b) => safeInt(a.stock) - safeInt(b.stock));
        break;
      case "stock_desc":
        rows.sort((a,b) => safeInt(b.stock) - safeInt(a.stock));
        break;
      case "title_asc":
        rows.sort((a,b) => String(a.title||"").localeCompare(String(b.title||""), "uk"));
        break;
      case "title_desc":
        rows.sort((a,b) => String(b.title||"").localeCompare(String(a.title||""), "uk"));
        break;
      default: // new
        rows.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    prodFiltered = rows;

    const pages = Math.max(1, Math.ceil(prodFiltered.length / PAGE_SIZE));
    if (prodPage > pages) prodPage = pages;
    if (prodPage < 1) prodPage = 1;

    if (prodPageEl) prodPageEl.textContent = String(prodPage);
    if (prodPagesEl) prodPagesEl.textContent = String(pages);

    const start = (prodPage - 1) * PAGE_SIZE;
    const slice = prodFiltered.slice(start, start + PAGE_SIZE);
    renderProducts(slice);

    updateProductToolbar();
  }

  function catTitleFor(p) {
    return p?.categories?.title || p?.category || "";
  }

  function stockPill(stock) {
    const st = safeInt(stock);
    const cls = st <= 0 ? "pill pill-red" : (st <= 3 ? "pill pill-orange" : "pill pill-green");
    return `<span class="${cls}" title="Залишок">${st}</span>`;
  }

  function renderProducts(items) {
    if (!grid) return;

    grid.innerHTML = items.map((p) => {
      const catTitle = catTitleFor(p);
      const st = safeInt(p?.stock);
      const active = p?.is_active !== false;
      const popular = p?.is_popular === true;

      const isSelected = selectedProductIds.has(String(p.id));

      return `
        <article class="product-card admin-card" data-pid="${escHtml(p.id)}">
          <div class="admin-card__select">
            <label class="adm-check">
              <input type="checkbox" data-select ${isSelected ? "checked" : ""}>
              <span></span>
            </label>
          </div>

          <div class="product-card__img">
            <img src="${escHtml(p.img || "")}" alt="">
          </div>

          <div class="product-card__body">
            <h3 title="${escHtml(p.title || "")}">${escHtml(p.title || "")}</h3>

            <div class="adm-meta">
              <div class="adm-price">${money(p.price)} грн</div>
              <div class="adm-stock">Stock: ${stockPill(st)}</div>
            </div>

            ${catTitle ? `<div class="muted" style="margin-top:6px">Категорія: ${escHtml(catTitle)}</div>` : ""}

            <div class="adm-quick">
              <button type="button" class="btn-mini ${active ? "is-on" : ""}" data-toggle="active" title="Активність">
                ${active ? "Active" : "Inactive"}
              </button>

              <button type="button" class="btn-mini ${popular ? "is-on" : ""}" data-toggle="popular" title="Popular">
                ${popular ? "Popular" : "No popular"}
              </button>

              <div class="adm-stock-edit" title="Швидко змінити stock">
                <button type="button" class="btn-mini" data-stock="minus">−</button>
                <input type="number" min="0" step="1" value="${st}" data-stock="input">
                <button type="button" class="btn-mini" data-stock="plus">+</button>
              </div>
            </div>

            <div class="admin-actions">
              <button type="button" data-edit="${escHtml(p.id)}" title="Редагувати">✏️</button>
              <button type="button" data-del="${escHtml(p.id)}" title="Видалити">🗑</button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    // one delegated handler for grid
  }

  function openAdminModal(product = null) {
    if (!modal) return;

    editingId = product?.id || null;
    selectedFile = null;
    existingImgUrl = product?.img || "";
    setErr("");

    if (admModalTitle) admModalTitle.textContent = editingId ? "Редагування товару" : "Додати товар";

    if (admTitle) admTitle.value = product?.title || "";
    if (admPrice) admPrice.value = product?.price ?? "";
    if (admStock) admStock.value = safeInt(product?.stock ?? 0);
    if (admDesc) admDesc.value = product?.desc || "";
    if (admImg) admImg.value = product?.img || "";
    if (admActive) admActive.checked = product?.is_active ?? true;
    if (admPopular) admPopular.checked = product?.is_popular ?? false;

    // category: prefer category_id, fallback to legacy product.category (slug)
    if (admCategory) {
      const pid = product?.category_id;
      const pSlug = product?.category;

      let target = null;
      if (pid) target = findCategoryById(pid);
      if (!target && pSlug) target = findCategoryBySlug(pSlug);

      if (target) {
        admCategory.value = target.id;
      } else {
        if (categoriesCache.length) admCategory.value = categoriesCache[0].id;
      }
    }

    
    // init gallery from product: prefer product.imgs, always ensure main is first
    clearGallery();
    const mainUrl = (product?.img || "").trim();
    const extra = parseImgsField(product?.imgs);
    const urls = uniqUrls([mainUrl, ...extra]);
    galleryItems = urls.map(u => ({ url: u, isNew: false }));
    renderGallery();

    // preview main
    const first = galleryItems[0]?.url || "";
    setPreview(first);
    if (admImg) admImg.value = first || "";
modal.setAttribute("aria-hidden", "false");
    modal.classList.add("open");

    // lock background if available (you already have helpers in store.js, but admin may not load it)
    try { window.lockBodyScroll?.(); } catch {}
  }

  function closeAdminModal() {
    if (!modal) return;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("open");
    editingId = null;
    selectedFile = null;
    existingImgUrl = "";
    setErr("");

    try { window.unlockBodyScroll?.(); } catch {}
  }

  modal?.addEventListener("click", (e) => {
    if (e.target?.dataset?.close) closeAdminModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAdminModal();
  });
  admCancel?.addEventListener("click", closeAdminModal);

  admImg?.addEventListener("input", () => {
    const url = (admImg.value || "").trim();
    if (!url) return;

    // manual URL => becomes main, and clears pending file for main
    selectedFile = null;

    // if url exists in gallery, move it to front; else unshift
    const idx = galleryItems.findIndex(it => String(it.url || "").trim() === url);
    if (idx >= 0) {
      setAsMain(idx);
    } else {
      galleryItems.unshift({ url, isNew: false });
      renderGallery();
      ensureMainFirst();
    }
  });

addBtn?.addEventListener("click", () => openAdminModal(null));

  // dropzone
  admPick?.addEventListener("click", () => admFile?.click());

  admFile?.addEventListener("change", () => {
    const f = admFile.files?.[0];
    if (!f) return;

    // main photo via file => put as first in gallery
    selectedFile = f;

    // remove existing temp main preview if any
    const tmpIdx = galleryItems.findIndex(it => it.__mainTmp);
    if (tmpIdx >= 0) removeFromGallery(tmpIdx);

    const objectUrl = URL.createObjectURL(f);
    galleryItems.unshift({ url: objectUrl, file: f, objectUrl, isNew: true, __mainTmp: true });
    renderGallery();
    setPreview(objectUrl);

    // clear URL field (поки фото не завантажено)
    if (admImg) admImg.value = "";
  });

["dragenter", "dragover"].forEach((ev) => {
    admDrop?.addEventListener(ev, (e) => {
      e.preventDefault();
      admDrop.classList.add("is-drag");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    admDrop?.addEventListener(ev, (e) => {
      e.preventDefault();
      admDrop.classList.remove("is-drag");
    });
  });

  admDrop?.addEventListener("drop", (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;

    selectedFile = f;

    if (admFile) {
      const dt = new DataTransfer();
      dt.items.add(f);
      admFile.files = dt.files;
    }

    // main photo => first in gallery
    const tmpIdx = galleryItems.findIndex(it => it.__mainTmp);
    if (tmpIdx >= 0) removeFromGallery(tmpIdx);

    const objectUrl = URL.createObjectURL(f);
    galleryItems.unshift({ url: objectUrl, file: f, objectUrl, isNew: true, __mainTmp: true });
    renderGallery();
    setPreview(objectUrl);
    if (admImg) admImg.value = "";
  });

// ===== MULTI-PHOTO GALLERY =====
  admPickMore?.addEventListener("click", () => admFilesMore?.click());

  admFilesMore?.addEventListener("change", () => {
    const files = admFilesMore.files;
    if (!files || !files.length) return;
    addFilesToGallery(files);
    // allow picking same file again later
    admFilesMore.value = "";
  });

  ["dragenter", "dragover"].forEach((ev) => {
    admDropMore?.addEventListener(ev, (e) => {
      e.preventDefault();
      admDropMore.classList.add("is-drag");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    admDropMore?.addEventListener(ev, (e) => {
      e.preventDefault();
      admDropMore.classList.remove("is-drag");
    });
  });

  admDropMore?.addEventListener("drop", (e) => {
    const files = e.dataTransfer?.files;
    if (!files || !files.length) return;
    addFilesToGallery(files);
  });

  admImgsList?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("[data-action]");
    if (!btn) return;
    const act = btn.dataset.action;
    const idx = btn.dataset.idx;
    if (act === "main") setAsMain(idx);
    if (act === "remove") removeFromGallery(idx);
  });
function extFromName(name = "") {
    const m = String(name).toLowerCase().match(/\.(png|jpg|jpeg|webp|gif)$/);
    return m ? m[1] : "jpg";
  }

  async function uploadToStorage(file, productId) {
    const ext = extFromName(file.name);
    const filePath = `${productId}_${Date.now()}.${ext}`;

    const { error: upErr } = await sb.storage.from(BUCKET).upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || undefined,
    });
    if (upErr) throw upErr;

    const { data } = sb.storage.from(BUCKET).getPublicUrl(filePath);
    const publicUrl = data?.publicUrl || "";
    if (!publicUrl) throw new Error("Не вдалося отримати public URL");

    return publicUrl;
  }

  async function deleteProduct(id) {
    if (!confirm("Видалити товар?")) return;

    const { error } = await sb.from("products").delete().eq("id", id);
    if (error) return alert(error.message);

    // keep cache fresh
    productsCache = productsCache.filter(p => String(p.id) !== String(id));
    selectedProductIds.delete(String(id));
    applyProductsFilter();
    toast("Товар видалено", "ok");
  }

  async function editProduct(id) {
    const { data, error } = await sb
      .from("products")
      .select(`id, title, price, stock, img, imgs, desc, is_popular, is_active, category, category_id`)
      .eq("id", id)
      .single();

    if (error) return alert(error.message);
    openAdminModal(data);
  }

  // save (modal)
  admSave?.addEventListener("click", async () => {
    if (!admTitle || !admPrice || !admCategory || !admDesc || !admImg) return;

    setErr("");

    const title = admTitle.value.trim();
    const price = safePrice(admPrice.value);
    const stock = admStock ? Math.max(0, safeInt(admStock.value)) : 0;
    const desc = admDesc.value.trim();
    const categoryId = (admCategory.value || "").trim();

    let img = (admImg.value || "").trim();

    if (!title) return setErr("Вкажи назву товару");
    if (!categoryId) return setErr("Вкажи категорію");

    if (!img && editingId && existingImgUrl) img = existingImgUrl;

    
    // ===== upload gallery files (main + extra) =====
    const productId = editingId || String(Date.now());

    // if user typed main URL but gallery is empty — init gallery from it
    if (!galleryItems.length && img) {
      galleryItems = [{ url: img, isNew: false }];
      renderGallery();
    }

    // upload in order, replacing object URLs with public URLs
    try {
      for (const it of galleryItems) {
        if (it?.file) {
          const publicUrl = await uploadToStorage(it.file, productId);
          revokeObjectUrl(it);
          it.url = publicUrl;
          it.file = null;
          it.isNew = false;
          if (it.__mainTmp) it.__mainTmp = false;
        }
      }
    } catch (e) {
      console.error(e);
      return setErr(`Upload error: ${e?.message || e}`);
    }

    // final urls
    const imgs = uniqUrls(galleryItems.map(it => it.url));
    const mainImg = imgs[0] || img || "";

    img = mainImg;
    if (!img) return setErr("Вкажи фото або URL картинки");
const cat = findCategoryById(categoryId);
    const catSlug = cat?.slug || null;

    const payload = {
      title,
      price,
      stock,
      desc,
      img,
      imgs: JSON.stringify(imgs || []),
      category_id: categoryId,
      ...(catSlug ? { category: catSlug } : {}),
      is_active: !!admActive?.checked,
      is_popular: !!admPopular?.checked,
      updated_at: new Date().toISOString(),
    };

    let res;
    if (editingId) {
      res = await sb.from("products").update(payload).eq("id", editingId).select("*").single();
    } else {
      const id = productId;
      res = await sb.from("products").insert([{ id, ...payload, created_at: new Date().toISOString() }]).select("*").single();
    }

    if (res.error) {
      console.error(res.error);
      return setErr(res.error.message || "Помилка збереження");
    }

    // sync cache
    const row = res.data;
    if (row) {
      const idx = productsCache.findIndex(p => String(p.id) === String(row.id));
      if (idx >= 0) productsCache[idx] = row;
      else productsCache.unshift(row);
    }

    closeAdminModal();
    applyProductsFilter();
    toast("Збережено ✅", "ok");
  });

  // ---------- quick actions (delegation) ----------
  grid?.addEventListener("click", async (e) => {
    const card = e.target.closest("[data-pid]");
    if (!card) return;
    const pid = card.dataset.pid;

    // edit/delete
    const editBtn = e.target.closest("[data-edit]");
    const delBtn = e.target.closest("[data-del]");
    if (editBtn) return editProduct(editBtn.dataset.edit);
    if (delBtn) return deleteProduct(delBtn.dataset.del);

    // select checkbox click (handled on change too, but keep safe)
    const sel = e.target.closest("[data-select]");
    if (sel) return;

    // toggle active/popular
    const tgl = e.target.closest("[data-toggle]");
    if (tgl) {
      const kind = tgl.dataset.toggle; // active|popular
      const p = productsCache.find(x => String(x.id) === String(pid));
      if (!p) return;

      const next = kind === "active" ? !(p.is_active !== false) : !(p.is_popular === true);

      tgl.disabled = true;
      try {
        const patch = kind === "active" ? { is_active: next } : { is_popular: next };
        patch.updated_at = new Date().toISOString();

        const { data, error } = await sb
          .from("products")
          .update(patch)
          .eq("id", pid)
          .select("*")
          .single();

        if (error) throw error;

        // update cache + UI
        const idx = productsCache.findIndex(x => String(x.id) === String(pid));
        if (idx >= 0) productsCache[idx] = { ...productsCache[idx], ...data };

        applyProductsFilter();
        toast("Оновлено ✅", "ok");
      } catch (err) {
        console.error(err);
        alert(err?.message || "Не вдалося оновити");
      } finally {
        tgl.disabled = false;
      }
      return;
    }

    // stock +/- and input
    const stBtn = e.target.closest("[data-stock]");
    if (stBtn) {
      const mode = stBtn.dataset.stock;
      const input = card.querySelector('input[data-stock="input"]');
      if (!input) return;

      let v = safeInt(input.value);
      if (mode === "plus") v += 1;
      if (mode === "minus") v = Math.max(0, v - 1);
      if (mode !== "input") {
        input.value = String(v);
        await saveStock(pid, v);
      }
      return;
    }
  });

  grid?.addEventListener("change", (e) => {
    const card = e.target.closest("[data-pid]");
    if (!card) return;
    const pid = card.dataset.pid;

    const sel = e.target.closest("[data-select]");
    if (sel) {
      if (sel.checked) selectedProductIds.add(String(pid));
      else selectedProductIds.delete(String(pid));
      updateProductToolbar();
      return;
    }

    const stockInput = e.target.closest('input[data-stock="input"]');
    if (stockInput) {
      const v = Math.max(0, safeInt(stockInput.value));
      stockInput.value = String(v);
      saveStock(pid, v);
    }
  });

  async function saveStock(pid, newStock) {
    const p = productsCache.find(x => String(x.id) === String(pid));
    if (!p) return;

    const prev = safeInt(p.stock);
    if (prev === newStock) return;

    try {
      const { data, error } = await sb
        .from("products")
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq("id", pid)
        .select("*")
        .single();

      if (error) throw error;

      const idx = productsCache.findIndex(x => String(x.id) === String(pid));
      if (idx >= 0) productsCache[idx] = { ...productsCache[idx], ...data };

      applyProductsFilter();
      toast("Stock оновлено", "ok", 1400);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Не вдалося оновити stock");
      // revert UI
      applyProductsFilter();
    }
  }

  // ---------- products filter listeners ----------
  function debounce(fn, ms = 250) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }
  const applyProductsFilterDeb = debounce(applyProductsFilter, 200);

  prodSearch?.addEventListener("input", applyProductsFilterDeb);
  prodCategoryFilter?.addEventListener("change", () => { prodPage = 1; applyProductsFilter(); });
  prodActiveFilter?.addEventListener("change", () => { prodPage = 1; applyProductsFilter(); });
  prodPopularFilter?.addEventListener("change", () => { prodPage = 1; applyProductsFilter(); });
  prodLowStock?.addEventListener("change", () => { prodPage = 1; applyProductsFilter(); });
  prodLowStockN?.addEventListener("input", applyProductsFilterDeb);
  prodSort?.addEventListener("change", () => { prodPage = 1; applyProductsFilter(); });

  prodPrev?.addEventListener("click", () => { prodPage = Math.max(1, prodPage - 1); applyProductsFilter(); });
  prodNext?.addEventListener("click", () => {
    const pages = Math.max(1, Math.ceil(prodFiltered.length / PAGE_SIZE));
    prodPage = Math.min(pages, prodPage + 1);
    applyProductsFilter();
  });

  // ---------- product toolbar / bulk ----------
  function updateProductToolbar() {
    if (!prodToolbar || !prodSelectedCount || !prodSelectAll) return;

    const visibleIds = new Set(prodFiltered.slice((prodPage-1)*PAGE_SIZE, (prodPage-1)*PAGE_SIZE + PAGE_SIZE).map(p => String(p.id)));
    const selectedVisible = [...selectedProductIds].filter(id => visibleIds.has(String(id)));

    const count = selectedProductIds.size;
    prodSelectedCount.textContent = String(count);

    prodToolbar.hidden = count === 0;

    // select all on current page
    prodSelectAll.checked = selectedVisible.length > 0 && selectedVisible.length === visibleIds.size;
    prodSelectAll.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visibleIds.size;
  }

  prodSelectAll?.addEventListener("change", () => {
    const ids = prodFiltered
      .slice((prodPage-1)*PAGE_SIZE, (prodPage-1)*PAGE_SIZE + PAGE_SIZE)
      .map(p => String(p.id));

    if (prodSelectAll.checked) ids.forEach(id => selectedProductIds.add(id));
    else ids.forEach(id => selectedProductIds.delete(id));

    applyProductsFilter(); // rerender checks
  });

  async function bulkUpdate(patch) {
    const ids = [...selectedProductIds];
    if (!ids.length) return;

    // optimistic UI
    ids.forEach(id => {
      const idx = productsCache.findIndex(p => String(p.id) === String(id));
      if (idx >= 0) productsCache[idx] = { ...productsCache[idx], ...patch };
    });
    applyProductsFilter();

    try {
      const { error } = await sb
        .from("products")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .in("id", ids);

      if (error) throw error;

      toast("Bulk оновлено ✅", "ok");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Bulk update error");
      await loadProducts();
    }
  }

  bulkActivate?.addEventListener("click", () => bulkUpdate({ is_active: true }));
  bulkDeactivate?.addEventListener("click", () => bulkUpdate({ is_active: false }));
  bulkPopular?.addEventListener("click", () => bulkUpdate({ is_popular: true }));
  bulkUnpopular?.addEventListener("click", () => bulkUpdate({ is_popular: false }));

  bulkDelete?.addEventListener("click", async () => {
    const ids = [...selectedProductIds];
    if (!ids.length) return;
    if (!confirm(`Видалити ${ids.length} товар(ів)?`)) return;

    // optimistic
    productsCache = productsCache.filter(p => !selectedProductIds.has(String(p.id)));
    selectedProductIds.clear();
    applyProductsFilter();

    try {
      const { error } = await sb.from("products").delete().in("id", ids);
      if (error) throw error;
      toast("Видалено ✅", "ok");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Bulk delete error");
      await loadProducts();
    }
  });

  // =========================
  // ORDERS
  // =========================
  function getOrdersFilters() {
    return {
      status: orderStatusFilter?.value || "all",
      q: (orderSearch?.value || "").trim().toLowerCase(),
    };
  }

  function applyOrdersFilter() {
    if (!ordersGrid) return;

    const f = getOrdersFilters();

    let filtered = [...allOrdersCache];

    if (f.status !== "all") filtered = filtered.filter(o => String(o.status || "new") === f.status);

    if (f.q) {
      filtered = filtered.filter(o => {
        const bag = [
          o.id,
          o.receiver_name,
          o.receiver_phone,
          o.receiver_city,
          o.receiver_post_office,
        ].map(x => String(x || "").toLowerCase()).join(" ");
        return bag.includes(f.q);
      });
    }

    if (!filtered.length) {
      ordersGrid.innerHTML = `<p class="muted">Немає замовлень під фільтр</p>`;
      return;
    }

    renderOrders(filtered);
  }

  orderStatusFilter?.addEventListener("change", applyOrdersFilter);
  orderSearch?.addEventListener("input", debounce(applyOrdersFilter, 200));
  ordersRefresh?.addEventListener("click", () => loadOrders());
  ordersExport?.addEventListener("click", () => exportOrdersCsv());

  async function loadOrders() {
    if (!ordersGrid) return;

    ordersGrid.innerHTML = `<p class="muted">Завантаження...</p>`;

    const { data, error } = await sb
      .from("orders")
      .select(`
        id,
        created_at,
        total,
        status,
        receiver_name,
        receiver_phone,
        receiver_city,
        receiver_post_office,
        receiver_comment,
        updated_at,
        order_items (
          id,
          product_id,
          title,
          img,
          price,
          qty,
          sum
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      ordersGrid.innerHTML = `<p class="muted" style="color:#c00">Помилка: ${escHtml(error.message || "")}</p>`;
      return;
    }

    allOrdersCache = data || [];

    if (!allOrdersCache.length) {
      ordersGrid.innerHTML = `<p class="muted">Немає замовлень.</p>`;
      return;
    }

    applyOrdersFilter();
  }

  function renderOrders(rows) {
    if (!ordersGrid) return;

    ordersGrid.innerHTML = rows.map((o) => {
      const items = Array.isArray(o.order_items) ? o.order_items : [];
      const currentStatus = String(o.status || "new");
      const badge = `<span class="oa-badge ${statusClass(currentStatus)}">${escHtml(statusLabel(currentStatus))}</span>`;

      const itemsHtml = items.map((it) => `
        <div class="oa-item">
          <div class="oa-item__img">
            ${it.img ? `<img src="${escHtml(it.img)}" alt="">` : ""}
          </div>

          <div class="oa-item__body">
            <div class="oa-item__title">
              ${escHtml(it.title || "")}
              <span class="oa-item__code">Код: ${escHtml(it.product_id || "-")}</span>
            </div>
            <div class="oa-item__sub">qty: ${escHtml(it.qty)} • ${money(it.price)} грн</div>
          </div>

          <div class="oa-item__sum">${money(it.sum)} грн</div>
        </div>
      `).join("");

      return `
        <article class="oa-card" data-order-id="${escHtml(o.id)}">
          <div class="oa-head">
            <div>
              <div class="oa-id">
                Замовлення: <span class="oa-id__mono">${escHtml(o.id)}</span>
                <button class="btn-mini" type="button" data-copy="oid" title="Копіювати ID">⧉</button>
              </div>
              <div class="oa-meta">${fmtDate(o.created_at)} • <strong>${money(o.total)} грн</strong> • ${badge}</div>
            </div>

            <div class="oa-status">
              <label>Статус</label>
              <select class="oa-status__select" data-order-status>
                ${["new", "processing", "ready", "done", "cancelled"].map((s) =>
                  `<option value="${s}" ${currentStatus === s ? "selected" : ""}>${statusLabel(s)}</option>`
                ).join("")}
              </select>
            </div>
          </div>

          <div class="oa-rec">
            <div class="oa-rec__row">
              <div><strong>${escHtml(o.receiver_name || "")}</strong> • <span class="oa-phone">${escHtml(o.receiver_phone || "")}</span></div>
              <div class="oa-rec__actions">
                <button class="btn-mini" type="button" data-copy="phone" title="Копіювати телефон">⧉ телефон</button>
              </div>
            </div>
            <div>${escHtml(o.receiver_city || "")} • ${escHtml(o.receiver_post_office || "")}</div>
            ${o.receiver_comment ? `<div>Коментар: ${escHtml(o.receiver_comment)}</div>` : ""}
          </div>

          <div class="oa-items">
            ${itemsHtml || `<p class="muted">Немає позицій у замовленні</p>`}
          </div>
        </article>
      `;
    }).join("");

    ordersGrid.querySelectorAll("[data-order-status]").forEach((sel) => {
      sel.addEventListener("change", onOrderStatusChange);
    });

    ordersGrid.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const card = e.target.closest("[data-order-id]");
        const oid = card?.dataset?.orderId || "";
        const kind = e.target.dataset.copy;
        if (kind === "oid") copyToClipboard(oid);
        if (kind === "phone") {
          const phone = card?.querySelector(".oa-phone")?.textContent || "";
          copyToClipboard(phone);
        }
      });
    });
  }

  async function onOrderStatusChange(e) {
    const select = e.target;
    const card = select.closest("[data-order-id]");
    const orderId = card?.dataset?.orderId;
    const newStatus = select.value;

    if (!orderId) return;

    const o = allOrdersCache.find(x => x.id === orderId);
    const prevStatus = String(o?.status || "new");

    select.disabled = true;

    try {
      const { error } = await sb
        .from("orders")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (error) throw error;

      if (o) o.status = newStatus;

      // deduct stock ONLY when переход: not done -> done
      if (prevStatus !== "done" && newStatus === "done") {
        await deductStockForOrder(orderId);
        await loadProducts(); // refresh
      }

      applyOrdersFilter();
      toast("Статус оновлено ✅", "ok", 1400);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Не вдалося оновити статус");
      await loadOrders();
    } finally {
      select.disabled = false;
    }
  }

  async function deductStockForOrder(orderId) {
    const order = allOrdersCache.find(x => x.id === orderId);
    const items = Array.isArray(order?.order_items) ? order.order_items : [];
    if (!items.length) return;

    // naive safe approach: read each product stock then update
    for (const it of items) {
      const pid = String(it.product_id || "");
      const qty = Math.max(0, safeInt(it.qty));
      if (!pid || qty <= 0) continue;

      try {
        const { data: pRow, error: gErr } = await sb
          .from("products")
          .select("id, stock")
          .eq("id", pid)
          .maybeSingle();

        if (gErr) throw gErr;
        if (!pRow) continue;

        const cur = Math.max(0, safeInt(pRow.stock));
        const next = Math.max(0, cur - qty);

        const { error: uErr } = await sb
          .from("products")
          .update({ stock: next, updated_at: new Date().toISOString() })
          .eq("id", pid);

        if (uErr) throw uErr;
      } catch (e) {
        console.error("deductStockForOrder error:", e);
        // don't block the whole order
      }
    }
  }

  function exportOrdersCsv() {
    const f = getOrdersFilters();
    let rows = [...allOrdersCache];

    if (f.status !== "all") rows = rows.filter(o => String(o.status || "new") === f.status);

    if (f.q) {
      rows = rows.filter(o => {
        const bag = [
          o.id,
          o.receiver_name,
          o.receiver_phone,
          o.receiver_city,
          o.receiver_post_office,
        ].map(x => String(x || "").toLowerCase()).join(" ");
        return bag.includes(f.q);
      });
    }

    if (!rows.length) return toast("Немає замовлень для експорту", "info");

    const lines = [];
    const head = [
      "order_id",
      "created_at",
      "status",
      "total",
      "receiver_name",
      "receiver_phone",
      "receiver_city",
      "receiver_post_office",
      "receiver_comment",
      "items_count"
    ];
    lines.push(head.join(","));

    const csvEsc = (v) => {
      const s = String(v ?? "");
      const must = /[",\n]/.test(s);
      const q = s.replace(/"/g, '""');
      return must ? `"${q}"` : q;
    };

    rows.forEach(o => {
      const itemsCount = Array.isArray(o.order_items) ? o.order_items.length : 0;
      const line = [
        o.id,
        o.created_at,
        o.status,
        o.total,
        o.receiver_name,
        o.receiver_phone,
        o.receiver_city,
        o.receiver_post_office,
        o.receiver_comment,
        itemsCount
      ].map(csvEsc).join(",");
      lines.push(line);
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast("CSV згенеровано ✅", "ok");
  }

  // =========================
  // REALTIME (orders)
  // =========================
  function startOrdersRealtime() {
    if (!sb?.channel) return;
    if (ordersChannel) return;

    ordersChannel = sb
      .channel("admin-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, async (payload) => {
        const row = payload?.new;
        if (!row?.id) return;

        // fetch full order with items
        const { data } = await sb
          .from("orders")
          .select(`
            id, created_at, total, status, receiver_name, receiver_phone, receiver_city,
            receiver_post_office, receiver_comment, updated_at,
            order_items ( id, product_id, title, img, price, qty, sum )
          `)
          .eq("id", row.id)
          .maybeSingle();

        if (!data) return;

        // avoid dup
        const exists = allOrdersCache.some(o => o.id === data.id);
        if (!exists) {
          allOrdersCache.unshift(data);
          toast("Нове замовлення 🚀", "ok", 3000);
          applyOrdersFilter();
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        const row = payload?.new;
        if (!row?.id) return;
        const idx = allOrdersCache.findIndex(o => o.id === row.id);
        if (idx >= 0) {
          allOrdersCache[idx] = { ...allOrdersCache[idx], ...row };
          applyOrdersFilter();
        }
      })
      .subscribe((status) => {
        // console.log("orders realtime:", status);
      });
  }

  function stopOrdersRealtime() {
    try {
      if (ordersChannel) sb.removeChannel(ordersChannel);
    } catch {}
    ordersChannel = null;
  }

  // =========================
  // INIT
  // =========================
  async function init() {
    if (!sb) {
      alert("Supabase client не підключений. Перевір порядок підключення скриптів.");
      return;
    }

    const { data: uData } = await sb.auth.getUser();
    const user = uData?.user;

    if (!user) {
      show(authBox);
      hide(appBox);
      stopOrdersRealtime();
      return;
    }

    const isAdmin = await checkAdmin();
    if (!isAdmin) {
      show(authBox);
      hide(appBox);
      stopOrdersRealtime();
      if (authBox) authBox.innerHTML = "<h3>Немає доступу</h3>";
      return;
    }

    hide(authBox);
    show(appBox);

    await loadCategories();
    setActiveTab(currentTab, { keep: true });

    await loadProducts();

    if (currentTab === "orders" && !ordersLoadedOnce) {
      ordersLoadedOnce = true;
      await loadOrders();
    }

    startOrdersRealtime();
  }

  sb?.auth?.onAuthStateChange?.(() => { init(); });
  init();
})();