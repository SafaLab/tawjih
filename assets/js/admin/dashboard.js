// ============================================
// لوحة المدير العام — نسخة محسّنة مع تفاصيل كاملة وتصدير Excel
// ============================================
import { guardPage, logout } from "../auth.js";
import {
  app, db, initializeApp, deleteApp, getAuth, createUserWithEmailAndPassword,
  collection, getDocs, query, where, doc, setDoc, serverTimestamp, deleteDoc,
} from "../firebase-config.js";
import {
  showToast, openModal, closeModal, bindModalDismiss, initials, escapeHtml, isOverdue, formatDate, confirmAction,
} from "../utils.js";

const profile = await guardPage("admin");
document.getElementById("userName").textContent = profile.name;
document.getElementById("userAvatar").textContent = initials(profile.name);
document.getElementById("logoutBtn").addEventListener("click", logout);
bindModalDismiss();

let supervisors = [];
let allMembers = [];
let allTasks = [];

// ===== تحميل البيانات =====
async function loadAll() {
  const [usersSnap, membersSnap, tasksSnap] = await Promise.all([
    getDocs(query(collection(db, "users"), where("role", "==", "supervisor"))),
    getDocs(collection(db, "members")),
    getDocs(collection(db, "tasks")),
  ]);

  supervisors = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  allMembers  = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  allTasks    = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  renderStats();
  renderSupervisors();
  renderLeaderboard();
  renderLateTasks();
}

// ===== الإحصاءات =====
function renderStats() {
  const done       = allTasks.filter(t => t.status === "done").length;
  const inProgress = allTasks.filter(t => t.status === "in_progress").length;
  const late       = allTasks.filter(t => isOverdue(t)).length;
  const total      = allTasks.length;

  document.getElementById("statSupervisors").textContent = supervisors.length;
  document.getElementById("statMembers").textContent     = allMembers.length;
  document.getElementById("statTasks").textContent       = total;
  document.getElementById("statDone").textContent        = done;
  document.getElementById("statInProgress").textContent  = inProgress;
  document.getElementById("statLate").textContent        = late;
  document.getElementById("statDonePct").textContent     = total ? Math.round(done/total*100) + "% من الإجمالي" : "—";
  document.getElementById("statLatePct").textContent     = total ? Math.round(late/total*100) + "% من الإجمالي" : "—";
}

