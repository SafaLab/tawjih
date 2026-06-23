// ============================================
// لوحة المدير العام — نسخة محسّنة مع تفاصيل كاملة وتصدير Excel
// ============================================
import { guardPage, logout } from "../auth.js";
import {
  app, db, initializeApp, deleteApp, getAuth, createUserWithEmailAndPassword,
  collection, getDocs, query, where, doc, setDoc, updateDoc, serverTimestamp, deleteDoc,
} from "../firebase-config.js";
import {
  showToast, openModal, closeModal, bindModalDismiss, initials, escapeHtml, isOverdue, formatDate, confirmAction, bindConfirmModal,
} from "../utils.js";

const profile = await guardPage("admin");
document.getElementById("userName").textContent = profile.name;
document.getElementById("userAvatar").textContent = initials(profile.name);
document.getElementById("logoutBtn").addEventListener("click", logout);
bindModalDismiss();
bindConfirmModal();

let supervisors = [];
let allMembers = [];
let allTasks = [];

// ===== تحميل البيانات =====
async function loadAll() {
  // إظهار loading في الجدول
  const tbody = document.getElementById("supervisorsBody");
  if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-dim)"><div class="spinner" style="margin:0 auto 12px"></div>جاري تحميل البيانات...</td></tr>`;

  try {
    const [usersSnap, membersSnap, tasksSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("role", "==", "supervisor"))),
      getDocs(collection(db, "members")),
      getDocs(collection(db, "tasks")),
    ]);

    supervisors = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    allMembers  = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    allTasks    = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--danger)">⚠️ حصل خطأ في تحميل البيانات — <button onclick="loadAll()" class="btn btn-sm btn-secondary">إعادة المحاولة</button></td></tr>`;
    showToast("حصل خطأ في تحميل البيانات", "error");
    return;
  }

  renderStats();
  renderSupervisors();
  renderLeaderboard();
  renderLateTasks();

  // تحديث وقت آخر refresh
  const ts = document.getElementById("lastRefreshAdmin");
  if (ts) ts.textContent = "آخر تحديث: " + new Date().toLocaleTimeString("ar-EG");
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
          <div style="display:flex;gap:6px;justify-content:center">
            <button class="btn btn-icon btn-secondary" data-edit="${s.id}" title="تعديل">✏️</button>
            <button class="btn btn-icon btn-danger" data-del="${s.id}" title="حذف">🗑️</button>
          </div>
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
  // حذف
  tbody.querySelectorAll("[data-del]").forEach(b => {
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      await deleteSupervisor(b.dataset.del);
    });
  });

  // تعديل
  tbody.querySelectorAll("[data-edit]").forEach(b => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditSupervisor(b.dataset.edit);
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

async function deleteSupervisor(uid) {
  const s = supervisors.find(x => x.id === uid);
  const ok = await confirmAction(
    "حذف حساب التوجيه",
    `هل أنت متأكد من حذف حساب "${s?.supervisionName || s?.name || "هذا التوجيه"}"؟ الموجّهون والمهام المرتبطة ستبقى موجودة.`
  );
  if (!ok) return;
  try {
    await deleteDoc(doc(db, "users", uid));
    showToast("تم حذف حساب التوجيه بنجاح");
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
    s.onload  = () => resolve(window.XLSX);
    s.onerror = () => {
      const s2 = document.createElement("script");
      s2.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      s2.onload  = () => resolve(window.XLSX);
      s2.onerror = reject;
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
  });
}

const CLR = {
  header_bg:"1B3A6B",header_fg:"FFFFFF",cover_bg:"EEF3FC",
  cover_title:"1B3A6B",cover_sub:"2E6FF2",alt_row:"F4F7FF",border:"C7D2E8",
  done_fg:"1A7A47",done_bg:"E6F4ED",late_fg:"B91C1C",late_bg:"FEE2E2",
  warn_fg:"92400E",warn_bg:"FEF3C7",
};

function XLSX_enc(r,c2){
  const col=c2<26?String.fromCharCode(65+c2):String.fromCharCode(64+Math.floor(c2/26))+String.fromCharCode(65+(c2%26));
  return col+(r+1);
}

function makeCell(v,opts={}){
  const{bold=false,sz=12,color="000000",bg=null,hAlign="right",wrap=true,border=true}=opts;
  const s={
    font:{name:"Cairo",sz,bold,color:{rgb:color}},
    alignment:{horizontal:hAlign,vertical:"center",wrapText:wrap,readingOrder:2},
  };
  if(bg)s.fill={patternType:"solid",fgColor:{rgb:bg}};
  if(border)s.border={
    top:{style:"thin",color:{rgb:CLR.border}},bottom:{style:"thin",color:{rgb:CLR.border}},
    left:{style:"thin",color:{rgb:CLR.border}},right:{style:"thin",color:{rgb:CLR.border}},
  };
  return{v,t:typeof v==="number"?"n":"s",s};
}

function buildStyledSheet(headers,rows,colWidths){
  const ws={};
  headers.forEach((h,c2)=>{
    ws[XLSX_enc(0,c2)]=makeCell(h,{bold:true,sz:13,color:CLR.header_fg,bg:CLR.header_bg,hAlign:"center"});
  });
  rows.forEach((row,r)=>{
    const isAlt=r%2===1,defBg=isAlt?CLR.alt_row:"FFFFFF";
    row.forEach((val,c2)=>{
      let o={sz:12,bg:defBg};
      if(typeof val==="string"){
        if(val==="منجزة"||val==="لا") o={...o,color:CLR.done_fg,bg:isAlt?"DCF0E6":CLR.done_bg};
        else if(val==="نعم"||val.includes("متأخرة")) o={...o,color:CLR.late_fg,bg:isAlt?"FCD9D9":CLR.late_bg};
        else if(val==="جاري التنفيذ") o={...o,color:CLR.warn_fg,bg:isAlt?"FDE9B0":CLR.warn_bg};
      }
      if(typeof val==="number")o.hAlign="center";
      ws[XLSX_enc(r+1,c2)]=makeCell(val??"",o);
    });
  });
  ws["!ref"]=`A1:${XLSX_enc(rows.length,headers.length-1)}`;
  ws["!cols"]=colWidths.map(w=>({wch:w}));
  ws["!rows"]=[{hpt:36},...rows.map(()=>({hpt:22}))];
  ws["!sheetView"]=[{rightToLeft:true}];
  return ws;
}

function buildCoverSheet(XLSX,wb,reportTitle){
  const today=new Date().toLocaleDateString("ar-EG",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  const done=allTasks.filter(t=>t.status==="done").length;
  const late=allTasks.filter(t=>isOverdue(t)).length;
  const pct=allTasks.length?Math.round(done/allTasks.length*100):0;
  const ws={};
  const cc=(v,sz,color,bg,bold=true)=>({v,t:"s",s:{
    font:{name:"Cairo",sz,bold,color:{rgb:color}},
    fill:{patternType:"solid",fgColor:{rgb:bg}},
    alignment:{horizontal:"center",vertical:"center",wrapText:false,readingOrder:2},
  }});
  ws["A1"]=cc("إدارة غرب القاهرة التعليمية",22,CLR.cover_title,CLR.cover_bg);
  ws["A2"]=cc("مكتب السيد مدير الإدارة — توجيه الصحافة",14,CLR.header_fg,CLR.header_bg);
  ws["A3"]={v:"",t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:CLR.cover_bg}}}};
  ws["A4"]=cc(reportTitle,18,CLR.cover_sub,CLR.cover_bg);
  ws["A5"]=cc(`📅 تاريخ الإصدار: ${today}`,12,"4A5568",CLR.cover_bg,false);
  ws["A6"]={v:"",t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:CLR.cover_bg}}}};
  const bd={top:{style:"thin",color:{rgb:CLR.border}},bottom:{style:"thin",color:{rgb:CLR.border}},left:{style:"thin",color:{rgb:CLR.border}},right:{style:"thin",color:{rgb:CLR.border}}};
  const stats=[
    ["📊 إجمالي التوجيهات",supervisors.length,CLR.header_bg,"FFFFFF"],
    ["👥 إجمالي الموجّهين",allMembers.length,"1A7A47",CLR.done_bg],
    ["📋 إجمالي المهام",allTasks.length,"1B3A6B",CLR.cover_bg],
    ["✅ المهام المنجزة",done,"1A7A47",CLR.done_bg],
    ["⏰ المهام المتأخرة",late,CLR.late_fg,CLR.late_bg],
    ["📈 نسبة الإنجاز الكلية",`${pct}%`,CLR.warn_fg,CLR.warn_bg],
  ];
  stats.forEach(([label,val,fg,bg],i)=>{
    ws[`A${7+i}`]={v:label,t:"s",s:{font:{name:"Cairo",sz:13,bold:true,color:{rgb:"1B3A6B"}},fill:{patternType:"solid",fgColor:{rgb:CLR.cover_bg}},alignment:{horizontal:"right",vertical:"center",readingOrder:2},border:bd}};
    ws[`B${7+i}`]={v:typeof val==="number"?val:val,t:typeof val==="number"?"n":"s",s:{font:{name:"Cairo",sz:15,bold:true,color:{rgb:fg}},fill:{patternType:"solid",fgColor:{rgb:bg}},alignment:{horizontal:"center",vertical:"center",readingOrder:2},border:bd}};
  });
  ws["!ref"]="A1:B12";
  ws["!cols"]=[{wch:34},{wch:20}];
  ws["!rows"]=[{hpt:60},{hpt:36},{hpt:12},{hpt:46},{hpt:28},{hpt:12},...stats.map(()=>({hpt:30}))];
  ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:1}},{s:{r:1,c:0},e:{r:1,c:1}},{s:{r:2,c:0},e:{r:2,c:1}},{s:{r:3,c:0},e:{r:3,c:1}},{s:{r:4,c:0},e:{r:4,c:1}},{s:{r:5,c:0},e:{r:5,c:1}}];
  ws["!sheetView"]=[{rightToLeft:true}];
  XLSX.utils.book_append_sheet(wb,ws,"📋 غلاف التقرير");
}

