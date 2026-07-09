// js/checkout.js
// Cart = localStorage
// Orders = Supabase (RPC create_order_v1) — AUTH ONLY
// If not logged in -> redirect to auth.html (with post_auth_redirect)

(function () {
  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function moneyToNumber(v) {
    const n = parseFloat(String(v ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
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

    if (/^0\d{9}$/.test(s)) return "+38" + s;
    if (/^380\d{9}$/.test(s)) return "+" + s;
    if (/^\+380\d{9}$/.test(s)) return s;
    return "";
  }

  function formatUaPhoneForInput(raw) {
    const norm = normalizeUaPhone(raw);
    if (!norm) return raw;

    const digits = norm.replace(/\D/g, "");
    const x = digits.slice(3);
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

  function validateOffice(value) {
    const v = String(value || "").trim();
    if (!/^\d{1,6}$/.test(v)) return "Тільки цифри (1–6)";
    return "";
  }

  function validateEmail(value) {
    const v = String(value || "").trim();
    if (!v) return "Вкажи email";
    if (!isEmailValid(v)) return "Невірний формат email";
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

  // supports both .field-error[data-err="..."] and ids like coPhoneErr
  function getErrEl(key) {
    return (
      document.querySelector(`.field-error[data-err="${key}"]`) ||
      document.getElementById(`co${key[0].toUpperCase() + key.slice(1)}Err`) ||
      null
    );
  }

  function money2(v) {
    const n = Number(v) || 0;
    return n.toFixed(2);
  }

  // ---------- cart safe ----------
  function getCartSafe() {
    if (typeof window.getCart === "function") return window.getCart();
    try {
      return JSON.parse(localStorage.getItem("cart") || "[]");
    } catch {
      return [];
    }
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

  async function getUserOrNull() {
    try {
      const { data: sess } = await sb.auth.getSession();
      if (!sess?.session) return null;
      const { data: uData } = await sb.auth.getUser();
      return uData?.user || null;
    } catch {
      return null;
    }
  }

  function redirectToAuthRemember() {
    try {
      window.setPostAuthRedirect?.(location.href);
    } catch {
      try {
        localStorage.setItem("post_auth_redirect", location.href);
      } catch {}
    }
    location.href = "auth.html";
  }

  // ---------- email save (only if logged in) ----------
  async function updateUserEmailIfNeeded(newEmail, cachedUserEmail) {
    const email = String(newEmail || "").trim().toLowerCase();
    const current = String(cachedUserEmail || "").trim().toLowerCase();

    if (!email || email === current) return { changed: false };
    if (!isEmailValid(email)) return { changed: false, error: "Невірний формат email" };

    const user = await getUserOrNull();
    if (!user) return { changed: false };

    const { data, error } = await sb.auth.updateUser({ email });
    if (error) return { changed: false, error: error.message || "Не вдалося зберегти email" };

    return { changed: true, data };
  }

  // ---------- autofill (if logged in) ----------
  async function autofillCheckoutFromSupabase() {
    const user = await getUserOrNull();
    if (!user) return null;

    const md = user.user_metadata || {};

    const nameEl = $('[name="firstName"]');
    const phoneEl = $('[name="phone"]');
    const cityEl = $('[name="city"]');
    const emailEl = $('[name="email"]');

    const serviceEl = $("#deliveryService");
    const officeEl = $("#deliveryOffice");

    const fullName = [md.firstName, md.lastName].filter(Boolean).join(" ").trim();

    if (nameEl && !nameEl.value) nameEl.value = fullName || "";
    if (phoneEl && !phoneEl.value) phoneEl.value = md.phone || "";
    if (cityEl && !cityEl.value) cityEl.value = md.city || "";
    if (emailEl && !emailEl.value) emailEl.value = user.email || "";

    if (serviceEl && !serviceEl.value && md.delivery_service) serviceEl.value = md.delivery_service;
    if (officeEl && !officeEl.value && md.delivery_office) officeEl.value = md.delivery_office;

    return user;
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

    const items = cart.map((p) => {
      const qty = parseInt(p.qty, 10) || 1;
      const price = moneyToNumber(p.price);
      const sum = price * qty;

      return {
        product_id: String(p.id || ""),
        title: p.title || "",
        img: p.img || "",
        price,
        qty,
        sum,
      };
    });

    const total = items.reduce((acc, i) => acc + i.sum, 0);

    list.innerHTML = items
      .map(
        (i) => `
      <div class="checkout-row">
        <div class="checkout-row__img">
          <img src="${esc(i.img)}" alt="${esc(i.title)}">
        </div>

        <div class="checkout-row__info">
          <div class="checkout-row__title">${esc(i.title)}</div>

          <div class="checkout-row__meta">
            <span class="checkout-row__code">Код: ${esc(i.product_id)}</span>
            <span class="checkout-row__line">${money2(i.price)} грн × ${i.qty}</span>
          </div>
        </div>

        <div class="checkout-row__sum">${money2(i.sum)} грн.</div>
      </div>
    `
      )
      .join("");

    totalEl.textContent = `${money2(total)} грн.`;

    return { items, total };
  }

  // ---------- sync metadata (only if logged in) ----------
  async function syncCheckoutToUserMetadata(receiver) {
    const user = await getUserOrNull();
    if (!user) return;

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
        delivery_office: receiver.deliveryOffice || "",
      },
    });
  }

  // ---------- validation ----------
  function setupValidation(state) {
    const form = $("#checkoutForm");
    if (!form) return null;

    const nameEl = form.querySelector('[name="firstName"]');
    const phoneEl = form.querySelector('[name="phone"]');
    const cityEl = form.querySelector('[name="city"]');
    const emailEl = form.querySelector('[name="email"]');
    const commentEl = form.querySelector('[name="comment"]');

    const serviceEl = $("#deliveryService");
    const officeEl = $("#deliveryOffice");

    const nameErr = getErrEl("firstName") || document.getElementById("coFirstNameErr");
    const phoneErr = getErrEl("phone") || document.getElementById("coPhoneErr");
    const cityErr = getErrEl("city") || document.getElementById("coCityErr");
    const emailErr = getErrEl("email") || document.getElementById("coEmailErr");
    const deliveryErr = getErrEl("delivery") || document.getElementById("coDeliveryErr");

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
        if (live) {
          setError(phoneEl, phoneErr, "");
          phoneEl?.classList.remove("input-ok", "input-err");
        } else setError(phoneEl, phoneErr, "Вкажи телефон");
        return false;
      }
      const norm = normalizeUaPhone(v);
      if (!norm) {
        setError(phoneEl, phoneErr, "Формат: 0XXXXXXXXX або +380XXXXXXXXX");
        return false;
      }
      phoneEl.value = formatUaPhoneForInput(phoneEl.value);
      setError(phoneEl, phoneErr, "");
      return true;
    }

    function vCity(live = true) {
      const v = String(cityEl?.value || "").trim();
      if (!v) {
        if (live) {
          setError(cityEl, cityErr, "");
          cityEl?.classList.remove("input-ok", "input-err");
        } else setError(cityEl, cityErr, "Вкажи місто");
        return false;
      }
      const msg = validateCity(v);
      setError(cityEl, cityErr, msg);
      return !msg;
    }

    function vEmail(live = true) {
      const v = String(emailEl?.value || "").trim();
      if (!v) {
        if (live) {
          setError(emailEl, emailErr, "");
          emailEl?.classList.remove("input-ok", "input-err");
        } else setError(emailEl, emailErr, "Вкажи email");
        return false;
      }
      const msg = validateEmail(v);
      setError(emailEl, emailErr, msg);
      return !msg;
    }

    function vDelivery(live = true) {
      const s = String(serviceEl?.value || "").trim();
      const o = String(officeEl?.value || "").trim();

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

      const officeMsg = validateOffice(o);
      if (officeMsg) {
        serviceEl?.classList.remove("input-err");
        serviceEl?.classList.add("input-ok");

        officeEl?.classList.add("input-err");
        deliveryErr && (deliveryErr.textContent = "Номер відділення: " + officeMsg);
        return false;
      }

      serviceEl?.classList.remove("input-err");
      officeEl?.classList.remove("input-err");
      serviceEl?.classList.add("input-ok");
      officeEl?.classList.add("input-ok");
      deliveryErr && (deliveryErr.textContent = "");
      return true;
    }

    let savingEmail = false;

    emailEl?.addEventListener("blur", async () => {
      if (!vEmail(false)) return;
      if (savingEmail) return;
      savingEmail = true;

      try {
        const email = String(emailEl.value || "").trim();
        const res = await updateUserEmailIfNeeded(email, state.userEmail);
        if (res?.error) setError(emailEl, emailErr, res.error);
        else if (res.changed) state.userEmail = email;
      } finally {
        savingEmail = false;
      }
    });

    nameEl?.addEventListener("input", () => vName(true));
    nameEl?.addEventListener("blur", () => vName(false));

    phoneEl?.addEventListener("input", () => vPhone(true));
    phoneEl?.addEventListener("blur", () => vPhone(false));

    cityEl?.addEventListener("input", () => vCity(true));
    cityEl?.addEventListener("blur", () => vCity(false));

    emailEl?.addEventListener("input", () => vEmail(true));

    serviceEl?.addEventListener("change", () => vDelivery(false));
    officeEl?.addEventListener("input", () => vDelivery(true));
    officeEl?.addEventListener("blur", () => vDelivery(false));

    function validateAll() {
      const ok = vName(false) && vPhone(false) && vCity(false) && vEmail(false) && vDelivery(false);

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
        email: String(emailEl?.value || "").trim(),
        deliveryService: String(serviceEl?.value || "").trim(),
        deliveryOffice: String(officeEl?.value || "").trim(),
        comment: String(commentEl?.value || "").trim(),
      }),
      validateAll,
      saveEmailIfChanged: async () => {
        if (!emailEl) return;
        if (!vEmail(false)) throw new Error("Перевір email");

        const email = String(emailEl.value || "").trim();
        const res = await updateUserEmailIfNeeded(email, state.userEmail);

        if (res?.error) throw new Error(res.error);
        if (res.changed) state.userEmail = email;
      },
    };
  }

  // ---------- submit (AUTH ONLY) ----------
  function setupSubmit(validationApi) {
    const form = validationApi?.form;
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const { items } = renderCheckoutSummary();
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
        const user = await getUserOrNull();
        if (!user) {
          redirectToAuthRemember();
          return;
        }

        await validationApi.saveEmailIfChanged().catch(() => {});
        await syncCheckoutToUserMetadata(receiver).catch(() => {});

        const itemsForRpc = items.map((i) => ({
          product_id: String(i.product_id),
          qty: Number(i.qty) || 1,
          img: i.img || "",
        }));

        const { data: orderId, error } = await sb.rpc("create_order_v1", {
          p_receiver_name: receiver.name,
          p_receiver_phone: receiver.phone,
          p_receiver_city: receiver.city,
          p_receiver_post_office: `${receiver.deliveryService || ""} / №${receiver.deliveryOffice || ""}`.trim(),
          p_receiver_comment: receiver.comment || "",
          p_items: itemsForRpc,
        });

        if (error) throw error;

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
    const user = await autofillCheckoutFromSupabase();
    renderCheckoutSummary();

    const state = { userEmail: user?.email || "" };

    const validationApi = setupValidation(state);
    setupSubmit(validationApi);
  });
})();
