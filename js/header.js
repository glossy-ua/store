function getUserSafe() {
  const uid = localStorage.getItem("sb_uid");
  if (!uid) return null;
  try { return JSON.parse(localStorage.getItem('user') || 'null'); }
  catch { return null; }
}

function pageUrl(name){
  const p = location.pathname;
  // если мы внутри /catalog/ — поднимаемся на уровень выше
  if (p.includes('/catalog/')) return `../${name}`;
  return name;
}

function updateAccountLinks() {
  const user = getUserSafe();
  const href = user ? pageUrl('profile.html') : pageUrl('auth.html');

  const a1 = document.getElementById('accountLink');
  if (a1) a1.href = href;
}

/* ====== MOBILE MENU (mmenu) ====== */
function initMobileMenu(){
  const mmenu = document.getElementById('mmenu');
  const burger = document.getElementById('burgerBtn');
  if (!mmenu || !burger) return;

  const open = () => {
    mmenu.classList.add('is-open');
    mmenu.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    burger.setAttribute('aria-expanded', 'true');
  };

  const close = () => {
    mmenu.classList.remove('is-open');
    mmenu.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    burger.setAttribute('aria-expanded', 'false');
  };

  burger.addEventListener('click', () => {
    if (mmenu.classList.contains('is-open')) close();
    else open();
  });

  mmenu.addEventListener('click', (e) => {
    if (e.target?.dataset?.mclose === '1') close();
    if (e.target.closest('.mmenu__link')) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mmenu.classList.contains('is-open')) close();
  });
}

/* ====== SEARCH + SUGGEST ====== */
function initSearch(formId, inputId, boxId){
  const searchForm = document.getElementById(formId);
  const searchInput = document.getElementById(inputId);
  const suggestBox = document.getElementById(boxId);

  if (!searchForm || !searchInput || !suggestBox) return;

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (q) window.location.href = `${pageUrl('search.html')}?q=${encodeURIComponent(q)}`;
  });

  // автоподстановка q в инпут
  const params = new URLSearchParams(window.location.search);
  const qParam = params.get('q');
  if (qParam) searchInput.value = qParam;

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
    suggestBox.hidden = true;
    suggestBox.innerHTML = "";
    activeIndex = -1;
    lastItems = [];
  }

  function showSuggest(items){
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
    const items = [...suggestBox.querySelectorAll('.search-suggest__item')];
    items.forEach(el => el.classList.remove('is-active'));
    if (idx >= 0 && idx < items.length){
      items[idx].classList.add('is-active');
      activeIndex = idx;
    } else {
      activeIndex = -1;
    }
  }

  suggestBox.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.search-suggest__item');
    if (!item) return;
    const i = Number(item.dataset.i);
    const p = lastItems[i];
    if (!p) return;
    window.location.href = `${pageUrl('search.html')}?q=${encodeURIComponent(p.title)}`;
  });

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
    if (suggestBox.hidden) return;
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
        window.location.href = `${pageUrl('search.html')}?q=${encodeURIComponent(p.title)}`;
      }
    } else if (e.key === 'Escape'){
      hideSuggest();
    }
  });

  document.addEventListener('click', (e) => {
    const inside = e.target.closest(`#${formId}`);
    if (!inside) hideSuggest();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof updateFavBadge === 'function') updateFavBadge();
  if (typeof updateCartBadge === 'function') updateCartBadge();

  updateAccountLinks();
  initMobileMenu();
  initSearch('searchForm', 'searchInput', 'searchSuggest');
});

window.addEventListener('storage', (e) => {
  if (e.key === 'favorites' && typeof updateFavBadge === 'function') updateFavBadge();
  if (e.key === 'cart' && typeof updateCartBadge === 'function') updateCartBadge();
  if (e.key === 'user') updateAccountLinks();
});

function markActiveMenuLinks(){
  const path = location.pathname.split('/').pop() || 'index.html';

  document.querySelectorAll('.mmenu__link').forEach(a => {
    const href = (a.getAttribute('href') || '').split('/').pop();
    if (!href) return;
    a.classList.toggle('is-active', href === path);
  });

  // если хочешь, можно и десктоп-меню подсвечивать так же
  document.querySelectorAll('.main-nav a').forEach(a => {
    const href = (a.getAttribute('href') || '').split('/').pop();
    const li = a.closest('li');
    if (!li) return;
    li.classList.toggle('active', href === path);
  });
}

document.addEventListener('DOMContentLoaded', markActiveMenuLinks);

/* ===== Auto-hide search on scroll (mobile) — smooth (no jump) ===== */
(function initAutoHideSearch(){
  const mq = window.matchMedia("(max-width: 768px)");
  const header = document.querySelector(".site-header");
  const mmenu = document.getElementById("mmenu");
  if (!header) return;

  let lastY = window.scrollY || 0;
  let ticking = false;
  let hidden = false;

  let H_SHOWN = 0;  // высота шапки с поиском
  let H_HIDDEN = 0; // высота шапки без поиска

  function measureHeights(){
    if (!mq.matches) {
      header.classList.remove("is-search-hidden");
      document.body.style.paddingTop = header.offsetHeight + "px";
      return;
    }

    // 1) показано
    header.classList.remove("is-search-hidden");
    H_SHOWN = header.offsetHeight;

    // 2) скрыто (временно включаем класс, меряем, возвращаем назад)
    header.classList.add("is-search-hidden");
    H_HIDDEN = header.offsetHeight;

    header.classList.toggle("is-search-hidden", hidden);
    document.body.style.paddingTop = (hidden ? H_HIDDEN : H_SHOWN) + "px";
  }

  function setHidden(nextHidden){
    if (hidden === nextHidden) return;
    hidden = nextHidden;

    header.classList.toggle("is-search-hidden", hidden);

    // плавно анимируем отступ контента (body transition уже включен)
    document.body.style.paddingTop = (hidden ? H_HIDDEN : H_SHOWN) + "px";
  }

  function onScroll(){
    if (!mq.matches) return;

    // если меню открыто — не прячем поиск
    if (mmenu && mmenu.classList.contains("is-open")){
      setHidden(false);
      return;
    }

    const y = window.scrollY || 0;
    const dy = y - lastY;

    if (Math.abs(dy) < 6) return;

    if (dy > 0 && y > 80) setHidden(true);   // вниз
    if (dy < 0) setHidden(false);            // вверх

    lastY = y;
  }

  function onScrollRaf(){
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      onScroll();
      ticking = false;
    });
  }

  function onModeChange(){
    hidden = false;
    header.classList.remove("is-search-hidden");
    measureHeights();
  }

  document.addEventListener("DOMContentLoaded", () => {
    measureHeights();
    window.addEventListener("scroll", onScrollRaf, { passive: true });
    window.addEventListener("resize", measureHeights);

    if (mq.addEventListener) mq.addEventListener("change", onModeChange);
    else mq.addListener(onModeChange);
  });
})();

