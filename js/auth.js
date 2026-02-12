// js/auth.js (Supabase auth + email confirm + UA errors)

(() => {
  const sb = window.sb;

  function pageUrl(name){
    return location.pathname.includes('/catalog/') ? `../${name}` : name;
  }

  const REDIRECT_TO = new URL(pageUrl('auth.html'), window.location.href).toString();
  const RESET_REDIRECT_TO = new URL(pageUrl('reset.html'), window.location.href).toString();

  // ---------- UA translate ----------
  function tAuthError(msg = "") {
    const m = String(msg || "").trim();

    // частые Supabase ошибки
    const map = {
      "Invalid login credentials": "Невірний email або пароль.",
      "Email not confirmed": "Пошта не підтверджена.",
      "User already registered": "Користувач з таким email вже існує.",
      "Password should be at least 6 characters": "Пароль має містити мінімум 6 символів.",
      "Signup requires a valid password": "Вкажи коректний пароль.",
      "Invalid email or password": "Невірний email або пароль.",
      "Invalid email": "Невірний формат email.",
      "Email rate limit exceeded": "Забагато спроб. Спробуй пізніше.",
      "Too many requests": "Забагато запитів. Спробуй пізніше."
    };

    if (map[m]) return map[m];

    // мягкий фолбэк по ключевым словам
    const low = m.toLowerCase();
    if (low.includes("invalid login")) return "Невірний email або пароль.";
    if (low.includes("email not confirmed")) return "Пошта не підтверджена.";
    if (low.includes("rate limit") || low.includes("too many")) return "Забагато спроб. Спробуй пізніше.";
    if (low.includes("password")) return "Помилка паролю. Перевір пароль і спробуй ще раз.";

    // если вообще не распознали — покажем оригинал (но без англ. ужаса не получится всегда)
    return m || "Сталася помилка. Спробуй ще раз.";
  }

  // ---------- UI helpers ----------
  function showResend(email = "") {
    const wrap = document.getElementById("resendWrap");
    const btn = document.getElementById("resendBtn");
    if (!wrap || !btn) return;

    btn.dataset.email = (email || "").toLowerCase();
    wrap.style.display = "flex";
  }

  function hideResend() {
    const wrap = document.getElementById("resendWrap");
    if (wrap) wrap.style.display = "none";
  }

  function showMsg(text, type = "err") {
    const el = document.getElementById("authMsg");
    if (!el) return alert(text);
    el.className = "auth-msg " + (type === "ok" ? "ok" : "err");
    el.textContent = text;
    el.style.display = "block";
  }

  function hideMsg() {
    const el = document.getElementById("authMsg");
    if (el) el.style.display = "none";
  }

  function isEmailConfirmed(user) {
    return !!user?.email_confirmed_at;
  }

  // временно сохраняем user в localStorage
  function saveUserToLocalStorage(user) {
    const md = user?.user_metadata || {};
    const u = {
      email: user?.email || "",
      firstName: md.firstName || "",
      lastName: md.lastName || "",
      phone: md.phone || "",
      city: md.city || "",
      address: md.address || ""
    };
    localStorage.setItem("user", JSON.stringify(u));
    localStorage.setItem("sb_uid", user?.id || "");
  }

  // ---------- safety ----------
  if (!sb) {
    console.error("Supabase client missing");
    return;
  }

  // ---------- confirm redirect ----------
  async function handleConfirmRedirect() {
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (!code) return;

      const { error } = await sb.auth.exchangeCodeForSession(window.location.href);
      if (error) {
        console.error(error);
        showMsg("❌ Не вдалося підтвердити email.", "err");
        return;
      }

      url.searchParams.delete("code");
      window.history.replaceState({}, document.title, url.toString());

      showMsg("✅ Email підтверджено! Тепер увійди з паролем.", "ok");
    } catch (e) {
      console.error(e);
    }
  }

  // ---------- tabs ----------
  function setupTabs() {
    document.addEventListener("click", (e) => {
      const tab = e.target.closest(".auth-tab");
      if (!tab) return;

      hideMsg();
      hideResend();

      const name = tab.dataset.tab;
      document.querySelectorAll(".auth-tab")
        .forEach(b => b.classList.toggle("active", b === tab));

      document.querySelectorAll("[data-pane]")
        .forEach(p => p.style.display = (p.dataset.pane === name) ? "" : "none");
    });
  }

  // ---------- password eye ----------
  function setupPasswordToggles() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".pw-toggle");
      if (!btn) return;

      const input = document.querySelector(btn.dataset.toggle);
      if (!input) return;

      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      btn.textContent = isHidden ? "🙈" : "👁";
    });
  }

  // ---------- FORGOT PASSWORD ----------
  async function onForgotPassword(e){
    e.preventDefault();
    hideMsg();

    const email = document.getElementById("loginEmail")?.value?.trim().toLowerCase();
    if (!email) return showMsg("Вкажи email у полі Email.");

    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: RESET_REDIRECT_TO
    });

    if (error) return showMsg(tAuthError(error.message), "err");

    showMsg("✅ Лист для скидання паролю надіслано. Перевір пошту.", "ok");
  }

  // ---------- LOGIN ----------
  async function onLoginSubmit(e) {
    e.preventDefault();
    hideMsg();

    const email = document.getElementById("loginEmail")?.value?.trim().toLowerCase();
    const password = document.getElementById("loginPass")?.value || "";

    if (!email || !password) return showMsg("Вкажи email та пароль.");

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return showMsg(tAuthError(error.message), "err");

    const user = data?.user;
    if (!isEmailConfirmed(user)) {
      await sb.auth.signOut();
      return showMsg("Пошта не підтверджена.", "err");
    }

    saveUserToLocalStorage(user);
    location.href = "profile.html";
  }

  // ---------- REGISTER ----------
  async function onRegisterSubmit(e) {
    e.preventDefault();
    hideMsg();

    const firstName = document.getElementById("regFirstName")?.value?.trim();
    const lastName  = document.getElementById("regLastName")?.value?.trim();
    const phone     = document.getElementById("regPhone")?.value?.trim();
    const email     = document.getElementById("regEmail")?.value?.trim().toLowerCase();
    const pass      = document.getElementById("regPass")?.value || "";
    const pass2     = document.getElementById("regPass2")?.value || "";

    if (!firstName || !lastName || !phone || !email || !pass)
      return showMsg("Заповни всі поля.");
    if (pass.length < 6)
      return showMsg("Пароль мінімум 6 символів.");
    if (pass !== pass2)
      return showMsg("Паролі не співпадають.");

    const { error } = await sb.auth.signUp({
      email,
      password: pass,
      options: {
        emailRedirectTo: REDIRECT_TO,
        data: { firstName, lastName, phone }
      }
    });

    if (error) return showMsg(tAuthError(error.message), "err");

    showMsg("✅ Ми надіслали лист для підтвердження email.", "ok");
    showResend(email);
    await sb.auth.signOut();
  }

  // ---------- RESEND ----------
  async function onResendClick() {
    hideMsg();

    const btn = document.getElementById("resendBtn");
    const email = btn?.dataset?.email || "";
    if (!email) return showMsg("Немає email для повтору.");

    const { error } = await sb.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: REDIRECT_TO }
    });

    if (error) return showMsg(tAuthError(error.message), "err");
    showMsg("✅ Лист надіслано ще раз.", "ok");
  }

  // ---------- INIT ----------
  document.addEventListener("DOMContentLoaded", async () => {
    setupTabs();
    setupPasswordToggles();
    await handleConfirmRedirect();

    const forgotBtn = document.getElementById("forgotBtn");
    if (forgotBtn) forgotBtn.addEventListener("click", onForgotPassword);

    const { data } = await sb.auth.getSession();
    if (data?.session) {
      const { data: uData } = await sb.auth.getUser();
      if (uData?.user) saveUserToLocalStorage(uData.user);
      location.href = "profile.html";
      return;
    }

    document.getElementById("loginForm")?.addEventListener("submit", onLoginSubmit);
    document.getElementById("registerForm")?.addEventListener("submit", onRegisterSubmit);
    document.getElementById("resendBtn")?.addEventListener("click", onResendClick);
  });
})();
