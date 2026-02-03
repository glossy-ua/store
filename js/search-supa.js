// js/search-supa.js
(function () {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  const meta = document.getElementById("searchMeta");

  const params = new URLSearchParams(window.location.search);
  const qRaw = (params.get("q") || "").trim();

  function show(msg) {
    grid.innerHTML = `<p class="muted" style="padding:12px 0;">${msg}</p>`;
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function money(v) {
    const n = parseFloat(String(v).replace(",", ".").replace(/[^\d.]/g, "")) || 0;
    return n.toFixed(2);
  }

  // ✅ такие же ключи/URL как в catalog-supa.js
  const SUPABASE_URL = "https://fxaleremdkamkimuyoai.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4YWxlcmVtZGthbWtpbXV5b2FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTM1MTUsImV4cCI6MjA4NTM4OTUxNX0.3oJ0LCLdsD8PnewKyITY_EseY0KK9uyvdNXiqk3fIxE";

  if (!window.supabase?.createClient) {
    show("❌ Supabase SDK не підключився (cdn).");
    console.error("Нет window.supabase.createClient");
    return;
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function render(items) {
    if (!items.length) {
      show(`ℹ️ Нічого не знайдено за запитом: <b>${esc(qRaw)}</b>`);
      if (meta) meta.textContent = "";
      return;
    }

    if (meta) meta.textContent = `Знайдено: ${items.length}`;

    grid.innerHTML = items.map(p => `
      <article class="product-card"
        data-code="${esc(p.id)}"
        data-title="${esc(p.title)}"
        data-price="${esc(p.price)}"
        data-img="${esc(p.img)}"
        data-desc="${esc(p.desc || '')}"
      >
        <button class="fav-btn" type="button" title="В обране">♡</button>

        <div class="product-card__img">
          <img src="${esc(p.img)}" alt="${esc(p.title)}">
        </div>

        <div class="product-card__body">
          <h3 class="product-card__title">${esc(p.title)}</h3>
          <p class="product-card__code">Код товара: <span>${esc(p.id)}</span></p>

          <div class="product-card__bottom">
            <div class="product-card__price">${money(p.price)} грн.</div>

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
    `).join("");

    if (typeof updateFavBadge === "function") updateFavBadge();
    if (typeof updateCartBadge === "function") updateCartBadge();
  }

  async function load() {
    if (!qRaw) {
      show("ℹ️ Введи запит у пошук (наприклад: мікрофібра).");
      if (meta) meta.textContent = "";
      return;
    }

    show("Завантаження...");
    if (meta) meta.innerHTML = `Запит: <b>${esc(qRaw)}</b>`;

    // ВАЖНО: экранируем % и , для .or строки, чтобы не сломать синтаксис
    const q = qRaw.replace(/[%]/g, "\\%").replace(/,/g, "\\,");

    const { data, error } = await sb
      .from("products")
      .select("id,title,price,img,desc,is_active,created_at")
      .eq("is_active", true)
      .or(`title.ilike.%${q}%,desc.ilike.%${q}%`)
      .order("created_at", { ascending: false });

    if (error) {
      show("❌ Помилка Supabase. Дивись Console.");
      console.error("[search-supa] Supabase error:", error);
      return;
    }

    render(data || []);
  }

  load();
})();
