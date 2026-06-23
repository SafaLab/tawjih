// ============================================
// لوحة تحكم المسؤول عن التوجيه - نظرة عامة
// ============================================
import { guardPage, logout } from "../auth.js";
import {
  db, collection, query, where, getDocs, orderBy,
} from "../firebase-config.js";
import { formatDate, timeAgo, STATUS_LABELS, isOverdue, initials, showToast, bindSidebarToggle } from "../utils.js";

const profile = await guardPage("supervisor");
document.getElementById("userName").textContent = profile.name;
document.getElementById("userRole").textContent = profile.supervisionName || "موجّه عام";
document.getElementById("userAvatar").textContent = initials(profile.name);
document.getElementById("pageGreeting").textContent = `أهلاً بيك يا ${profile.name} 👋`;

document.getElementById("logoutBtn").addEventListener("click", logout);
bindSidebarToggle();

// زرار refresh
document.getElementById("refreshBtn")?.addEventListener("click", async () => {
  const btn = document.getElementById("refreshBtn");
  btn.disabled = true;
  btn.textContent = "⏳";
  await loadDashboard();
  btn.disabled = false;
  btn.textContent = "🔄";
  showToast("تم تحديث البيانات");
  updateLastRefresh();
});

function updateLastRefresh() {
  const el = document.getElementById("lastRefresh");
  if (el) el.textContent = "آخر تحديث: " + new Date().toLocaleTimeString("ar-EG");
}

async function loadDashboard() {
  const membersQ = query(collection(db, "members"), where("supervisorId", "==", profile.uid));
  const tasksQ   = query(collection(db, "tasks"),   where("supervisorId", "==", profile.uid));

  const [membersSnap, tasksSnap] = await Promise.all([getDocs(membersQ), getDocs(tasksQ)]);

  const members = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const tasks   = tasksSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const da  = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return db2 - da;
    });

  const done = tasks.filter((t) => t.status === "done").length;
  const late = tasks.filter((t) => isOverdue(t)).length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;

  // مهام اليوم
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);
  const todayTasks = tasks.filter(t => {
    if (!t.dueDate) return false;
    const d = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
    return d >= todayStart && d <= todayEnd && t.status !== "done";
  });

  document.getElementById("statMembers").textContent = members.length;
  document.getElementById("statTasks").textContent   = tasks.length;
  document.getElementById("statDone").textContent    = done;
  document.getElementById("statLate").textContent    = late;
  const todayEl = document.getElementById("statToday");
  if (todayEl) todayEl.textContent = todayTasks.length;

  renderLeaderboard(members, tasks);
  renderRecentTasks(tasks.slice(0, 8));
}

function renderLeaderboard(members, tasks) {
  const box = document.getElementById("leaderboard");
  if (members.length === 0) {
    box.innerHTML = `<div class="empty-state"><span class="emoji">🧑‍🏫</span>لسه ما ضفتش موجّهين</div>`;
    return;
  }

  const ranked = members.map((m) => {
    const memberTasks = tasks.filter((t) => t.memberId === m.id);
    const doneCount = memberTasks.filter((t) => t.status === "done").length;
    return { ...m, total: memberTasks.length, done: doneCount };
  }).sort((a, b) => b.done - a.done || b.total - a.total);

  const medalClass = ["gold", "silver", "bronze"];

  box.innerHTML = ranked.slice(0, 10).map((m, i) => {
    const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
    return `
      <div class="lb-row">
        <div class="lb-rank ${medalClass[i] || ""}">${i < 3 ? ["🥇","🥈","🥉"][i] : "#" + (i + 1)}</div>
        <div class="lb-info">
          <div class="name">${m.name}</div>
          <div class="meta">${m.done} من ${m.total} مهمة منجزة</div>
        </div>
        <div class="lb-progress">
          <div class="pct">${pct}%</div>
          <div class="progress"><div style="width:${pct}%"></div></div>
        </div>
      </div>`;
  }).join("");
}

function renderRecentTasks(tasks) {
  const box = document.getElementById("recentTasks");
  if (tasks.length === 0) {
    box.innerHTML = `<div class="empty-state"><span class="emoji">📋</span>لسه مفيش مهام مضافة</div>`;
    return;
  }
  box.innerHTML = tasks.map((t) => {
    const s = STATUS_LABELS[t.status] || STATUS_LABELS.pending;
    return `
      <div class="lb-row">
        <div class="avatar">${(t.memberName || "؟").slice(0, 2)}</div>
        <div class="lb-info">
          <div class="name">${t.title}</div>
          <div class="meta">${t.memberName || "غير محدد"} · ${timeAgo(t.createdAt)}</div>
        </div>
        <span class="badge ${s.cls}">${s.emoji} ${s.text}</span>
      </div>`;
  }).join("");
}

loadDashboard().then(updateLastRefresh);