async function exportAll(){
  const XLSX=await loadXLSX();const wb=XLSX.utils.book_new();
  buildCoverSheet(XLSX,wb,"التقرير الشامل للإدارة");
  const supRows=supervisors.map(s=>{
    const sM=allMembers.filter(m=>m.supervisorId===s.id);
    const sT=allTasks.filter(t=>t.supervisorId===s.id);
    const done=sT.filter(t=>t.status==="done").length;
    return[s.supervisionName||s.name,s.name,s.email,sM.length,sT.length,done,
      sT.filter(t=>t.status==="in_progress").length,sT.filter(t=>t.status==="pending").length,
      sT.filter(t=>isOverdue(t)).length,sT.length?Math.round(done/sT.length*100)+"%":"0%"];
  });
  XLSX.utils.book_append_sheet(wb,buildStyledSheet(["اسم التوجيه","المسؤول","البريد","الموجّهون","المهام","منجزة","جاري","لم تبدأ","متأخرة","الإنجاز"],supRows,[28,20,28,12,10,10,10,10,10,12]),"🏛️ التوجيهات");
  const memRows=allMembers.map(m=>{
    const mT=allTasks.filter(t=>t.memberId===m.id);
    const done=mT.filter(t=>t.status==="done").length;
    const sup=supervisors.find(s=>s.id===m.supervisorId);
    return[m.name,sup?.supervisionName||"—",m.school||"—",m.phone||"—",mT.length,done,
      mT.filter(t=>t.status==="in_progress").length,mT.filter(t=>t.status==="pending").length,
      mT.filter(t=>isOverdue(t)).length,mT.length?Math.round(done/mT.length*100)+"%":"0%"];
  }).sort((a,b)=>b[5]-a[5]);
  XLSX.utils.book_append_sheet(wb,buildStyledSheet(["الاسم","التوجيه","المدرسة","الهاتف","المهام","منجزة","جاري","لم تبدأ","متأخرة","الإنجاز"],memRows,[24,22,22,14,10,10,10,10,10,12]),"🧑‍🏫 الموجّهون");
  const taskRows=allTasks.map(t=>[t.title,t.memberName||"—",t.supervisorName||"—",t.type||"—",
    t.status==="done"?"منجزة":t.status==="in_progress"?"جاري التنفيذ":"لم تبدأ",
    formatDate(t.dueDate),isOverdue(t)?"نعم":"لا",t.notes||"—"]);
  XLSX.utils.book_append_sheet(wb,buildStyledSheet(["عنوان المهمة","الموجّه","التوجيه","النوع","الحالة","الاستحقاق","متأخرة","ملاحظات"],taskRows,[30,20,22,14,14,16,10,28]),"📋 المهام");
  XLSX.writeFile(wb,`تقرير_شامل_غرب_القاهرة_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast("تم تصدير التقرير الشامل 📊");
}

async function exportMembers(){
  const XLSX=await loadXLSX();const wb=XLSX.utils.book_new();
  buildCoverSheet(XLSX,wb,"تقرير الموجّهين والأخصائيين");
  const rows=allMembers.map(m=>{
    const mT=allTasks.filter(t=>t.memberId===m.id);
    const done=mT.filter(t=>t.status==="done").length;
    const sup=supervisors.find(s=>s.id===m.supervisorId);
    return[m.name,sup?.supervisionName||"—",m.school||"—",m.phone||"—",mT.length,done,
      mT.filter(t=>t.status==="in_progress").length,mT.filter(t=>t.status==="pending").length,
      mT.filter(t=>isOverdue(t)).length,mT.length?Math.round(done/mT.length*100)+"%":"0%"];
  }).sort((a,b)=>b[5]-a[5]);
  XLSX.utils.book_append_sheet(wb,buildStyledSheet(["الاسم","التوجيه","المدرسة / الجهة","رقم الهاتف","إجمالي المهام","المنجزة","جاري","لم تبدأ","المتأخرة","نسبة الإنجاز"],rows,[24,22,22,14,13,11,11,11,11,14]),"🧑‍🏫 الموجّهون");
  XLSX.writeFile(wb,`تقرير_الموجهين_غرب_القاهرة_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast("تم تصدير تقرير الموجّهين 🧑‍🏫");
}

async function exportTasks(){
  const XLSX=await loadXLSX();const wb=XLSX.utils.book_new();
  buildCoverSheet(XLSX,wb,"تقرير المهام الكاملة");
  const rows=allTasks.map(t=>[t.title,t.memberName||"—",t.supervisorName||"—",t.type||"—",
    t.status==="done"?"منجزة":t.status==="in_progress"?"جاري التنفيذ":"لم تبدأ",
    formatDate(t.dueDate),isOverdue(t)?"نعم":"لا",t.notes||"—"]);
  XLSX.utils.book_append_sheet(wb,buildStyledSheet(["عنوان المهمة","الموجّه / الأخصائي","التوجيه","نوع المهمة","الحالة","تاريخ الاستحقاق","متأخرة","ملاحظات"],rows,[30,22,22,14,14,16,10,30]),"📋 جميع المهام");
  XLSX.writeFile(wb,`تقرير_المهام_غرب_القاهرة_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast("تم تصدير تقرير المهام 📋");
}

async function exportLate(){
  const XLSX=await loadXLSX();
  const late=allTasks.filter(t=>isOverdue(t));
  if(!late.length){showToast("لا توجد مهام متأخرة الآن 🎉","info");return;}
  const wb=XLSX.utils.book_new();
  buildCoverSheet(XLSX,wb,"تقرير المهام المتأخرة");
  const rows=late.sort((a,b)=>{
    const da=a.dueDate?.toDate?a.dueDate.toDate():new Date(a.dueDate);
    const db2=b.dueDate?.toDate?b.dueDate.toDate():new Date(b.dueDate);
    return da-db2;
  }).map(t=>{
    const due=t.dueDate?.toDate?t.dueDate.toDate():new Date(t.dueDate);
    const days=Math.floor((Date.now()-due.getTime())/86400000);
    return[t.title,t.memberName||"—",t.supervisorName||"—",t.type||"—",formatDate(t.dueDate),days,t.notes||"—"];
  });
  XLSX.utils.book_append_sheet(wb,buildStyledSheet(["عنوان المهمة","الموجّه / الأخصائي","التوجيه","نوع المهمة","تاريخ الاستحقاق","أيام التأخير","ملاحظات"],rows,[30,22,22,14,16,14,28]),"⏰ المتأخرات");
  XLSX.writeFile(wb,`تقرير_المتأخرات_غرب_القاهرة_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast("تم تصدير تقرير المتأخرات ⏰");
}

document.getElementById("exportAllBtn").addEventListener("click",     exportAll);
document.getElementById("exportMembersBtn").addEventListener("click", exportMembers);
document.getElementById("exportTasksBtn").addEventListener("click",   exportTasks);
document.getElementById("exportLateBtn").addEventListener("click",    exportLate);

// ===== تعديل بيانات مسؤول التوجيه =====
function openEditSupervisor(uid) {
  const s = supervisors.find(x => x.id === uid);
  if (!s) return;
  document.getElementById("editSupId").value        = uid;
  document.getElementById("editSupName").value      = s.name || "";
  document.getElementById("editSupDivision").value  = s.supervisionName || "";
  document.getElementById("editSupEmail").textContent = s.email || "";
  openModal("editSupervisorModal");
}

document.getElementById("editSupervisorForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const uid            = document.getElementById("editSupId").value;
  const name           = document.getElementById("editSupName").value.trim();
  const supervisionName = document.getElementById("editSupDivision").value.trim();
  if (!name || !supervisionName) { showToast("برجاء ملء جميع الحقول", "error"); return; }

  const saveBtn = document.getElementById("editSupSaveBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "جاري الحفظ...";

  try {
    await updateDoc(doc(db, "users", uid), { name, supervisionName });
    showToast("تم تحديث بيانات التوجيه ✅");
    closeModal("editSupervisorModal");
    loadAll();
  } catch (err) {
    showToast("حصل خطأ أثناء الحفظ", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "💾 حفظ التعديلات";
  }
});


loadAll();