// ===== جدول التوجيهات مع الصفوف القابلة للتوسع =====
function renderSupervisors() {
  const tbody    = document.getElementById("supervisorsBody");
  const emptyBox = document.getElementById("emptyState");

  if (supervisors.length === 0) {
    tbody.innerHTML = "";
    emptyBox.classList.remove("hidden");
    return;
  }
  emptyBox.classList.add("hidden");

  const rows = supervisors.map((s) => {
    const sMembers = allMembers.filter(m => m.supervisorId === s.id);
    const sTasks   = allTasks.filter(t => t.supervisorId === s.id);
    const done     = sTasks.filter(t => t.status === "done").length;
    const late     = sTasks.filter(t => isOverdue(t)).length;
    const pct      = sTasks.length ? Math.round(done / sTasks.length * 100) : 0;

    let statusBadge = `<span class="badge badge-success">🟢 على المسار</span>`;
    if (late > 0)          statusBadge = `<span class="badge badge-danger">🔴 متأخر</span>`;
    else if (!sTasks.length) statusBadge = `<span class="badge badge-warning">🟡 بدون نشاط</span>`;

    return { s, sMembers, sTasks, done, late, pct, statusBadge };
  }).sort((a, b) => b.pct - a.pct);

  tbody.innerHTML = rows.map(({ s, sMembers, sTasks, done, late, pct, statusBadge }) => {
    // بناء تفاصيل الموجّهين
    const membersHtml = sMembers.length === 0
      ? `<div style="color:var(--text-dim);font-size:13px;padding:8px 0">لا يوجد موجّهون مضافون بعد</div>`
      : sMembers.map(m => {
          const mTasks   = sTasks.filter(t => t.memberId === m.id);
          const mDone    = mTasks.filter(t => t.status === "done").length;
          const mLate    = mTasks.filter(t => isOverdue(t)).length;
          const mPending = mTasks.filter(t => t.status === "pending").length;
          return `
            <div class="mini-member-row">
              <div class="avatar" style="width:34px;height:34px;font-size:12px;flex-shrink:0">${initials(m.name)}</div>
              <div class="mini-member-info">
                <div class="mini-member-name">${escapeHtml(m.name)}</div>
                <div class="mini-member-sub">${escapeHtml(m.school || "—")} ${m.phone ? "· " + escapeHtml(m.phone) : ""}</div>
              </div>
              <div class="mini-member-stats">
                <span class="mini-badge done">✅ ${mDone}</span>
                ${mLate ? `<span class="mini-badge late">⏰ ${mLate}</span>` : ""}
                ${mPending ? `<span class="mini-badge pending">🕓 ${mPending}</span>` : ""}
              </div>
            </div>`;
        }).join("");

    // بناء تفاصيل المهام (آخر 5 فقط + رسالة لو في أكتر)
    const lateTasks   = sTasks.filter(t => isOverdue(t));
    const activeTasks = sTasks.filter(t => t.status !== "done" && !isOverdue(t)).slice(0,3);
    const tasksHtml = sTasks.length === 0
      ? `<div style="color:var(--text-dim);font-size:13px;padding:8px 0">لا توجد مهام</div>`
      : [
          ...lateTasks.map(t => `
            <div class="mini-task-row" style="border-color:var(--danger)">
              <span style="font-size:16px">⏰</span>
              <div>
                <div class="mini-task-title">${escapeHtml(t.title)}</div>
                <div class="mini-task-meta">${escapeHtml(t.memberName||"—")} · موعدها ${formatDate(t.dueDate)} <span class="badge badge-danger" style="font-size:10px">متأخرة</span></div>
              </div>
            </div>`),
          ...activeTasks.map(t => `
            <div class="mini-task-row">
              <span style="font-size:16px">${t.status === "in_progress" ? "🔄" : "🕓"}</span>
              <div>
                <div class="mini-task-title">${escapeHtml(t.title)}</div>
                <div class="mini-task-meta">${escapeHtml(t.memberName||"—")} · موعدها ${formatDate(t.dueDate)}</div>
              </div>
            </div>`),
          sTasks.length > (lateTasks.length + 3)
            ? `<div style="font-size:12px;color:var(--text-dim);padding:6px 10px">و ${sTasks.length - lateTasks.length - 3} مهمة أخرى...</div>`
            : "",
        ].join("");

    return `
      <tr class="supervisor-row-main" data-id="${s.id}">
        <td style="width:32px;padding:12px 4px">
          <button class="expand-btn" data-expand="${s.id}" title="عرض التفاصيل">▾</button>
        </td>
        <td data-label="التوجيه">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="avatar">${initials(s.name)}</div>
            <div>
              <div style="font-weight:700">${escapeHtml(s.supervisionName || s.name)}</div>
              <div style="color:var(--text-dim);font-size:12px">${escapeHtml(s.name)} · ${escapeHtml(s.email)}</div>
            </div>
          </div>
        </td>
        <td data-label="الموجّهون">${sMembers.length}</td>
        <td data-label="المهام">${sTasks.length}</td>
        <td data-label="نسبة الإنجاز">
          <div style="min-width:100px">
            <div style="font-weight:800;font-size:14px;margin-bottom:4px">${pct}%</div>
            <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:3px">${done} من ${sTasks.length}</div>
          </div>
        </td>
        <td data-label="متأخرة">${late > 0 ? `<span style="color:var(--danger);font-weight:800">${late}</span>` : "0"}</td>
        <td data-label="الحالة">${statusBadge}</td>
        <td data-label="إجراءات">
          <button class="btn btn-icon btn-danger" data-del="${s.id}" title="حذف الحساب">🗑️</button>
        </td>
      </tr>
      <tr class="supervisor-details-row" id="details-${s.id}">
        <td colspan="8" style="padding:0 12px 12px">
          <div class="supervisor-details-panel">
            <div class="details-grid">
              <div>
                <div class="details-section-title">👥 الموجّهون والأخصائيون (${sMembers.length})</div>
                ${membersHtml}
              </div>
              <div>
                <div class="details-section-title">📋 المهام الحالية</div>
                ${tasksHtml}
              </div>
            </div>
          </div>
        </td>
      </tr>`;
  }).join("");

  // أحداث التوسع
  tbody.querySelectorAll(".expand-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id      = btn.dataset.expand;
      const detRow  = document.getElementById("details-" + id);
      const isOpen  = detRow.classList.toggle("open");
      btn.classList.toggle("open", isOpen);
    });
  });

  // النقر على الصف كله
  tbody.querySelectorAll(".supervisor-row-main").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-del]") || e.target.closest(".expand-btn")) return;
      const id     = row.dataset.id;
      const detRow = document.getElementById("details-" + id);
      const btn    = row.querySelector(".expand-btn");
      const isOpen = detRow.classList.toggle("open");
      btn.classList.toggle("open", isOpen);
    });
  });

  // حذف بتأكيد مخصص
  tbody.querySelectorAll("[data-del]").forEach(b => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      confirmDelete(
        `هل أنت متأكد من حذف حساب التوجيه؟\nسيُحذف الحساب من قاعدة البيانات. الموجّهون والمهام المرتبطة به ستبقى.`,
        () => deleteSupervisor(b.dataset.del)
      );
    });
  });
}

