// js/supabaseClient.js
(function () {
  // единый конфиг для всего проекта
  window.SUPABASE_URL = window.SUPABASE_URL || "https://fxaleremdkamkimuyoai.supabase.co";
  window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4YWxlcmVtZGthbWtpbXV5b2FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTM1MTUsImV4cCI6MjA4NTM4OTUxNX0.3oJ0LCLdsD8PnewKyITY_EseY0KK9uyvdNXiqk3fIxE";

  if (!window.supabase?.createClient) {
    console.warn("[supabaseClient] Supabase SDK not loaded (cdn).");
    return;
  }

  // чтобы не создавать 100 клиентов
  window.sb = window.sb || window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
})();
