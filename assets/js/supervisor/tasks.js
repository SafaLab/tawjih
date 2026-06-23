// ============================================
// إدارة المهام الخاصة بهذا المسؤول
// ============================================
import { guardPage, logout } from "../auth.js";
import {
  db, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, orderBy, Timestamp,
} from "../firebase-config.js";
import {
  showToast, openModal, closeModal, bindModalDismiss, initials, escapeHtml,
  formatDate, STATUS_LABELS, TASK_TYPES, isOverdue, confirmAction, bindConfirmModal,
} from "../utils.js";

const profile = await guardPage("supervisor");
document.getElementById("userName").textContent = profile.name;
document.getElementById("userRole").textContent = profile.supervisionName || "موجّه عام";
document.getElementById("userAvatar").textContent = initials(profile.name);
document.getElementById("logoutBtn").addEventListener("click", logout);
bindModalDismiss();
bindConfirmModal();

let allTasks = [];
let allMembers = [];
let editingId = null;

// تعبئة أنواع المهام في القائمة المنسدلة
const typeSelect = document.getElementById("tType");
TASK_TYPES.forEach((t) => {
  const opt = document.createElement("option");
  opt.value = t; opt.textContent = t;
  typeSelect.appendChild(opt);
});

async function loadMembers() {
  const snap = await getDocs(query(collection(db, "members"), where("supervisorId", "==", profile.uid)));
  allMembers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const memberSelect = document.getElementById("tMember");
  const filterSelect = document.getElementById("filterMember");
  memberSelect.innerHTML = '<option value="">اختر الموجّه</option>';
  filterSelect.innerHTML = '<option value="">كل الموجّهين</option>';
  allMembers.forEach((m) => {
    memberSelect.innerHTML += `<option value="${m.id}">${escapeHtml(m.name)}</option>`;
    filterSelect.innerHTML += `<option value="${m.id}">${escapeHtml(m.name)}</option>`;
  });
}

async function loadTasks() {
  // ملاحظة: بدون orderBy في الـ query لتجنب الحاجة لـ Composite Index في Firestore
  // الترتيب بيتم في JavaScript
  const q = query(collection(db, "tasks"), where("supervisorId", "==", profile.uid));
  const snap = await getDocs(q);
  allTasks = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return db2 - da;
    });
  applyFilters();
}

function applyFilters() {
  const statusVal = document.getElementById("filterStatus").value;
  const memberVal = document.getElementById("filterMember").value;
  const searchVal = (document.getElementById("searchTasks")?.value || "").trim().toLowerCase();
  let filtered = allTasks;
  if (statusVal) filtered = filtered.filter((t) => t.status === statusVal);
  if (memberVal) filtered = filtered.filter((t) => t.memberId === memberVal);
  if (searchVal) filtered = filtered.filter((t) =>
    (t.title || "").toLowerCase().includes(searchVal) ||
    (t.memberName || "").toLowerCase().includes(searchVal) ||
    (t.type || "").toLowerCase().includes(searchVal)
  );
  renderTable(filtered);
}