// ===== الترتيب العام =====
function renderLeaderboard() {
  const box = document.getElementById("leaderboardBox");

  const memberScores = allMembers.map(m => {
    const mTasks  = allTasks.filter(t => t.memberId === m.id);
    const done    = mTasks.filter(t => t.status === "done").length;
    const late    = mTasks.filter(t => isOverdue(t)).length;
    const total   = mTasks.length;
    const pct     = total ? Math.round(done/total*100) : 0;
    const sup     = supervisors.find(s => s.id === m.supervisorId);
    return { m, done, late, total, pct, supName: sup?.supervisionName || sup?.name || "—" };
  }).sort((a, b) => b.done - a.done || a.late - b.late);

  if (memberScores.length === 0) {
    box.innerHTML = `<div class="empty-state"><span class="emoji">🏆</span>لا يوجد موجّهون بعد</div>`;
    return;
  }

  const rankClass = (i) => i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
  const rankEmoji = (i) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1;

  box.innerHTML = memberScores.map(({ m, done, late, total, pct, supName }, i) => `
    <div class="lb-row">
      <div class="lb-rank ${rankClass(i)}">${rankEmoji(i)}</div>
      <div class="avatar" style="width:36px;height:36px;font-size:13px;flex-shrink:0">${initials(m.name)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:13px">${escapeHtml(m.name)}</div>
        <div style="font-size:11px;color:var(--text-dim)">${escapeHtml(m.school||"—")} · ${escapeHtml(supName)}</div>
        <div style="margin-top:4px">
          <div class="progress-bar-wrap" style="height:4px;max-width:200px"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        </div>
      </div>
      <div style="text-align:center;flex-shrink:0">
        <div style="font-size:11px;color:var(--text-dim)">منجزة</div>
        <div style="font-weight:800;color:var(--success)">${done}</div>
      </div>
      ${late ? `<div style="text-align:center;flex-shrink:0"><div style="font-size:11px;color:var(--text-dim)">متأخرة</div><div style="font-weight:800;color:var(--danger)">${late}</div></div>` : ""}
      <div style="text-align:center;flex-shrink:0">
        <div style="font-size:11px;color:var(--text-dim)">الإجمالي</div>
        <div style="font-weight:800">${total}</div>
      </div>
    </div>
  `).join("");
}

// ===== المتأخرات =====
function renderLateTasks() {
  const box  = document.getElementById("lateTasksBox");
  const late = allTasks.filter(t => isOverdue(t));

  if (late.length === 0) {
    box.innerHTML = `<div class="empty-state"><span class="emoji">🎉</span>مفيش مهام متأخرة دلوقتي — رائع!</div>`;
    return;
  }

  // ترتيب حسب الأقدم
  const sorted = [...late].sort((a, b) => {
    const da = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
    const db2 = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate);
    return da - db2;
  });

  box.innerHTML = `
    <div style="margin-bottom:12px;font-size:13px;color:var(--danger);font-weight:700">
      ⚠️ ${late.length} مهمة متأخرة على مستوى الإدارة
    </div>
    ${sorted.map(t => {
      const due  = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
      const days = Math.floor((Date.now() - due.getTime()) / 86400000);
      return `
        <div class="mini-task-row" style="border-color:var(--danger);margin-bottom:8px">
          <span style="font-size:20px">⏰</span>
          <div style="flex:1;min-width:0">
            <div class="mini-task-title">${escapeHtml(t.title)}</div>
            <div class="mini-task-meta">
              👤 ${escapeHtml(t.memberName||"—")} · 🏛️ ${escapeHtml(t.supervisorName||"—")} · 📅 ${formatDate(t.dueDate)}
            </div>
          </div>
          <span class="badge badge-danger" style="flex-shrink:0">تأخر ${days} يوم</span>
        </div>`;
    }).join("")}`;
}

