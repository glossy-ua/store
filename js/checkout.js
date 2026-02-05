// js/checkout.js
// Cart = localStorage
// Orders = Supabase (orders + order_items)

(function () {
  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function moneyToNumber(v) {
    const n = parseFloat(String(v).replace(",", ".").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function isEmailValid(email) {
    const v = String(email || "").trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(v);
  }

  // UA phone: accept 0XXXXXXXXX or +380XXXXXXXXX or 380XXXXXXXXX → normalize to +380XXXXXXXXX
  function normalizeUaPhone(raw) {
    let s = String(raw || "").trim();
    s = s.replace(/[^\d+]/g, "");

    if (/^0\d{9}$/.test(s)) return "+38" + s;        // 0XXXXXXXXX → +380XXXXXXXXX
    if (/^380\d{9}$/.test(s)) return "+" + s;        // 380XXXXXXXXX → +380XXXXXXXXX
    if (/^\+380\d{9}$/.test(s)) return s;            // ok
    return "";
  }

  function formatUaPhoneForInput(raw) {
    const norm = normalizeUaPhone(raw);
    if (!norm) return raw;

    const digits = norm.replace(/\D/g, ""); // 380XXXXXXXXX
    const x = digits.slice(3);              // 9 digits
    const a = x.slice(0, 2);
    const b = x.slice(2, 5);
    const c = x.slice(5, 7);
    const d = x.slice(7, 9);
    return `+380 ${a} ${b} ${c} ${d}`.trim();
  }

  // name: min 2 chars, max 3 words
  function validateName(value) {
    const v = String(value || "").trim();
    if (v.length < 2) return "Мінімум 2 символи";
    const parts = v.split(/\s+/).filter(Boolean);
    if (parts.length > 3) return "Не більше 3 слів (ПІБ)";
    return "";
  }

  function validateCity(value) {
    const v = String(value || "").trim();
    if (v.length < 2) return "Мінімум 2 символи";
    return "";
  }

  // office: digits only 1..6 (можешь поменять)
  function validateOffice(value) {
    const v = String(value || "").trim();
    if (!/^\d{1,6}$/.test(v)) return "Тільки цифри (1–6)";
    return "";
  }

  function setError(inputEl, errEl, message) {
    if (!inputEl || !errEl) return;

    inputEl.classList.remove("input-ok", "input-err");
    errEl.textContent = "";

    if (message) {
      inputEl.classList.add("input-err");
      errEl.textContent = message;
    } else {
      inputEl.classList.add("input-ok");
      errEl.textContent = "";
    }
  }

  function getErrEl(key) {
    return document.querySelector(`.field-error[data-err="${key}"]`);
  }

  // ---------- cart safe ----------
  function getCartSafe() {
    if (typeof window.getCart === "function") return window.getCart();
    try { return JSON.parse(localStorage.getItem("cart") || "[]"); } catch { return []; }
  }

  function setCartSafe(arr) {
    if (typeof window.setCart === "function") return window.setCart(arr);
    localStorage.setItem("cart", JSON.stringify(Array.isArray(arr) ? arr : []));
  }

  // ---------- supabase ----------
  function getSb() {
    if (window.sb) return window.sb;

    if (window.supabase?.createClient) {
      const SUPABASE_URL = "https://fxaleremdkamkimuyoai.supabase.co";
      const SUPABASE_ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4YWxlcmVtZGthbWtpbXV5b2FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTM1MTUsImV4cCI6MjA4NTM4OTUxNX0.3oJ0LCLdsD8PnewKyITY_EseY0KK9uyvdNXiqk3fIxE";
      window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return window.sb;
    }

    throw new Error("Supabase не підключений. Додай supabase-js і supabaseClient.js перед checkout.js");
  }

  const sb = getSb();

  // ---------- auth guard ----------
  async function requireSessionOrRedirect() {
    const { data: sess } = await sb.auth.getSession();
    if (!sess?.session) {
      location.href = "auth.html";
      return null;
    }
    const { data: uData, error } = await sb.auth.getUser();
    if (error || !uData?.user) {
      location.href = "auth.html";
      return null;
    }
    return uData.user;
  }

  // ---------- autofill ----------
  async function autofillCheckoutFromSupabase() {
    const user = await requireSessionOrRedirect();
    if (!user) return;

    const md = user.user_metadata || {};

    const nameEl = $('[name="firstName"]');
    const phoneEl = $('[name="phone"]');
    const cityEl = $('[name="city"]');

    const serviceEl = $("#deliveryService");
    const officeEl = $("#deliveryOffice");

    const fullName = [md.firstName, md.lastName].filter(Boolean).join(" ").trim();

    if (nameEl && !nameEl.value) nameEl.value = fullName || "";
    if (phoneEl && !phoneEl.value) phoneEl.value = md.phone || "";
    if (cityEl && !cityEl.value) cityEl.value = md.city || "";

    if (serviceEl && !serviceEl.value && md.delivery_service) serviceEl.value = md.delivery_service;
    if (officeEl && !officeEl.value && md.delivery_office) officeEl.value = md.delivery_office;
  }

  // ---------- render summary ----------
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

  // ---------- sync metadata ----------
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
        delivery_service: receiver.deliveryService || "",
        delivery_office: receiver.deliveryOffice || ""
      }
    });
  }

  // ---------- insert order ----------
  async function insertOrderToSupabase({ total, receiver, items }) {
    const { data: uData, error: uErr } = await sb.auth.getUser();
    if (uErr || !uData?.user) throw new Error("Немає сесії. Увійди знову.");

    const userId = uData.user.id;

    const orderPayload = {
      user_id: userId,
      owner_id: userId,
      total: Number(total.toFixed(2)),
      receiver_name: receiver.name,
      receiver_phone: receiver.phone,
      receiver_city: receiver.city,
      receiver_post_office: `${receiver.deliveryService || ""} / №${receiver.deliveryOffice || ""}`.trim(),
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

  // ---------- telegram notify ----------
  async function notifyOrderToTelegram({ orderId, total, receiver }) {
    const FN_URL = "https://fxaleremdkamkimuyoai.supabase.co/functions/v1/notify-telegram";
    const ORDERS_SECRET = "orders_v1_glossy";

    const payload = {
      kind: "order",
      order_id: String(orderId),
      total: Number(total).toFixed(2),
      receiver_name: receiver.name,
      receiver_phone: receiver.phone,
      receiver_city: receiver.city,
      receiver_post_office: `${receiver.deliveryService || ""} / №${receiver.deliveryOffice || ""}`.trim(),
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
      // заказ не роняем
    }
  }

  // ---------- validation (live + submit) ----------
  function setupValidation() {
    const form = $("#checkoutForm");
    if (!form) return null;

    const nameEl = form.querySelector('[name="firstName"]');
    const phoneEl = form.querySelector('[name="phone"]');
    const cityEl = form.querySelector('[name="city"]');
    const commentEl = form.querySelector('[name="comment"]');

    const serviceEl = $("#deliveryService");
    const officeEl = $("#deliveryOffice");

    const nameErr = getErrEl("firstName");
    const phoneErr = getErrEl("phone");
    const cityErr = getErrEl("city");
    const deliveryErr = getErrEl("delivery");

    // input restrictions
    phoneEl?.addEventListener("input", () => {
      phoneEl.value = phoneEl.value.replace(/[^\d+\s()-]/g, "");
    });

    officeEl?.addEventListener("input", () => {
      officeEl.value = officeEl.value.replace(/[^\d]/g, "");
    });

    function vName(live = true) {
      const msg = validateName(nameEl?.value);
      if (!live && !nameEl?.value?.trim()) return setError(nameEl, nameErr, "Вкажи імʼя"), false;
      setError(nameEl, nameErr, msg);
      return !msg;
    }

    function vPhone(live = true) {
      const v = String(phoneEl?.value || "").trim();
      if (!v) {
        if (live) { setError(phoneEl, phoneErr, ""); phoneEl?.classList.remove("input-ok","input-err"); }
        else setError(phoneEl, phoneErr, "Вкажи телефон");
        return false;
      }
      const norm = normalizeUaPhone(v);
      if (!norm) {
        setError(phoneEl, phoneErr, "Формат: 0XXXXXXXXX або +380XXXXXXXXX");
        return false;
      }
      // форматируем мягко
      phoneEl.value = formatUaPhoneForInput(phoneEl.value);
      setError(phoneEl, phoneErr, "");
      return true;
    }

    function vCity(live = true) {
      const v = String(cityEl?.value || "").trim();
      if (!v) {
        if (live) { setError(cityEl, cityErr, ""); cityEl?.classList.remove("input-ok","input-err"); }
        else setError(cityEl, cityErr, "Вкажи місто");
        return false;
      }
      const msg = validateCity(v);
      setError(cityEl, cityErr, msg);
      return !msg;
    }

    function vDelivery(live = true) {
      const s = String(serviceEl?.value || "").trim();
      const o = String(officeEl?.value || "").trim();

      // служба
      if (!s) {
        if (live) {
          deliveryErr && (deliveryErr.textContent = "");
          serviceEl?.classList.remove("input-ok", "input-err");
        } else {
          serviceEl?.classList.add("input-err");
          deliveryErr && (deliveryErr.textContent = "Оберіть службу доставки");
        }
        return false;
      }

      // номер
      const officeMsg = validateOffice(o);
      if (officeMsg) {
        serviceEl?.classList.remove("input-err");
        serviceEl?.classList.add("input-ok");

        officeEl?.classList.add("input-err");
        deliveryErr && (deliveryErr.textContent = "Номер відділення: " + officeMsg);
        return false;
      }

      // ok
      serviceEl?.classList.remove("input-err");
      officeEl?.classList.remove("input-err");
      serviceEl?.classList.add("input-ok");
      officeEl?.classList.add("input-ok");
      deliveryErr && (deliveryErr.textContent = "");
      return true;
    }

    // live handlers
    nameEl?.addEventListener("input", () => vName(true));
    nameEl?.addEventListener("blur", () => vName(false));

    phoneEl?.addEventListener("input", () => vPhone(true));
    phoneEl?.addEventListener("blur", () => vPhone(false));

    cityEl?.addEventListener("input", () => vCity(true));
    cityEl?.addEventListener("blur", () => vCity(false));

    serviceEl?.addEventListener("change", () => vDelivery(false));
    officeEl?.addEventListener("input", () => vDelivery(true));
    officeEl?.addEventListener("blur", () => vDelivery(false));

    function validateAll() {
      const ok =
        vName(false) &&
        vPhone(false) &&
        vCity(false) &&
        vDelivery(false);

      if (!ok) {
        const firstErr = form.querySelector(".input-err");
        if (firstErr) {
          firstErr.scrollIntoView({ behavior: "smooth", block: "center" });
          firstErr.focus?.();
        }
      }
      return ok;
    }

    return {
      form,
      getReceiver: () => ({
        name: String(nameEl?.value || "").trim(),
        phone: normalizeUaPhone(phoneEl?.value || "") || String(phoneEl?.value || "").trim(),
        city: String(cityEl?.value || "").trim(),
        deliveryService: String(serviceEl?.value || "").trim(),
        deliveryOffice: String(officeEl?.value || "").trim(),
        comment: String(commentEl?.value || "").trim(),
      }),
      validateAll
    };
  }

  // ---------- submit ----------
  function setupSubmit(validationApi) {
    const form = validationApi?.form;
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const { items, total } = renderCheckoutSummary();
      if (!items.length) {
        alert("Кошик порожній.");
        return;
      }

      if (!validationApi.validateAll()) return;

      const receiver = validationApi.getReceiver();

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.oldText = submitBtn.textContent;
        submitBtn.textContent = "Зачекай...";
      }

      try {
        await requireSessionOrRedirect();
        await syncCheckoutToUserMetadata(receiver);

        const orderId = await insertOrderToSupabase({ total, receiver, items });
        await notifyOrderToTelegram({ orderId, total, receiver });

        setCartSafe([]);
        if (typeof window.updateCartBadge === "function") window.updateCartBadge();

        location.href = "profile.html";
      } catch (err) {
        console.error(err);
        alert(err?.message || "Помилка оформлення замовлення.");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtn.dataset.oldText || "Підтвердити замовлення";
          delete submitBtn.dataset.oldText;
        }
      }
    });
  }

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", async () => {
    await autofillCheckoutFromSupabase();
    renderCheckoutSummary();

    const validationApi = setupValidation();
    setupSubmit(validationApi);
  });
})();
