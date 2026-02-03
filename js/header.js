function getUserSafe() {
  const uid = localStorage.getItem("sb_uid");
  if (!uid) return null;          // если нет uid — считаем, что не залогинен
  try { return JSON.parse(localStorage.getItem('user') || 'null'); }
  catch { return null; }
}


function updateAccountLink() {
  const a = document.getElementById('accountLink');
  if (!a) return;

  const user = getUserSafe();
  a.href = user ? '/profile.html' : '/auth.html';
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof updateFavBadge === 'function') updateFavBadge();
  if (typeof updateCartBadge === 'function') updateCartBadge();
  updateAccountLink();

  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const suggestBox = document.getElementById('searchSuggest');

  // --- сабмит поиска ---
  if (searchForm && searchInput) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = searchInput.value.trim();
      if (q) window.location.href = `/search.html?q=${encodeURIComponent(q)}`;
    });

    // автоподстановка q в инпут
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) searchInput.value = q;
  }

  // --- SUGGEST (подсказки) ---
  const SUPABASE_URL = "https://fxaleremdkamkimuyoai.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4YWxlcmVtZGthbWtpbXV5b2FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTM1MTUsImV4cCI6MjA4NTM4OTUxNX0.3oJ0LCLdsD8PnewKyITY_EseY0KK9uyvdNXiqk3fIxE";

  let suggestTimer = null;
  let activeIndex = -1;
  let lastQuery = "";
  let lastItems = [];

  function escHtml(s){
    return String(s ?? "")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }

  function money(v){
    const n = parseFloat(String(v).replace(",", ".").replace(/[^\d.]/g, "")) || 0;
    return n.toFixed(2);
  }

  function hideSuggest(){
    if (!suggestBox) return;
    suggestBox.hidden = true;
    suggestBox.innerHTML = "";
    activeIndex = -1;
    lastItems = [];
  }

  function showSuggest(items){
    if (!suggestBox) return;
    if (!items.length){ hideSuggest(); return; }

    suggestBox.innerHTML = items.map((p, i) => `
      <div class="search-suggest__item" data-i="${i}">
        <img class="search-suggest__img" src="${escHtml(p.img)}" alt="">
        <div>
          <div class="search-suggest__title">${escHtml(p.title)}</div>
          <div class="search-suggest__price">${money(p.price)} грн.</div>
        </div>
      </div>
    `).join("");

    suggestBox.hidden = false;
  }

  

  async function fetchSuggest(q){
    if (!q || q.length < 2) return [];
    const safe = q.replace(/%/g, "\\%").replace(/,/g, "\\,");

    const url =
      `${SUPABASE_URL}/rest/v1/products` +
      `?select=id,title,price,img,created_at` +
      `&is_active=eq.true` +
      `&or=(title.ilike.*${encodeURIComponent(safe)}*,desc.ilike.*${encodeURIComponent(safe)}*)` +
      `&order=created_at.desc.nullslast` +
      `&limit=6`;

    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    if (!res.ok) return [];
    return await res.json();
  }

  function setActive(idx){
    if (!suggestBox) return;
    const items = [...suggestBox.querySelectorAll('.search-suggest__item')];
    items.forEach(el => el.classList.remove('is-active'));
    if (idx >= 0 && idx < items.length){
      items[idx].classList.add('is-active');
      activeIndex = idx;
    } else {
      activeIndex = -1;
    }
  }

  if (suggestBox){
    suggestBox.addEventListener('mousedown', (e) => {
      const item = e.target.closest('.search-suggest__item');
      if (!item) return;
      const i = Number(item.dataset.i);
      const p = lastItems[i];
      if (!p) return;
      window.location.href = `/search.html?q=${encodeURIComponent(p.title)}`;
    });
  }

  if (searchInput){
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim();
      lastQuery = q;

      if (suggestTimer) clearTimeout(suggestTimer);

      if (!q || q.length < 2){
        hideSuggest();
        return;
      }

      suggestTimer = setTimeout(async () => {
        const qNow = lastQuery;
        const items = await fetchSuggest(qNow);
        if (qNow !== lastQuery) return;

        lastItems = items || [];
        showSuggest(lastItems);
        setActive(-1);
      }, 220);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (!suggestBox || suggestBox.hidden) return;
      const max = lastItems.length - 1;

      if (e.key === 'ArrowDown'){
        e.preventDefault();
        setActive(Math.min(max, activeIndex + 1));
      } else if (e.key === 'ArrowUp'){
        e.preventDefault();
        setActive(Math.max(-1, activeIndex - 1));
      } else if (e.key === 'Enter'){
        if (activeIndex >= 0 && lastItems[activeIndex]){
          e.preventDefault();
          const p = lastItems[activeIndex];
          window.location.href = `/search.html?q=${encodeURIComponent(p.title)}`;
        }
      } else if (e.key === 'Escape'){
        hideSuggest();
      }
    });

    document.addEventListener('click', (e) => {
      const inside = e.target.closest('#searchForm');
      if (!inside) hideSuggest();
    });
  }
});

window.addEventListener('storage', (e) => {
  if (e.key === 'favorites' && typeof updateFavBadge === 'function') updateFavBadge();
  if (e.key === 'cart' && typeof updateCartBadge === 'function') updateCartBadge();
  if (e.key === 'user') updateAccountLink();
});