// ===== حذف مع تأكيد مخصص =====
async function deleteSupervisor(uid) {
  const s = supervisors.find(x => x.id === uid);
  const ok = await confirmAction(
    "حذف حساب التوجيه",
    `هل أنت متأكد من حذف حساب "${s?.supervisionName || s?.name || "هذا التوجيه"}"؟ الموجّهون والمهام المرتبطة ستبقى موجودة.`
  );
  if (!ok) return;
  try {
    await deleteDoc(doc(db, "users", uid));
    showToast("تم حذف حساب التوجيه");
    loadAll();
  } catch (e) {
    showToast("حصل خطأ أثناء الحذف", "error");
  }
}

// ===== إضافة مسؤول توجيه =====
document.getElementById("addSupervisorBtn").addEventListener("click", () => {
  document.getElementById("supervisorForm").reset();
  openModal("supervisorModal");
});

document.getElementById("supervisorForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name           = document.getElementById("sName").value.trim();
  const supervisionName = document.getElementById("sSupervisionName").value.trim();
  const email          = document.getElementById("sEmail").value.trim();
  const password       = document.getElementById("sPassword").value;

  if (password.length < 6) { showToast("كلمة المرور لازم تكون 6 أحرف على الأقل", "error"); return; }

  const saveBtn = document.getElementById("saveSupervisorBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "جاري الإنشاء...";

  const secondaryApp  = initializeApp(app.options, "secondary-" + Date.now());
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      name, supervisionName, email, role: "supervisor", createdAt: serverTimestamp(),
    });
    await secondaryAuth.signOut();
    showToast("تم إنشاء حساب التوجيه بنجاح 🎉");
    closeModal("supervisorModal");
    loadAll();
  } catch (err) {
    const messages = {
      "auth/email-already-in-use": "البريد الإلكتروني مستخدم بالفعل",
      "auth/invalid-email": "صيغة البريد الإلكتروني غير صحيحة",
      "auth/weak-password": "كلمة المرور ضعيفة",
    };
    showToast(messages[err.code] || "حصل خطأ، حاول تاني", "error");
  } finally {
    await deleteApp(secondaryApp);
    saveBtn.disabled = false;
    saveBtn.textContent = "💾 إنشاء الحساب";
  }
});

// ===== تصدير Excel (SheetJS من CDN) =====
async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// كفر شيت موحّد
function buildCoverSheet(XLSX, wb, reportTitle) {
  const today = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const ws = XLSX.utils.aoa_to_sheet([
    ["إدارة غرب القاهرة التعليمية"],
    ["مكتب السيد مدير الإدارة"],
    [""],
    [reportTitle],
    [""],
    ["تاريخ الإصدار:", today],
    ["عدد التوجيهات:", supervisors.length],
    ["إجمالي الموجّهين:", allMembers.length],
    ["إجمالي المهام:", allTasks.length],
    ["المهام المنجزة:", allTasks.filter(t => t.status === "done").length],
    ["المهام المتأخرة:", allTasks.filter(t => isOverdue(t)).length],
  ]);

  // تنسيق العرض
  ws["!cols"] = [{ wch: 30 }, { wch: 40 }];
  ws["A1"] = { v: "إدارة غرب القاهرة التعليمية", t: "s", s: { font: { bold: true, sz: 18 }, alignment: { horizontal: "center" } } };
  ws["A2"] = { v: "مكتب السيد مدير الإدارة", t: "s", s: { font: { bold: true, sz: 14 }, alignment: { horizontal: "center" } } };
  ws["A4"] = { v: reportTitle, t: "s", s: { font: { bold: true, sz: 14, color: { rgb: "2E6FF2" } } } };
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "📋 بيانات التقرير");
}

function styleHeader(ws, range, XLSX) {
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
      fill: { patternType: "solid", fgColor: { rgb: "2E6FF2" } },
      alignment: { horizontal: "center", wrapText: true },
      border: {
        bottom: { style: "medium", color: { rgb: "FFFFFF" } },
      },
    };
  }
}

