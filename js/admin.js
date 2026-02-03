// js/admin.js
// Admin panel: Products + Orders
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

  // ---------- DOM (products) ----------
  const addBtn = document.getElementById("addProductBtn");
  const grid = document.getElementById("productsGrid");

  const modal = document.getElementById("productModal");
  const admTitle = document.getElementById("admTitle");
  const admPrice = document.getElementById("admPrice");
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

  // ---------- DOM (orders) ----------
  const ordersGrid = document.getElementById("ordersGrid");
  const orderStatusFilter = document.getElementById("orderStatusFilter");

  // ---------- STATE ----------
  let editingId = null;
  let selectedFile = null;
  let existingImgUrl = "";
  let ordersLoadedOnce = false;
  let currentTab = "products";

  let allOrdersCache = [];

  // categories cache
  let categoriesCache = []; // [{id, slug, title, sort, is_active}]

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

  function setPreview(url) {
    if (pmImg) pmImg.src = url || "";
  }

  function previewFromFile(file) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
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
    }
  }

  tabProducts?.addEventListener("click", () => setActiveTab("products"));
  tabOrders?.addEventListener("click", () => setActiveTab("orders"));

  // =========================
  // CATEGORIES
  // =========================
  async function loadCategories() {
    // грузим только активные, сортируем sort затем title
    const { data, error } = await sb
      .from("categories")
      .select("id, slug, title, sort, is_active")
      .order("sort", { ascending: true })
      .order("title", { ascending: true });

    if (error) {
      console.error("loadCategories error:", error);
      categoriesCache = [];
      // не блокируем админку полностью, но покажем ошибку в модалке при открытии
      return;
    }

    categoriesCache = (data || []).filter(c => c.is_active !== false);
    renderCategorySelectOptions();
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
        id, title, price, img, desc, is_popular, is_active, created_at, updated_at,
        category, category_id,
        categories:category_id ( id, slug, title )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Помилка завантаження товарів: " + (error.message || ""));
      return;
    }

    renderProducts(data || []);
  }

  function renderProducts(items) {
    if (!grid) return;

    grid.innerHTML = items.map((p) => {
      const catTitle = p?.categories?.title || p?.category || "";
      return `
        <article class="product-card">
          <div class="product-card__img">
            <img src="${escHtml(p.img || "")}" alt="">
          </div>
          <div class="product-card__body">
            <h3>${escHtml(p.title)}</h3>
            <div>${escHtml(p.price)} грн</div>
            ${catTitle ? `<div class="muted" style="margin-top:6px">Категорія: ${escHtml(catTitle)}</div>` : ""}

            <div class="admin-actions">
              <button type="button" data-edit="${escHtml(p.id)}">✏️</button>
              <button type="button" data-del="${escHtml(p.id)}">🗑</button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    grid.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", () => editProduct(btn.dataset.edit));
    });
    grid.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", () => deleteProduct(btn.dataset.del));
    });
  }

  function openAdminModal(product = null) {
    if (!modal) return;

    editingId = product?.id || null;
    selectedFile = null;
    existingImgUrl = product?.img || "";
    setErr("");

    if (admTitle) admTitle.value = product?.title || "";
    if (admPrice) admPrice.value = product?.price ?? "";
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
        // если не нашли — выберем первую доступную
        if (categoriesCache.length) admCategory.value = categoriesCache[0].id;
      }
    }

    setPreview((admImg?.value || "").trim());

    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("open");
  }

  function closeAdminModal() {
    if (!modal) return;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("open");
    editingId = null;
    selectedFile = null;
    existingImgUrl = "";
    setErr("");
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
    if (url) {
      selectedFile = null;
      setPreview(url);
    }
  });

  addBtn?.addEventListener("click", () => openAdminModal(null));

  // dropzone
  admPick?.addEventListener("click", () => admFile?.click());

  admFile?.addEventListener("change", () => {
    const f = admFile.files?.[0];
    if (!f) return;
    selectedFile = f;
    previewFromFile(f);
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

    previewFromFile(f);
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

    loadProducts();
  }

  async function editProduct(id) {
    const { data, error } = await sb
      .from("products")
      .select(`
        id, title, price, img, desc, is_popular, is_active, category, category_id
      `)
      .eq("id", id)
      .single();

    if (error) return alert(error.message);
    openAdminModal(data);
  }

  window.deleteProduct = deleteProduct;
  window.editProduct = editProduct;

  admSave?.addEventListener("click", async () => {
    if (!admTitle || !admPrice || !admCategory || !admDesc || !admImg) return;

    setErr("");

    const title = admTitle.value.trim();
    const price = safePrice(admPrice.value);
    const desc = admDesc.value.trim();
    const categoryId = (admCategory.value || "").trim();

    let img = (admImg.value || "").trim();

    if (!title) return setErr("Вкажи назву товару");
    if (!categoryId) return setErr("Вкажи категорію");

    if (!img && editingId && existingImgUrl) img = existingImgUrl;

    try {
      if (selectedFile) {
        const pid = editingId || String(Date.now());
        img = await uploadToStorage(selectedFile, pid);
        admImg.value = img;
      }
    } catch (e) {
      console.error(e);
      return setErr(`Upload error: ${e?.message || e}`);
    }

    if (!img) return setErr("Вкажи фото або URL картинки");

    const cat = findCategoryById(categoryId);
    const catSlug = cat?.slug || null; // для legacy поля category (text)

    const payload = {
      title,
      price,
      desc,
      img,
      category_id: categoryId,
      // ✅ временно поддержим старое поле category=text (если оно есть в таблице)
      // чтобы старые страницы каталога не сломались
      ...(catSlug ? { category: catSlug } : {}),
      is_active: !!admActive?.checked,
      is_popular: !!admPopular?.checked,
      updated_at: new Date().toISOString(),
    };

    let res;
    if (editingId) {
      res = await sb.from("products").update(payload).eq("id", editingId);
    } else {
      const id = String(Date.now());
      res = await sb.from("products").insert([
        { id, ...payload, created_at: new Date().toISOString() }
      ]);
    }

    if (res.error) {
      console.error(res.error);
      return setErr(res.error.message || "Помилка збереження");
    }

    closeAdminModal();
    loadProducts();
  });

  // =========================
  // ORDERS
  // =========================
  function applyOrdersFilter() {
    if (!ordersGrid) return;

    const status = orderStatusFilter?.value || "all";

    let filtered = allOrdersCache;
    if (status !== "all") {
      filtered = allOrdersCache.filter(o => String(o.status || "new") === status);
    }

    if (!filtered.length) {
      ordersGrid.innerHTML = `<p class="muted">Немає замовлень з таким статусом</p>`;
      return;
    }

    renderOrders(filtered);
  }

  orderStatusFilter?.addEventListener("change", applyOrdersFilter);

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
              <div class="oa-id">Замовлення: ${escHtml(o.id)}</div>
              <div class="oa-meta">${fmtDate(o.created_at)} • <strong>${money(o.total)} грн</strong></div>
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
            <div><strong>${escHtml(o.receiver_name || "")}</strong> • ${escHtml(o.receiver_phone || "")}</div>
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
  }

  async function onOrderStatusChange(e) {
    const select = e.target;
    const card = select.closest("[data-order-id]");
    const orderId = card?.dataset?.orderId;
    const newStatus = select.value;

    if (!orderId) return;

    select.disabled = true;

    try {
      const { error } = await sb
        .from("orders")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (error) throw error;

      // обновим кеш + перерисуем по фильтру
      const o = allOrdersCache.find(x => x.id === orderId);
      if (o) o.status = newStatus;
      applyOrdersFilter();

    } catch (err) {
      console.error(err);
      alert(err?.message || "Не вдалося оновити статус");
      await loadOrders();
    } finally {
      select.disabled = false;
    }
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
      return;
    }

    const isAdmin = await checkAdmin();
    if (!isAdmin) {
      show(authBox);
      hide(appBox);
      if (authBox) authBox.innerHTML = "<h3>Немає доступу</h3>";
      return;
    }

    hide(authBox);
    show(appBox);

    // categories first (for select)
    await loadCategories();

    // restore active tab
    setActiveTab(currentTab, { keep: true });

    // products always
    await loadProducts();

    // orders only if tab open (or already loaded)
    if (currentTab === "orders" && !ordersLoadedOnce) {
      ordersLoadedOnce = true;
      await loadOrders();
    }
  }

  sb?.auth?.onAuthStateChange?.(() => { init(); });

  init();
})();
