// ============================================
// لوحة تحكم المسؤول عن التوجيه - نظرة عامة
// ============================================
import { guardPage, logout } from "../auth.js";
import {
  db, collection, query, where, getDocs, orderBy,
} from "../firebase-config.js";
import { formatDate, timeAgo, STATUS_LABELS, isOverdue, initials } from "../utils.js";

const profile = await guardPage("supervisor");
document.getElementById("userName").textContent = profile.name;
document.getElementById("userRole").textContent = profile.supervisionName || "موجّه عام";
document.getElementById("userAvatar").textContent = initials(profile.name);
document.getElementById("pageGreeting").textContent = `أهلاً بيك يا ${profile.name} 👋`;

document.getElementById("logoutBtn").addEventListener("click", logout);

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

  document.getElementById("statMembers").textContent = members.length;
  document.getElementById("statTasks").textContent = tasks.length;
  document.getElementById("statDone").textContent = done;
  document.getElementById("statLate").textContent = late;

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

loadDashboard();
