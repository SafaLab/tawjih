// ============================================
// أدوات مشتركة — نسخة الإنتاج النهائية
// ============================================

export function showToast(message, type = "success") {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const icons = { success: "✅", error: "⚠️", info: "ℹ️" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${escapeHtml(message)}</span>`;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

export function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("open");
}
export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("open");
}
export function bindModalDismiss() {
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("open");
    });
    overlay.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => overlay.classList.remove("open"));
    });
  });
}

export function formatDate(dateInput) {
  if (!dateInput) return "—";
  const d = dateInput?.toDate ? dateInput.toDate() : new Date(dateInput);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
}

export function timeAgo(dateInput) {
  if (!dateInput) return "—";
  const d = dateInput?.toDate ? dateInput.toDate() : new Date(dateInput);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return formatDate(d);
}

export function initials(name = "") {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[1][0];
}

export function bindSidebarToggle() {
  const toggle   = document.querySelector(".menu-toggle");
  const sidebar  = document.querySelector(".sidebar");
  const backdrop = document.querySelector(".sidebar-backdrop");
  if (!toggle || !sidebar) return;
  toggle.addEventListener("click", () => {
    sidebar.classList.add("open");
    backdrop?.classList.add("show");
  });
  backdrop?.addEventListener("click", () => {
    sidebar.classList.remove("open");
    backdrop.classList.remove("show");
  });
}

export function isOverdue(task) {
  if (!task.dueDate || task.status === "done") return false;
  const due = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
  return due.getTime() < Date.now();
}

export const TASK_TYPES = ["زيارة ميدانية", "تقرير", "متابعة تظلم", "تدريب", "اجتماع", "أخرى"];

export const STATUS_LABELS = {
  pending:     { text: "لم يبدأ",      cls: "badge-warning", emoji: "🕓" },
  in_progress: { text: "جاري التنفيذ", cls: "badge-info",    emoji: "🔄" },
  done:        { text: "منجزة",        cls: "badge-success",  emoji: "✅" },
};

// ============================================
// confirmAction — مودال التأكيد العالمي
// يعتمد على #globalConfirmModal الموجود في كل صفحة HTML
// ============================================
let _confirmResolve = null;

export function confirmAction(title = "تأكيد الحذف", message = "هل أنت متأكد؟") {
  return new Promise((resolve) => {
    _confirmResolve = resolve;

    const modal   = document.getElementById("globalConfirmModal");
    const titleEl = document.getElementById("gcTitle");
    const msgEl   = document.getElementById("gcMsg");

    if (!modal) {
      // fallback لو HTML مش فيه الـ modal
      resolve(window.confirm(message));
      return;
    }

    if (titleEl) titleEl.textContent = title;
    if (msgEl)   msgEl.textContent   = message;

    modal.classList.add("open");
    document.getElementById("gcOkBtn")?.focus();
  });
}

// ربط أزرار الـ confirm modal — يُستدعى مرة واحدة بعد DOMContentLoaded
export function bindConfirmModal() {
  const modal = document.getElementById("globalConfirmModal");
  if (!modal) return;

  function resolve(result) {
    modal.classList.remove("open");
    if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
  }

  document.getElementById("gcCancelBtn")?.addEventListener("click", () => resolve(false));
  document.getElementById("gcOkBtn")?.addEventListener("click",     () => resolve(true));
  modal.addEventListener("click", (e) => { if (e.target === modal) resolve(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) resolve(false);
  });
}
