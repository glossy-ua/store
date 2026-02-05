// js/profile.js
// Требует: supabase-js + supabaseClient.js (window.sb)

(() => {
  const sb = window.sb;

  // ---------- DOM ----------
  const profileTitle = document.getElementById("profileTitle");
  const profileSub = document.getElementById("profileSub");

  const emailInput = document.getElementById("emailInput");
  const firstNameInput = document.getElementById("firstNameInput");
  const lastNameInput = document.getElementById("lastNameInput");
  const phoneInput = document.getElementById("phoneInput");
  const cityInput = document.getElementById("cityInput");
  

  const ordersList = document.getElementById("ordersList");
  const ordersEmpty = document.getElementById("ordersEmpty");

  const logoutBtn = document.getElementById("logoutBtn");
  const profileForm = document.getElementById("profileForm");
  const savedMsg = document.getElementById("savedMsg");

  let rtChannel = null;
  let ordersCache = [];

  // ---------- HELPERS ----------
  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function money(v) {
    const n = parseFloat(String(v).replace(",", ".").replace(/[^\d.]/g, "")) || 0;
    return n.toFixed(2);
  }

  function formatUA(dt) {
    try {
      return new Date(dt).toLocaleString("uk-UA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(dt || "");
    }
  }

  function statusLabel(s) {
    const map = {
      new: "Нове",
      processing: "В роботі",
      ready: "Готово",
      done: "Завершено",
      cancelled: "Скасовано",
    };
    return map[String(s || "new")] || "Нове";
  }

  // для CSS-бейджа в шапке (order-status-badge st-*)
  function statusClass(s) {
    const st = String(s || "new");
    if (st === "ready") return "st-ready";
    if (st === "processing") return "st-processing";
    if (st === "done") return "st-done";
    if (st === "cancelled") return "st-cancelled";
    return "st-new";
  }

  function fillProfile(userObj) {
    const fullName = [userObj.firstName, userObj.lastName].filter(Boolean).join(" ").trim();

    if (profileTitle) profileTitle.textContent = fullName || "Профіль";
    if (profileSub) profileSub.textContent = userObj.email || userObj.phone || "";

    if (emailInput) emailInput.value = userObj.email || "";
    if (firstNameInput) firstNameInput.value = userObj.firstName || "";
    if (lastNameInput) lastNameInput.value = userObj.lastName || "";
    if (phoneInput) phoneInput.value = userObj.phone || "";
    if (cityInput) cityInput.value = userObj.city || "";
    
  }

  // ---------- AUTH GUARD ----------
  async function requireUser() {
    if (!sb) {
      alert("Supabase client не підключений (window.sb). Перевір supabaseClient.js та порядок підключення.");
      return null;
    }

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

  // ---------- ORDERS ----------
  async function fetchOrdersFromSupabase(userId) {
    const { data, error } = await sb
      .from("orders")
      .select(`
        id,
        created_at,
        total,
        status,
        receiver_name,
        receiver_phone,
        receiver_city,
        receiver_post_office,
        receiver_comment,
        order_items (
          product_id,
          title,
          img,
          price,
          qty,
          sum
        )
      `)
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetchOrdersFromSupabase error:", error);
      return [];
    }

    return (data || []).map((o) => ({
      id: o.id,
      created_at: o.created_at,
      date: formatUA(o.created_at),
      total: Number(o.total || 0),
      status: String(o.status || "new"),
      receiver: {
        name: o.receiver_name,
        phone: o.receiver_phone,
        city: o.receiver_city,
        postOffice: o.receiver_post_office,
        comment: o.receiver_comment || "",
      },
      items: (o.order_items || []).map((i) => ({
        id: i.product_id,
        title: i.title,
        img: i.img || "",
        price: Number(i.price || 0),
        qty: parseInt(i.qty, 10) || 1,
        sum: Number(i.sum || 0),
      })),
    }));
  }

  async function renderOrdersFromSupabase(userId) {
    if (!ordersList || !ordersEmpty) return;

    ordersList.innerHTML = "";
    ordersEmpty.style.display = "none";

    const orders = await fetchOrdersFromSupabase(userId);
    ordersCache = orders;
    window.__ordersCache = orders; // если где-то ещё используешь

    if (!orders.length) {
      ordersEmpty.style.display = "block";
      ordersList.innerHTML = "";
      return;
    }

    ordersEmpty.style.display = "none";

    ordersList.innerHTML = orders
      .map((o, idx) => {
        const items = Array.isArray(o.items) ? o.items : [];
        const itemsCount = items.reduce((sum, i) => sum + (parseInt(i.qty, 10) || 1), 0);

        const statusText = statusLabel(o.status);
        const stCls = statusClass(o.status);

        const detailsHtml = items.length
          ? items
              .map((i) => {
                const qty = parseInt(i.qty, 10) || 1;
                const sum = i.sum ?? ((parseFloat(i.price) || 0) * qty);

                return `
                  <div class="order-item">
                    <div class="order-item__img">
                      <img src="${escapeHtml(i.img || "")}" alt="${escapeHtml(i.title || "")}">
                    </div>

                    <div class="order-item__text">
                      <div class="order-item__title">${escapeHtml(i.title || "")}</div>

                      <div class="order-item__code-line">
                        <span class="order-item__code-pill">Код: ${escapeHtml(i.id || "")}</span>
                        <span>${money(i.price)} грн × ${qty}</span>
                      </div>
                    </div>

                    <div class="order-item__sum">
                      ${money(sum)} грн.
                    </div>
                  </div>
                `;
              })
              .join("")
          : `<p class="muted">Немає позицій у цьому замовленні.</p>`;

        return `
          <article class="order-card" data-ord-idx="${idx}">
            <div class="order-head">
              <div class="order-info">
                <div class="order-title-row">
                  <strong>Замовлення #${escapeHtml(o.id || "—")}</strong>
                  <span class="order-date-inline">${escapeHtml(o.date || "")}</span>
                  <span class="order-status-badge ${stCls}">${escapeHtml(statusText)}</span>
                </div>
              </div>

              <div class="order-actions">
                <button class="btn btn-light order-toggle" type="button" data-open="0">
                  Детальніше
                </button>
                <button class="btn order-repeat" type="button" data-ord-idx="${idx}">
                  Повторити
                </button>
              </div>
            </div>

            <div class="order-body">
              <div class="muted">Сума:</div>
              <div><strong>${money(o.total)} грн.</strong></div>

              <div class="muted">Товарів:</div>
              <div><strong>${itemsCount}</strong></div>
            </div>

            <div class="order-details" style="display:none;">
              ${detailsHtml}
            </div>
          </article>
        `;
      })
      .join("");
  }

  // ---------- REPEAT ORDER TO CART ----------
  function addOrderToCart(order) {
    const items = Array.isArray(order?.items) ? order.items : [];
    if (!items.length) return false;

    const cart = typeof getCart === "function"
      ? getCart()
      : JSON.parse(localStorage.getItem("cart") || "[]");

    items.forEach((i) => {
      const id = String(i.id || "");
      if (!id) return;

      const qty = parseInt(i.qty, 10) || 1;
      const price = (i.price != null) ? String(i.price) : String(i.sum || "");

      const found = cart.find((p) => String(p.id) === id);
      if (found) {
        found.qty = (parseInt(found.qty, 10) || 0) + qty;
        found.title = found.title || (i.title || "");
        found.img = found.img || (i.img || "");
        found.price = found.price || price;
      } else {
        cart.push({ id, title: i.title || "", price, img: i.img || "", qty });
      }
    });

    if (typeof setCart === "function") setCart(cart);
    else localStorage.setItem("cart", JSON.stringify(cart));

    if (typeof updateCartBadge === "function") updateCartBadge();
    return true;
  }

  // ---------- EVENTS ----------
  document.addEventListener("click", (e) => {
    const toggleBtn = e.target.closest(".order-toggle");
    if (toggleBtn) {
      const card = toggleBtn.closest(".order-card");
      const details = card?.querySelector(".order-details");
      if (!details) return;

      const opened = toggleBtn.dataset.open === "1";
      details.style.display = opened ? "none" : "block";
      toggleBtn.dataset.open = opened ? "0" : "1";
      toggleBtn.textContent = opened ? "Детальніше" : "Згорнути";
      return;
    }

    const repeatBtn = e.target.closest(".order-repeat");
    if (repeatBtn) {
      const idx = parseInt(repeatBtn.dataset.ordIdx, 10);
      if (!Number.isFinite(idx)) return;

      const order = ordersCache[idx];
      if (!order) return;

      const ok = addOrderToCart(order);
      if (!ok) return alert("У цьому замовленні немає товарів.");

      location.href = "cart.html";
    }
  });

  // ---------- SAVE PROFILE ----------
  profileForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const updated = {
      firstName: firstNameInput?.value.trim() || "",
      lastName: lastNameInput?.value.trim() || "",
      phone: phoneInput?.value.trim() || "",
      city: cityInput?.value.trim() || "",
      
    };

    const { error } = await sb.auth.updateUser({ data: { ...updated } });

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    if (savedMsg) {
      savedMsg.style.display = "block";
      setTimeout(() => (savedMsg.style.display = "none"), 1200);
    }
  });

  // ---------- LOGOUT ----------
  logoutBtn?.addEventListener("click", async () => {
    try { await sb.auth.signOut(); } catch {}

    localStorage.removeItem("user");
    localStorage.removeItem("sb_uid");

    location.href = "auth.html";
  });

  // ---------- REALTIME (status sync) ----------
  function subscribeOrdersRealtime(userId) {
    // Если админ меняет status в orders — прилетит UPDATE и мы перерисуем список
    rtChannel = sb
      .channel("orders-status-watch")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `owner_id=eq.${userId}` },
        () => renderOrdersFromSupabase(userId)
      )
      .subscribe();
  }

  // ---------- INIT ----------
  document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireUser();
    if (!user) return;

    const md = user.user_metadata || {};
    fillProfile({
      email: user.email || "",
      firstName: md.firstName || "",
      lastName: md.lastName || "",
      phone: md.phone || "",
      city: md.city || "",
      
    });

    await renderOrdersFromSupabase(user.id);
    subscribeOrdersRealtime(user.id);
  });

  window.addEventListener("beforeunload", () => {
    try { if (rtChannel) sb.removeChannel(rtChannel); } catch {}
  });
})();