function renderTable(tasks) {
  const tbody = document.getElementById("tasksBody");
  const emptyBox = document.getElementById("emptyState");

  if (tasks.length === 0) {
    tbody.innerHTML = "";
    emptyBox.classList.remove("hidden");
    return;
  }
  emptyBox.classList.add("hidden");

  tbody.innerHTML = tasks.map((t) => {
    const s = STATUS_LABELS[t.status] || STATUS_LABELS.pending;
    const overdue = isOverdue(t);
    return `
    <tr>
      <td data-label="المهمة">
        <div style="font-weight:700">${escapeHtml(t.title)}</div>
        <div style="color:var(--text-dim);font-size:12px">${escapeHtml(t.type || "")}</div>
      </td>
      <td data-label="الموجّه">${escapeHtml(t.memberName || "—")}</td>
      <td data-label="الموعد">
        ${formatDate(t.dueDate)}
        ${overdue ? '<span class="badge badge-danger" style="margin-right:6px">⏰ متأخرة</span>' : ""}
      </td>
      <td data-label="الحالة">
        <select class="status-select" data-id="${t.id}" style="background:var(--bg-soft);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:6px 10px;font-size:12.5px">
          <option value="pending" ${t.status === "pending" ? "selected" : ""}>🕓 لم يبدأ</option>
          <option value="in_progress" ${t.status === "in_progress" ? "selected" : ""}>🔄 جاري التنفيذ</option>
          <option value="done" ${t.status === "done" ? "selected" : ""}>✅ منجزة</option>
        </select>
      </td>
      <td data-label="إجراءات">
        <div style="display:flex;gap:8px">
          <button class="btn btn-icon btn-secondary" data-edit="${t.id}" title="تعديل">✏️</button>
          <button class="btn btn-icon btn-danger" data-del="${t.id}" title="حذف">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll(".status-select").forEach((sel) => {
    sel.addEventListener("change", () => updateStatus(sel.dataset.id, sel.value));
  });
  tbody.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openEdit(b.dataset.edit)));
  tbody.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => deleteTask(b.dataset.del)));
}

async function updateStatus(id, status) {
  // تأكيد قبل تحديد المهمة كمنجزة
  if (status === "done") {
    const t = allTasks.find(x => x.id === id);
    const ok = await confirmAction(
      "تأكيد الإنجاز ✅",
      `هل تأكدت من إنجاز مهمة "${t?.title || 'هذه المهمة'}"؟`
    );
    if (!ok) {
      // إعادة الـ select للقيمة القديمة
      const sel = document.querySelector(`.status-select[data-id="${id}"]`);
      if (sel) sel.value = t?.status || "pending";
      return;
    }
  }
  // Optimistic update - تحديث الـ UI فوراً
  const taskIdx = allTasks.findIndex(x => x.id === id);
  const oldStatus = allTasks[taskIdx]?.status;
  if (taskIdx > -1) allTasks[taskIdx].status = status;

  try {
    const payload = { status };
    if (status === "done") payload.completedAt = serverTimestamp();
    await updateDoc(doc(db, "tasks", id), payload);
    showToast(status === "done" ? "أحسنت! تم تسجيل الإنجاز ✅" : "تم تحديث الحالة");
  } catch (e) {
    // rollback عند الفشل
    if (taskIdx > -1) allTasks[taskIdx].status = oldStatus;
    applyFilters();
    showToast("حصل خطأ أثناء التحديث", "error");
  }
}

function openEdit(id) {
  const t = allTasks.find((x) => x.id === id);
  editingId = id;
  document.getElementById("modalTitle").textContent = "تعديل المهمة ✏️";
  document.getElementById("tTitle").value = t.title || "";
  document.getElementById("tType").value = t.type || "";
  document.getElementById("tMember").value = t.memberId || "";
  document.getElementById("tDesc").value = t.description || "";
  document.getElementById("tDue").value = t.dueDate ? toInputDate(t.dueDate) : "";
  openModal("taskModal");
}

function toInputDate(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(0, 10);
}

async function deleteTask(id) {
  const t = allTasks.find(x => x.id === id);
  const ok = await confirmAction(
    "حذف المهمة",
    `هل أنت متأكد من حذف مهمة "${t?.title || "هذه المهمة"}"؟`
  );
  if (!ok) return;
  try {
    await deleteDoc(doc(db, "tasks", id));
    showToast("تم حذف المهمة بنجاح");
    loadTasks();
  } catch (e) {
    showToast("حصل خطأ أثناء الحذف", "error");
  }
}

document.getElementById("addTaskBtn").addEventListener("click", () => {
  editingId = null;
  document.getElementById("modalTitle").textContent = "إضافة مهمة جديدة ➕";
  document.getElementById("taskForm").reset();
  openModal("taskModal");
});

document.getElementById("taskForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const memberId = document.getElementById("tMember").value;
  const member = allMembers.find((m) => m.id === memberId);
  const dueRaw = document.getElementById("tDue").value;

  const data = {
    title: document.getElementById("tTitle").value.trim(),
    type: document.getElementById("tType").value,
    description: document.getElementById("tDesc").value.trim(),
    memberId,
    memberName: member ? member.name : "",
    dueDate: dueRaw ? Timestamp.fromDate(new Date(dueRaw)) : null,
  };
  if (!data.title || !memberId) {
    showToast("لازم تحدد عنوان المهمة والموجّه", "error");
    return;
  }

  const saveBtn = document.getElementById("saveTaskBtn");
  saveBtn.disabled = true;
  try {
    if (editingId) {
      await updateDoc(doc(db, "tasks", editingId), data);
      showToast("تم تحديث المهمة بنجاح");
    } else {
      await addDoc(collection(db, "tasks"), {
        ...data,
        status: "pending",
        supervisorId: profile.uid,
        supervisorName: profile.supervisionName || profile.name,
        createdAt: serverTimestamp(),
      });
      showToast("تمت إضافة المهمة بنجاح");
    }
    closeModal("taskModal");
    loadTasks();
  } catch (err) {
    showToast("حصل خطأ، حاول تاني", "error");
  } finally {
    saveBtn.disabled = false;
  }
});

document.getElementById("filterStatus").addEventListener("change", applyFilters);
document.getElementById("filterMember").addEventListener("change", applyFilters);

// بحث نصي في المهام
document.getElementById("searchTasks")?.addEventListener("input", applyFilters);

await loadMembers();
loadTasks();