// تقرير شامل
async function exportAll() {
  const XLSX = await loadXLSX();
  const wb   = XLSX.utils.book_new();
  buildCoverSheet(XLSX, wb, "التقرير الشامل للإدارة");

  // شيت التوجيهات
  const supData = supervisors.map(s => {
    const sM   = allMembers.filter(m => m.supervisorId === s.id);
    const sT   = allTasks.filter(t => t.supervisorId === s.id);
    const done = sT.filter(t => t.status === "done").length;
    const late = sT.filter(t => isOverdue(t)).length;
    return {
      "اسم التوجيه":   s.supervisionName || s.name,
      "المسؤول":       s.name,
      "البريد":        s.email,
      "عدد الموجّهين": sM.length,
      "إجمالي المهام": sT.length,
      "منجزة":         done,
      "جاري":          sT.filter(t => t.status === "in_progress").length,
      "لم تبدأ":       sT.filter(t => t.status === "pending").length,
      "متأخرة":        late,
      "نسبة الإنجاز":  sT.length ? Math.round(done/sT.length*100) + "%" : "0%",
    };
  });
  const ws1 = XLSX.utils.json_to_sheet(supData);
  ws1["!cols"] = [30,20,30,15,15,10,10,10,10,15].map(w => ({ wch: w }));
  styleHeader(ws1, XLSX.utils.decode_range(ws1["!ref"]), XLSX);
  XLSX.utils.book_append_sheet(wb, ws1, "🏛️ التوجيهات");

  // شيت الموجّهين
  const memData = allMembers.map(m => {
    const mT   = allTasks.filter(t => t.memberId === m.id);
    const done = mT.filter(t => t.status === "done").length;
    const sup  = supervisors.find(s => s.id === m.supervisorId);
    return {
      "الاسم":         m.name,
      "التوجيه":       sup?.supervisionName || sup?.name || "—",
      "المدرسة":       m.school || "—",
      "الهاتف":        m.phone || "—",
      "إجمالي المهام": mT.length,
      "منجزة":         done,
      "متأخرة":        mT.filter(t => isOverdue(t)).length,
      "نسبة الإنجاز":  mT.length ? Math.round(done/mT.length*100) + "%" : "0%",
    };
  }).sort((a,b) => parseInt(b["منجزة"]) - parseInt(a["منجزة"]));
  const ws2 = XLSX.utils.json_to_sheet(memData);
  ws2["!cols"] = [25,25,25,15,15,10,10,15].map(w => ({ wch: w }));
  styleHeader(ws2, XLSX.utils.decode_range(ws2["!ref"]), XLSX);
  XLSX.utils.book_append_sheet(wb, ws2, "🧑‍🏫 الموجّهون");

  // شيت المهام
  const taskData = allTasks.map(t => ({
    "عنوان المهمة":  t.title,
    "الموجّه":       t.memberName || "—",
    "التوجيه":       t.supervisorName || "—",
    "النوع":         t.type || "—",
    "الحالة":        t.status === "done" ? "منجزة" : t.status === "in_progress" ? "جاري" : "لم تبدأ",
    "تاريخ الاستحقاق": formatDate(t.dueDate),
    "متأخرة":        isOverdue(t) ? "نعم" : "لا",
    "ملاحظات":       t.notes || "—",
  }));
  const ws3 = XLSX.utils.json_to_sheet(taskData);
  ws3["!cols"] = [30,20,25,15,12,18,10,30].map(w => ({ wch: w }));
  styleHeader(ws3, XLSX.utils.decode_range(ws3["!ref"]), XLSX);
  XLSX.utils.book_append_sheet(wb, ws3, "📋 المهام");

  XLSX.writeFile(wb, `تقرير_شامل_غرب_القاهرة_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast("تم تصدير التقرير الشامل بنجاح 📊");
}

async function exportMembers() {
  const XLSX = await loadXLSX();
  const wb   = XLSX.utils.book_new();
  buildCoverSheet(XLSX, wb, "تقرير الموجّهين والأخصائيين");

  const data = allMembers.map(m => {
    const mT   = allTasks.filter(t => t.memberId === m.id);
    const done = mT.filter(t => t.status === "done").length;
    const late = mT.filter(t => isOverdue(t)).length;
    const sup  = supervisors.find(s => s.id === m.supervisorId);
    return {
      "الاسم":              m.name,
      "التوجيه التابع له": sup?.supervisionName || sup?.name || "—",
      "المدرسة / الجهة":   m.school || "—",
      "رقم الهاتف":        m.phone || "—",
      "إجمالي المهام":     mT.length,
      "المهام المنجزة":    done,
      "جاري التنفيذ":      mT.filter(t => t.status === "in_progress").length,
      "لم تبدأ بعد":       mT.filter(t => t.status === "pending").length,
      "المهام المتأخرة":   late,
      "نسبة الإنجاز":      mT.length ? Math.round(done/mT.length*100) + "%" : "0%",
      "الترتيب":           "",
    };
  }).sort((a,b) => parseInt(b["المهام المنجزة"]) - parseInt(a["المهام المنجزة"]))
    .map((r,i) => ({ ...r, "الترتيب": i+1 }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [25,25,25,16,14,14,14,14,14,15,10].map(w => ({ wch: w }));
  styleHeader(ws, XLSX.utils.decode_range(ws["!ref"]), XLSX);
  XLSX.utils.book_append_sheet(wb, ws, "🧑‍🏫 الموجّهون");
  XLSX.writeFile(wb, `تقرير_الموجهين_غرب_القاهرة_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast("تم تصدير تقرير الموجّهين 🧑‍🏫");
}

async function exportTasks() {
  const XLSX = await loadXLSX();
  const wb   = XLSX.utils.book_new();
  buildCoverSheet(XLSX, wb, "تقرير المهام الكاملة");

  const data = allTasks.map(t => ({
    "عنوان المهمة":      t.title,
    "الموجّه / الأخصائي": t.memberName || "—",
    "التوجيه":           t.supervisorName || "—",
    "نوع المهمة":        t.type || "—",
    "الحالة":            t.status === "done" ? "✅ منجزة" : t.status === "in_progress" ? "🔄 جاري" : "🕓 لم تبدأ",
    "تاريخ الاستحقاق":  formatDate(t.dueDate),
    "متأخرة":            isOverdue(t) ? "⏰ نعم" : "لا",
    "ملاحظات":           t.notes || "—",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [30,22,25,16,14,18,10,35].map(w => ({ wch: w }));
  styleHeader(ws, XLSX.utils.decode_range(ws["!ref"]), XLSX);
  XLSX.utils.book_append_sheet(wb, ws, "📋 كل المهام");
  XLSX.writeFile(wb, `تقرير_المهام_غرب_القاهرة_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast("تم تصدير تقرير المهام 📋");
}

async function exportLate() {
  const XLSX = await loadXLSX();
  const late = allTasks.filter(t => isOverdue(t));
  if (!late.length) { showToast("لا توجد مهام متأخرة الآن 🎉", "info"); return; }

  const wb = XLSX.utils.book_new();
  buildCoverSheet(XLSX, wb, "تقرير المهام المتأخرة");

  const data = late
    .sort((a, b) => {
      const da = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
      const db2 = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate);
      return da - db2;
    })
    .map(t => {
      const due  = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
      const days = Math.floor((Date.now() - due.getTime()) / 86400000);
      return {
        "عنوان المهمة":       t.title,
        "الموجّه / الأخصائي": t.memberName || "—",
        "التوجيه":            t.supervisorName || "—",
        "نوع المهمة":         t.type || "—",
        "تاريخ الاستحقاق":   formatDate(t.dueDate),
        "عدد أيام التأخير":   days + " يوم",
        "ملاحظات":            t.notes || "—",
      };
    });

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [30,22,25,16,18,16,35].map(w => ({ wch: w }));
  styleHeader(ws, XLSX.utils.decode_range(ws["!ref"]), XLSX);
  XLSX.utils.book_append_sheet(wb, ws, "⏰ المتأخرات");
  XLSX.writeFile(wb, `تقرير_المتأخرات_غرب_القاهرة_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast("تم تصدير تقرير المتأخرات ⏰");
}

document.getElementById("exportAllBtn").addEventListener("click",     exportAll);
document.getElementById("exportMembersBtn").addEventListener("click", exportMembers);
document.getElementById("exportTasksBtn").addEventListener("click",   exportTasks);
document.getElementById("exportLateBtn").addEventListener("click",    exportLate);

loadAll();
