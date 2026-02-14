// js/db.js
(function () {
  // берём общий конфиг, если он уже есть
  const SUPABASE_URL =
    window.SUPABASE_URL || "https://fxaleremdkamkimuyoai.supabase.co";
  const SUPABASE_ANON_KEY =
    window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4YWxlcmVtZGthbWtpbXV5b2FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTM1MTUsImV4cCI6MjA4NTM4OTUxNX0.3oJ0LCLdsD8PnewKyITY_EseY0KK9uyvdNXiqk3fIxE";

  // заодно пробрасываем на window (чтоб было единообразно)
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

  async function fetchProducts(params = {}) {
    const {
      select = "id,title,price,img,imgs,desc,category,is_popular,created_at",
      limit = 100,
      category = null,
      popular = null
    } = params;

    const q = new URLSearchParams();
    q.set("select", select);
    q.set("limit", String(limit));
    q.set("order", "created_at.desc.nullslast");

    if (category) q.set("category", `eq.${category}`);
    if (popular === true) q.set("is_popular", "eq.true");
    q.set("is_active", "eq.true");

    const url = `${SUPABASE_URL}/rest/v1/products?${q.toString()}`;

    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      }
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`fetchProducts failed: ${res.status} ${text}`);
    }

    return await res.json();
  }

  // важно: чтобы home-popular.js видел функцию
  window.fetchProducts = fetchProducts;
})();
