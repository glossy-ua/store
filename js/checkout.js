// js/checkout.js
// Cart = localStorage
// Orders = Supabase (orders + order_items)

function $(sel) { return document.querySelector(sel); }

function moneyToNumber(v) {
  const n = parseFloat(String(v).replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// ===== CART (из store.js если есть) =====
function getCartSafe() {
  if (typeof getCart === "function") return getCart();
  try { return JSON.parse(localStorage.getItem("cart") || "[]"); } catch { return []; }
}
function setCartSafe(arr) {
  if (typeof setCart === "function") return setCart(arr);
  localStorage.setItem("cart", JSON.stringify(Array.isArray(arr) ? arr : []));
}

// ===== Supabase client guard =====
function getSb() {
  // если подключил supabaseClient.js и там window.sb = ...
  if (window.sb) return window.sb;

  // запасной вариант: если не подключил, но supabase-js есть
  if (window.supabase?.createClient) {
    const SUPABASE_URL = "https://fxaleremdkamkimuyoai.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4YWxlcmVtZGthbWtpbXV5b2FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTM1MTUsImV4cCI6MjA4NTM4OTUxNX0.3oJ0LCLdsD8PnewKyITY_EseY0KK9uyvdNXiqk3fIxE";
    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return window.sb;
  }

  throw new Error("Supabase не підключений. Додай supabase-js і supabaseClient.js перед checkout.js");
}

const sb = getSb();

// ===== AUTH GUARD =====
async function requireSessionOrRedirect() {
  const { data: sess } = await sb.auth.getSession();
  if (!sess?.session) {
    location.href = "auth.html";
    return null;
  }
  const { data: uData, error } = await sb.auth.getUser();
  if (error || !uData?.user) {
    location.href = "/uth.html";
    return null;
  }
  return uData.user;
}

// ===== AUTOFILL из user_metadata =====
async function autofillCheckoutFromSupabase() {
  const user = await requireSessionOrRedirect();
  if (!user) return;

  const md = user.user_metadata || {};

  const nameEl = $('[name="firstName"]');
  const phoneEl = $('[name="phone"]');
  const cityEl = $('[name="city"]');
  const postEl = $('[name="postOffice"]');

  const fullName = [md.firstName, md.lastName].filter(Boolean).join(" ").trim();

  if (nameEl && !nameEl.value) nameEl.value = fullName || "";
  if (phoneEl && !phoneEl.value) phoneEl.value = md.phone || "";
  if (cityEl && !cityEl.value) cityEl.value = md.city || "";
  if (postEl && !postEl.value) postEl.value = md.address || "";
}

// ===== RENDER SUMMARY =====
function renderCheckoutSummary() {
  const list = $("#checkoutList");
  const totalEl = $("#checkoutTotal");
  const emptyEl = $("#checkoutEmpty");

  if (!list || !totalEl || !emptyEl) return { items: [], total: 0 };

  const cart = getCartSafe();

  if (!cart.length) {
    emptyEl.style.display = "block";
    list.innerHTML = "";
    totalEl.textContent = "0.00 грн.";
    return { items: [], total: 0 };
  }

  emptyEl.style.display = "none";

  const items = cart.map(p => {
    const qty = parseInt(p.qty, 10) || 1;
    const price = moneyToNumber(p.price);
    const sum = price * qty;

    return {
      product_id: String(p.id || ""),
      title: p.title || "",
      img: p.img || "",
      price,
      qty,
      sum
    };
  });

  const total = items.reduce((acc, i) => acc + i.sum, 0);

  list.innerHTML = items.map(i => `
    <article class="checkout-item">
      <div class="checkout-item__img">
        <img src="${i.img}" alt="${i.title}">
      </div>
      <div class="checkout-item__body">
        <div class="checkout-item__title">${i.title}</div>
        <div class="muted">К-сть: ${i.qty}</div>
      </div>
      <div class="checkout-item__sum"><strong>${i.sum.toFixed(2)} грн.</strong></div>
    </article>
  `).join("");

  totalEl.textContent = `${total.toFixed(2)} грн.`;

  return { items, total };
}

// ===== SAVE PROFILE BACK TO METADATA =====
async function syncCheckoutToUserMetadata(receiver) {
  const parts = String(receiver.name || "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ");

  await sb.auth.updateUser({
    data: {
      firstName,
      lastName,
      phone: receiver.phone || "",
      city: receiver.city || "",
      address: receiver.postOffice || ""
    }
  });
}

// ===== INSERT ORDER INTO SUPABASE =====
async function insertOrderToSupabase({ total, receiver, items }) {
  const { data: uData, error: uErr } = await sb.auth.getUser();
  if (uErr || !uData?.user) throw new Error("Немає сесії. Увійди знову.");

  

  const userId = uData.user.id;

  const orderPayload = {
    user_id: userId,      // ✅ ДОБАВЬ ЭТО
    owner_id: userId,     // можешь оставить
    total: Number(total.toFixed(2)),
    receiver_name: receiver.name,
    receiver_phone: receiver.phone,
    receiver_city: receiver.city,
    receiver_post_office: receiver.postOffice,
    receiver_comment: receiver.comment || ""
  };

  const { data: orderRow, error: oErr } = await sb
    .from("orders")
    .insert([orderPayload])
    .select("id")
    .single();

  if (oErr) throw oErr;

  const orderId = orderRow.id;
  

  const itemsPayload = items.map(i => ({
    owner_id: userId,
    order_id: orderId,
    product_id: i.product_id,
    title: i.title,
    img: i.img,
    price: Number(i.price),
    qty: Number(i.qty),
    sum: Number(i.sum)
  }));

  const { error: itErr } = await sb.from("order_items").insert(itemsPayload);
  if (itErr) throw itErr;

  return orderId;
}

// ===== SUBMIT =====
function setupSubmit() {
  const form = document.getElementById("checkoutForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const { items, total } = renderCheckoutSummary();
    if (!items.length) return alert("Кошик порожній.");

    const nameVal = ($('[name="firstName"]')?.value || "").trim();
    const phoneVal = ($('[name="phone"]')?.value || "").trim();
    const cityVal = ($('[name="city"]')?.value || "").trim();
    const postVal = ($('[name="postOffice"]')?.value || "").trim();
    const commentVal = ($('[name="comment"]')?.value || "").trim();

    if (!nameVal) return alert("Вкажи імʼя.");
    if (!phoneVal) return alert("Вкажи телефон.");
    if (!cityVal) return alert("Вкажи місто.");
    if (!postVal) return alert("Вкажи відділення / пошту.");

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.oldText = submitBtn.textContent;
      submitBtn.textContent = "Зачекай...";
    }

    try {
      await requireSessionOrRedirect();

      const receiver = {
        name: nameVal,
        phone: phoneVal,
        city: cityVal,
        postOffice: postVal,
        comment: commentVal
      };

      await syncCheckoutToUserMetadata(receiver);

      const orderId = await insertOrderToSupabase({ total, receiver, items });
      await notifyOrderToTelegram({ orderId, total, receiver });


      async function notifyOrderToTelegram({ orderId, total, receiver }) {
  const FN_URL = "https://fxaleremdkamkimuyoai.supabase.co/functions/v1/notify-telegram";
  const ORDERS_SECRET = "orders_v1_glossy"; // <-- твой secret

  const payload = {
    kind: "order",
    order_id: String(orderId),
    total: Number(total).toFixed(2),
    receiver_name: receiver.name,
    receiver_phone: receiver.phone,
    receiver_city: receiver.city,
    receiver_post_office: receiver.postOffice,
    receiver_comment: receiver.comment || ""
  };

  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": ORDERS_SECRET,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    console.error("TG notify failed:", json);
    // НЕ роняем заказ, просто логируем
  }
}


      setCartSafe([]);
      if (typeof updateCartBadge === "function") updateCartBadge();

      // можно показать номер заказа
      // alert("Замовлення створено: #" + orderId);

      location.href = "profile.html";
    } catch (err) {
      console.error(err);
      alert(err?.message || "Помилка оформлення замовлення.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.oldText || "Оформити";
        delete submitBtn.dataset.oldText;
      }
    }
  });
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", async () => {
  await autofillCheckoutFromSupabase();
  renderCheckoutSummary();
  setupSubmit();
});


