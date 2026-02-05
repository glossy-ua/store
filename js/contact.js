// js/contact.js
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

  const FN_URL = "https://fxaleremdkamkimuyoai.supabase.co/functions/v1/notify-telegram";
  const CONTACT_SECRET = "contact_v1_glossy";

  /* ================= helpers ================= */

  function setGlobalMsg(text = "", ok = true) {
    if (!outEl) return;
    outEl.textContent = text;
    outEl.style.color = ok ? "" : "#c00";
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function normalizePhone(phone) {
    let p = phone.replace(/\s+/g, "").replace(/-/g, "");
    if (p.startsWith("+")) p = p.slice(1);
    if (p.startsWith("0")) p = "38" + p;
    if (!p.startsWith("380")) return null;
    if (!/^380\d{9}$/.test(p)) return null;
    return "+" + p;
  }

  function validateName(value) {
    if (value.length < 2) return "Імʼя мінімум 2 символи";
    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length > 3) return "Не більше 3 слів (ПІБ)";
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

  /* ================= live validation ================= */

  function validateNameLive() {
    const err = validateName((nameEl.value || "").trim());
    setFieldError(nameEl, nameErrEl, err, err ? "" : "✓");
    return !err;
  }

  function validateEmailLive() {
    const v = (emailEl.value || "").trim();
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
    const v = (phoneEl.value || "").trim();
    if (!v) {
      setFieldError(phoneEl, phoneErrEl, ""); // телефон необязательный
      return true;
    }
    const ok = normalizePhone(v);
    if (!ok) {
      setFieldError(phoneEl, phoneErrEl, "Невірний формат телефону");
      return false;
    }
    setFieldError(phoneEl, phoneErrEl, "", "✓");
    return true;
  }

  // События
  nameEl?.addEventListener("input", validateNameLive);
  nameEl?.addEventListener("blur", validateNameLive);

  emailEl?.addEventListener("input", validateEmailLive);
  emailEl?.addEventListener("blur", validateEmailLive);

  phoneEl?.addEventListener("input", validatePhoneLive);
  phoneEl?.addEventListener("blur", validatePhoneLive);

  /* ================= submit ================= */

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setGlobalMsg("");

    const okName = validateNameLive();
    const okEmail = validateEmailLive();
    const okPhone = validatePhoneLive();

    if (!okName || !okEmail || !okPhone) {
      setGlobalMsg("Перевір поля форми 👆", false);
      return;
    }

    const payload = {
      kind: "contact",
      name: (nameEl.value || "").trim(),
      phone: normalizePhone((phoneEl.value || "").trim()) || "",
      email: (emailEl.value || "").trim(),
      message: (msgEl?.value || "").trim(),
    };

    setGlobalMsg("Відправляємо…");

    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": CONTACT_SECRET,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        console.error(json);
        setGlobalMsg("Помилка сервера", false);
        return;
      }

      form.reset();
      clearAllErrors();
      setGlobalMsg("✅ Заявку відправлено! Ми зв’яжемось з тобою.");
    } catch (err) {
      console.error(err);
      setGlobalMsg("Помилка мережі", false);
    }
  });

  // старт: очистить ошибки
  clearAllErrors();
})();
