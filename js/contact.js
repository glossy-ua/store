// js/contact.js
// Contact form -> Supabase RPC: send_contact_v1 (returns jsonb {ok:true} or {ok:false, error:'...'})

(() => {
  const form = document.getElementById("contactForm");
  if (!form) return;

  const nameEl = document.getElementById("cfName");
  const phoneEl = document.getElementById("cfPhone");
  const emailEl = document.getElementById("cfEmail");
  const msgEl = document.getElementById("cfMessage");
  const outEl = document.getElementById("cfMsg");

  // error elements (под каждым полем)
  const nameErrEl = document.getElementById("cfNameErr");
  const phoneErrEl = document.getElementById("cfPhoneErr");
  const emailErrEl = document.getElementById("cfEmailErr");
  const msgErrEl = document.getElementById("cfMessageErr");

  /* ================= helpers ================= */

  function setGlobalMsg(text = "", ok = true) {
    if (!outEl) return;
    outEl.textContent = text;
    outEl.style.color = ok ? "" : "#c00";
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(email || "").trim());
  }

  // UA phone: accept 0XXXXXXXXX or +380XXXXXXXXX or 380XXXXXXXXX → normalize to +380XXXXXXXXX
  function normalizePhone(raw) {
    let s = String(raw || "").trim();
    if (!s) return ""; // optional
    s = s.replace(/[^\d+]/g, "");

    if (/^0\d{9}$/.test(s)) return "+38" + s;
    if (/^380\d{9}$/.test(s)) return "+" + s;
    if (/^\+380\d{9}$/.test(s)) return s;
    return null; // invalid
  }

  function validateName(value) {
    const v = String(value || "").trim();
    if (v.length < 2) return "Імʼя мінімум 2 символи";
    const parts = v.split(/\s+/).filter(Boolean);
    if (parts.length > 3) return "Не більше 3 слів (ПІБ)";
    return "";
  }

  function validateMessage(value) {
    const v = String(value || "").trim();
    if (v && v.length > 2000) return "Повідомлення занадто довге (до 2000 символів)";
    return "";
  }

  function setFieldError(inputEl, errEl, message = "", okMessage = "") {
    if (!inputEl || !errEl) return;

    inputEl.classList.remove("input-ok", "input-err");
    errEl.classList.remove("ok");
    errEl.textContent = "";

    if (!message && okMessage) {
      inputEl.classList.add("input-ok");
      errEl.classList.add("ok");
      errEl.textContent = okMessage;
      return;
    }

    if (message) {
      inputEl.classList.add("input-err");
      errEl.textContent = message;
    }
  }

  function clearAllErrors() {
    setFieldError(nameEl, nameErrEl, "");
    setFieldError(phoneEl, phoneErrEl, "");
    setFieldError(emailEl, emailErrEl, "");
    setFieldError(msgEl, msgErrEl, "");
  }

  function scrollToFirstError() {
    const firstErr = form.querySelector(".input-err");
    if (firstErr) {
      firstErr.scrollIntoView({ behavior: "smooth", block: "center" });
      firstErr.focus?.();
    }
  }

  /* ================= supabase ================= */

  function getSb() {
    // prefer global client
    if (window.sb) return window.sb;

    // fallback (если вдруг supabaseClient.js не подключен)
    if (window.supabase?.createClient) {
      const SUPABASE_URL = "https://fxaleremdkamkimuyoai.supabase.co";
      const SUPABASE_ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4YWxlcmVtZGthbWtpbXV5b2FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTM1MTUsImV4cCI6MjA4NTM4OTUxNX0.3oJ0LCLdsD8PnewKyITY_EseY0KK9uyvdNXiqk3fIxE";
      window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return window.sb;
    }

    throw new Error("Supabase не підключений. Додай supabase-js і supabaseClient.js перед contact.js");
  }

  const sb = getSb();

  /* ================= live validation ================= */

  function validateNameLive() {
    const err = validateName(nameEl?.value);
    setFieldError(nameEl, nameErrEl, err, err ? "" : "✓");
    return !err;
  }

  function validateEmailLive() {
    const v = String(emailEl?.value || "").trim();
    if (!v) {
      setFieldError(emailEl, emailErrEl, "Email обовʼязковий");
      return false;
    }
    if (!isValidEmail(v)) {
      setFieldError(emailEl, emailErrEl, "Невірний email");
      return false;
    }
    setFieldError(emailEl, emailErrEl, "", "✓");
    return true;
  }

  function validatePhoneLive() {
    const v = String(phoneEl?.value || "").trim();
    if (!v) {
      setFieldError(phoneEl, phoneErrEl, ""); // optional
      phoneEl?.classList.remove("input-ok", "input-err");
      return true;
    }
    const norm = normalizePhone(v);
    if (!norm) {
      setFieldError(phoneEl, phoneErrEl, "Формат: 0XXXXXXXXX або +380XXXXXXXXX");
      return false;
    }
    setFieldError(phoneEl, phoneErrEl, "", "✓");
    return true;
  }

  function validateMessageLive() {
    const err = validateMessage(msgEl?.value);
    setFieldError(msgEl, msgErrEl, err, err ? "" : (String(msgEl?.value || "").trim() ? "✓" : ""));
    return !err;
  }

  // events
  nameEl?.addEventListener("input", validateNameLive);
  nameEl?.addEventListener("blur", validateNameLive);

  emailEl?.addEventListener("input", validateEmailLive);
  emailEl?.addEventListener("blur", validateEmailLive);

  phoneEl?.addEventListener("input", () => {
    // лёгкая чистка ввода
    phoneEl.value = phoneEl.value.replace(/[^\d+\s()-]/g, "");
    validatePhoneLive();
  });
  phoneEl?.addEventListener("blur", validatePhoneLive);

  msgEl?.addEventListener("input", validateMessageLive);
  msgEl?.addEventListener("blur", validateMessageLive);

  /* ================= submit ================= */

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setGlobalMsg("");

    const okName = validateNameLive();
    const okEmail = validateEmailLive();
    const okPhone = validatePhoneLive();
    const okMsg = validateMessageLive();

    if (!okName || !okEmail || !okPhone || !okMsg) {
      setGlobalMsg("Перевір поля форми 👆", false);
      scrollToFirstError();
      return;
    }

    const payload = {
      p_name: String(nameEl?.value || "").trim(),
      p_phone: normalizePhone(String(phoneEl?.value || "").trim()) || "",
      p_email: String(emailEl?.value || "").trim(),
      p_message: String(msgEl?.value || "").trim(),
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.oldText = submitBtn.textContent;
      submitBtn.textContent = "Відправляємо…";
    }
    setGlobalMsg("Відправляємо…");

    try {
      const { data, error } = await sb.rpc("send_contact_v1", payload);

      if (error) {
        console.error("send_contact_v1 error:", error);
        setGlobalMsg("Помилка сервера", false);
        return;
      }

      // ожидаем { ok: true } или { ok:false, error:'rate_limited', retry_in:60 }
      const ok = data?.ok === true;

      if (!ok) {
        if (data?.error === "rate_limited") {
          const sec = Number(data?.retry_in || 60) || 60;
          setGlobalMsg(`Забагато запитів. Спробуй ще раз через ${sec} сек.`, false);
          return;
        }

        if (data?.error === "bad_name") {
          setFieldError(nameEl, nameErrEl, "Імʼя мінімум 2 символи");
          scrollToFirstError();
          return;
        }

        if (data?.error === "bad_email") {
          setFieldError(emailEl, emailErrEl, "Невірний email");
          scrollToFirstError();
          return;
        }

        if (data?.error === "message_too_long") {
          setFieldError(msgEl, msgErrEl, "Повідомлення занадто довге (до 2000 символів)");
          scrollToFirstError();
          return;
        }

        setGlobalMsg("Помилка сервера", false);
        return;
      }

      form.reset();
      clearAllErrors();
      setGlobalMsg("✅ Заявку відправлено! Ми зв’яжемось з тобою.");
    } catch (err) {
      console.error(err);
      setGlobalMsg("Помилка мережі", false);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.oldText || "Відправити";
        delete submitBtn.dataset.oldText;
      }
    }
  });

  // init
  clearAllErrors();
})();
