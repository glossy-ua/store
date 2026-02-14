// js/catalog-supa.js
(function () {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  const main = document.querySelector("main[data-category]");
  const category = main?.dataset?.category;

  function show(msg) {
    grid.innerHTML = `<p class="muted" style="padding:12px 0;">${msg}</p>`;
  }

  if (!category) {
    show('❌ Немає data-category у <main>. Приклад: <main data-category="microfiber">');
    return;
  }

  const SUPABASE_URL = "https://fxaleremdkamkimuyoai.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4YWxlcmVtZGthbWtpbXV5b2FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTM1MTUsImV4cCI6MjA4NTM4OTUxNX0.3oJ0LCLdsD8PnewKyITY_EseY0KK9uyvdNXiqk3fIxE";

  if (!SUPABASE_ANON_KEY) {
    show("❌ Не вставлен SUPABASE_ANON_KEY в catalog-supa.js");
    console.error("SUPABASE_ANON_KEY не вставлен");
    return;
  }

  if (!window.supabase?.createClient) {
    show("❌ Supabase SDK не підключився (cdn).");
    console.error("Нет window.supabase.createClient");
    return;
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

  function render(items) {
    if (!items.length) {
      show(`ℹ️ Товари не знайдено. category="${esc(category)}" (is_active=true)`);
      return;
    }

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

    try { window.updateFavBadge?.(); } catch {}
    try { window.updateCartBadge?.(); } catch {}
  }

  async function load() {
    show("Завантаження...");

    const { data, error } = await sb
      .from("products")
      .select("id,title,price,img,desc,category,is_active,created_at")
      .eq("is_active", true)
      .eq("category", category)
      .order("created_at", { ascending: false });

    if (error) {
      show("❌ Помилка Supabase. Дивись Console.");
      console.error("[catalog-supa] Supabase error:", error);
      return;
    }

    render(data || []);
  }

  load();
})();
