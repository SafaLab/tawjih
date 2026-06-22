// ============================================
// إدارة الموجّهين التابعين لهذا المسؤول
// ============================================
import { guardPage, logout } from "../auth.js";
import {
  db, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy,
} from "../firebase-config.js";
import { showToast, openModal, closeModal, bindModalDismiss, initials, escapeHtml, confirmAction, bindConfirmModal } from "../utils.js";

const profile = await guardPage("supervisor");
document.getElementById("userName").textContent = profile.name;
document.getElementById("userRole").textContent = profile.supervisionName || "موجّه عام";
document.getElementById("userAvatar").textContent = initials(profile.name);
document.getElementById("logoutBtn").addEventListener("click", logout);
bindModalDismiss();
bindConfirmModal();

let allMembers = [];
let allTasksCountMap = {};
let editingId = null;

async function loadMembers() {
  const q = query(collection(db, "members"), where("supervisorId", "==", profile.uid));
  const snap = await getDocs(q);
  allMembers = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return db2 - da;
    });

  // عدد المهام لكل موجّه (لعرضه في الجدول)
  const tasksSnap = await getDocs(query(collection(db, "tasks"), where("supervisorId", "==", profile.uid)));
  allTasksCountMap = {};
  tasksSnap.docs.forEach((d) => {
    const t = d.data();
    allTasksCountMap[t.memberId] = (allTasksCountMap[t.memberId] || 0) + 1;
  });

  renderTable(allMembers);
}

function renderTable(members) {
  const tbody = document.getElementById("membersBody");
  const emptyBox = document.getElementById("emptyState");

  if (members.length === 0) {
    tbody.innerHTML = "";
    emptyBox.classList.remove("hidden");
    return;
  }
  emptyBox.classList.add("hidden");

  tbody.innerHTML = members.map((m) => `
    <tr>
      <td data-label="الاسم">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="avatar">${initials(m.name)}</div>
          <div>
            <div style="font-weight:700">${escapeHtml(m.name)}</div>
            <div style="color:var(--text-dim);font-size:12px">${escapeHtml(m.school || "—")}</div>
          </div>
        </div>
      </td>
      <td data-label="الهاتف">${escapeHtml(m.phone || "—")}</td>
      <td data-label="عدد المهام">${allTasksCountMap[m.id] || 0}</td>
      <td data-label="إجراءات">
        <div style="display:flex;gap:8px">
          <button class="btn btn-icon btn-secondary" data-edit="${m.id}" title="تعديل">✏️</button>
          <button class="btn btn-icon btn-danger" data-del="${m.id}" title="حذف">🗑️</button>
        </div>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openEdit(b.dataset.edit)));
  tbody.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => deleteMember(b.dataset.del)));
}

function openEdit(id) {
  const m = allMembers.find((x) => x.id === id);
  editingId = id;
  document.getElementById("modalTitle").textContent = "تعديل بيانات الموجّه ✏️";
  document.getElementById("mName").value = m.name || "";
  document.getElementById("mSchool").value = m.school || "";
  document.getElementById("mPhone").value = m.phone || "";
  openModal("memberModal");
}

async function deleteMember(id) {
  const m = allMembers.find(x => x.id === id);
  const ok = await confirmAction(
    "حذف الموجّه",
    `هل أنت متأكد من حذف "${m?.name || "هذا الموجّه"}"؟ المهام المرتبطة به ستبقى موجودة بدون ارتباط.`
  );
  if (!ok) return;
  try {
    await deleteDoc(doc(db, "members", id));
    showToast("تم حذف الموجّه بنجاح");
    loadMembers();
  } catch (e) {
    showToast("حصل خطأ أثناء الحذف", "error");
  }
}

document.getElementById("addMemberBtn").addEventListener("click", () => {
  editingId = null;
  document.getElementById("modalTitle").textContent = "إضافة موجّه جديد ➕";
  document.getElementById("memberForm").reset();
  openModal("memberModal");
});

document.getElementById("memberForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    name: document.getElementById("mName").value.trim(),
    school: document.getElementById("mSchool").value.trim(),
    phone: document.getElementById("mPhone").value.trim(),
  };
  if (!data.name) return;

  const saveBtn = document.getElementById("saveMemberBtn");
  saveBtn.disabled = true;
  try {
    if (editingId) {
      await updateDoc(doc(db, "members", editingId), data);
      showToast("تم تحديث البيانات بنجاح");
    } else {
      await addDoc(collection(db, "members"), {
        ...data,
        supervisorId: profile.uid,
        supervisorName: profile.supervisionName || profile.name,
        createdAt: serverTimestamp(),
      });
      showToast("تمت إضافة الموجّه بنجاح");
    }
    closeModal("memberModal");
    loadMembers();
  } catch (err) {
    showToast("حصل خطأ، حاول تاني", "error");
  } finally {
    saveBtn.disabled = false;
  }
});

document.getElementById("searchInput").addEventListener("input", (e) => {
  const term = e.target.value.trim().toLowerCase();
  const filtered = allMembers.filter((m) =>
    m.name.toLowerCase().includes(term) || (m.school || "").toLowerCase().includes(term)
  );
  renderTable(filtered);
});

loadMembers();
