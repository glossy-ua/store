// js/contact.js
(() => {
  const form = document.getElementById("contactForm");
  if (!form) return;

  const nameEl = document.getElementById("cfName");
  const phoneEl = document.getElementById("cfPhone");
  const emailEl = document.getElementById("cfEmail");
  const msgEl = document.getElementById("cfMessage");
  const outEl = document.getElementById("cfMsg");

  const FN_URL = "https://fxaleremdkamkimuyoai.supabase.co/functions/v1/notify-telegram";
  const CONTACT_SECRET = "contact_v1_glossy"; // <-- твой secret

  function setMsg(text, ok = true) {
    if (!outEl) return;
    outEl.textContent = text || "";
    outEl.style.color = ok ? "" : "#c00";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      kind: "contact",
      name: (nameEl?.value || "").trim(),
      phone: (phoneEl?.value || "").trim(),
      email: (emailEl?.value || "").trim(),
      message: (msgEl?.value || "").trim(),
    };

    if (!payload.name) return setMsg("Вкажи ім’я", false);
    if (!payload.email) return setMsg("Вкажи email", false);

    setMsg("Відправляємо...");

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
        return setMsg("Помилка: " + (json?.error || "Edge Function error"), false);
      }

      form.reset();
      setMsg("✅ Заявку відправлено! Ми зв’яжемось з тобою найближчим часом.");
    } catch (err) {
      console.error(err);
      setMsg("Помилка мережі/серверу", false);
    }
  });
})();
