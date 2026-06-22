// ============================================
// أدوات مشتركة — نسخة الإنتاج
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
  el.innerHTML = `<span>${icons[type]||"ℹ️"}</span><span>${escapeHtml(message)}</span>`;
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
// مودال تأكيد الحذف المحترف — يُستخدم في كل الصفحات
// ============================================
let _confirmResolve = null;

function ensureConfirmModal() {
  if (document.getElementById("globalConfirmModal")) return;
  const el = document.createElement("div");
  el.innerHTML = `
    <div class="confirm-overlay" id="globalConfirmModal">
      <div class="confirm-box" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
        <div class="confirm-icon-wrap" id="confirmIconWrap">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="24" fill="var(--danger-bg)"/>
            <path d="M18 30L24 24M24 24L30 18M24 24L18 18M24 24L30 30" stroke="var(--danger)" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </div>
        <h3 id="confirmTitle" class="confirm-title">تأكيد الحذف</h3>
        <p class="confirm-msg" id="confirmMsg">هل أنت متأكد من هذا الإجراء؟</p>
        <div class="confirm-warning" id="confirmWarning">
          ⚠️ لا يمكن التراجع عن هذا الإجراء بعد تأكيده
        </div>
        <div class="confirm-actions">
          <button class="confirm-btn-cancel" id="confirmCancelBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            إلغاء
          </button>
          <button class="confirm-btn-ok" id="confirmOkBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            نعم، احذف
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el.firstElementChild);

  document.getElementById("confirmCancelBtn").addEventListener("click", () => {
    closeConfirmModal(false);
  });
  document.getElementById("confirmOkBtn").addEventListener("click", () => {
    closeConfirmModal(true);
  });
  document.getElementById("globalConfirmModal").addEventListener("click", (e) => {
    if (e.target.id === "globalConfirmModal") closeConfirmModal(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("globalConfirmModal")?.classList.contains("open")) {
      closeConfirmModal(false);
    }
  });
}

function closeConfirmModal(result) {
  const modal = document.getElementById("globalConfirmModal");
  if (modal) modal.classList.remove("open");
  if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
}

/**
 * يعرض مودال تأكيد احترافي ويرجع Promise<boolean>
 * @param {string} title - عنوان التأكيد
 * @param {string} message - نص الرسالة
 * @returns {Promise<boolean>}
 */
export function confirmAction(title = "تأكيد الحذف", message = "هل أنت متأكد؟") {
  ensureConfirmModal();
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMsg").textContent   = message;
  document.getElementById("globalConfirmModal").classList.add("open");
  return new Promise((resolve) => { _confirmResolve = resolve; });
}
