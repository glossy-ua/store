// js/reset.js

(() => {
  const sb = window.sb;

  const $msg = document.getElementById("resetMsg");
  const $form = document.getElementById("resetForm");
  const $loading = document.getElementById("resetLoading");

  const $p1 = document.getElementById("newPass");
  const $p2 = document.getElementById("newPass2");

  function showMsg(text, type = "err") {
    if (!$msg) return alert(text);
    $msg.className = "auth-msg " + (type === "ok" ? "ok" : "err");
    $msg.textContent = text;
    $msg.style.display = "block";
  }

  function setLoading(on) {
    if ($loading) $loading.style.display = on ? "" : "none";
  }

  function setFormVisible(on) {
    if ($form) $form.style.display = on ? "" : "none";
  }

  // глазик как на auth
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".pw-toggle");
    if (!btn) return;
    const input = document.querySelector(btn.dataset.toggle);
    if (!input) return;

    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    btn.textContent = isHidden ? "🙈" : "👁";
  });

  async function ensureSessionFromUrl() {
    // Supabase может прислать либо #access_token... (recovery),
    // либо ?code=... (PKCE). Обработаем оба.
    const url = new URL(window.location.href);
    const hasCode = url.searchParams.get("code");
    const hasHashToken = (window.location.hash || "").includes("access_token=");

    if (hasCode) {
      const { error } = await sb.auth.exchangeCodeForSession(window.location.href);
      if (error) throw error;

      url.searchParams.delete("code");
      window.history.replaceState({}, document.title, url.toString());
      return;
    }

    if (hasHashToken) {
      // Обычно клиент сам подхватывает, но на всякий — просто дернем getSession
      await sb.auth.getSession();
      return;
    }
  }

  async function init() {
    if (!sb) {
      showMsg("❌ Supabase client не знайдено.", "err");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setFormVisible(false);

      await ensureSessionFromUrl();

      const { data } = await sb.auth.getSession();
      const session = data?.session;

      if (!session) {
        showMsg("❌ Посилання недійсне або прострочене. Запроси скидання паролю ще раз.", "err");
        setLoading(false);
        return;
      }

      // всё ок — показываем форму
      setLoading(false);
      setFormVisible(true);
    } catch (e) {
      console.error(e);
      showMsg("❌ Не вдалося перевірити посилання. Спробуй ще раз.", "err");
      setLoading(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    $msg.style.display = "none";

    const p1 = ($p1?.value || "").trim();
    const p2 = ($p2?.value || "").trim();

    if (p1.length < 6) return showMsg("Пароль мінімум 6 символів.", "err");
    if (p1 !== p2) return showMsg("Паролі не співпадають.", "err");

    try {
      setLoading(true);

      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) throw error;

      showMsg("✅ Пароль змінено. Тепер увійди з новим паролем.", "ok");

      // по красоте: завершить recovery-сессию
      await sb.auth.signOut();

      setTimeout(() => {
        window.location.href = "auth.html";
      }, 900);
    } catch (e) {
      console.error(e);
      showMsg("❌ Не вдалося змінити пароль. Спробуй ще раз.", "err");
    } finally {
      setLoading(false);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    init();
    $form?.addEventListener("submit", onSubmit);
  });
})();
