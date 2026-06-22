// ============================================
// التحكم في الثيم (فاتح/داكن) — الفاتح هو الافتراضي
// ============================================
const STORAGE_KEY = "tawjih_theme";

export function getStoredTheme() {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "dark" ? "dark" : v === "light" ? "light" : null;
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
}

// تُستخدم في كل صفحة لتثبيت الثيم المحفوظ (الفاتح افتراضيًا لو مفيش تفضيل محفوظ)
export function initTheme() {
  const theme = getStoredTheme() || "light";
  applyTheme(theme);
  return theme;
}

export function getCurrentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function toggleTheme() {
  const next = getCurrentTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(STORAGE_KEY, next);
  return next;
}

function updateButtonUI(buttonEl) {
  const isDark = getCurrentTheme() === "dark";
  buttonEl.textContent = isDark ? "☀️" : "🌙";
  buttonEl.setAttribute("aria-label", isDark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن");
  buttonEl.title = isDark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن";
}

// تربط زرار تبديل الثيم بحدث الضغط، وتحدّث شكله (🌙/☀️) فورًا
export function bindThemeToggle(buttonEl) {
  if (!buttonEl) return;
  updateButtonUI(buttonEl);
  buttonEl.addEventListener("click", () => {
    toggleTheme();
    updateButtonUI(buttonEl);
  });
}
