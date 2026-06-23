// ============================================
// الدخول، الخروج، وحماية الصفحات حسب الدور
// ============================================
import {
  auth,
  db,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
} from "./firebase-config.js";
import { showToast } from "./utils.js";

// ============================================
// اكتشاف تلقائي للـ base path
// يشتغل صح في كل الحالات:
//   محلي من مجلد المشروع مباشرة → ""
//   محلي من مجلد فوق             → "/tawjih_new"
//   GitHub Pages                 → "/tawjih"
//   أي استضافة تانية             → اسم المجلد تلقائي
// ============================================
function detectBase() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const pagesIdx = parts.indexOf("pages");
  if (pagesIdx >= 0) {
    const b = "/" + parts.slice(0, pagesIdx).join("/");
    return b === "/" ? "" : b;
  }
  const last = parts[parts.length - 1];
  if (last && last.includes(".html")) {
    const b = "/" + parts.slice(0, -1).join("/");
    return b === "/" ? "" : b;
  }
  const b = "/" + parts.join("/").replace(/\/$/, "");
  return b === "/" ? "" : b;
}

const BASE = detectBase();

// ============================================

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
  window.location.href = `${BASE}/index.html`;
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * يستخدم في أعلى كل صفحة محمية.
 * requiredRole: "admin" أو "supervisor" أو null لأي مستخدم مسجل دخول
 * يرجع بروفايل المستخدم بعد التأكد من صلاحيته
 */
export function guardPage(requiredRole) {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        unsubscribe(); // cleanup listener
        window.location.href = `${BASE}/index.html`;
        return;
      }
      const profile = await getUserProfile(user.uid);
      if (!profile) {
        showToast("الحساب غير مُفعّل، تواصل مع المدير العام", "error");
        await signOut(auth);
        unsubscribe();
        window.location.href = `${BASE}/index.html`;
        return;
      }
      if (requiredRole && profile.role !== requiredRole) {
        unsubscribe();
        window.location.href = profile.role === "admin"
          ? `${BASE}/pages/admin-dashboard.html`
          : `${BASE}/pages/supervisor-dashboard.html`;
        return;
      }
      unsubscribe(); // cleanup بعد نجاح التحقق
      resolve({ uid: user.uid, ...profile });
    });
  });
}

export function redirectByRole(profile) {
  if (profile.role === "admin") {
    window.location.href = `${BASE}/pages/admin-dashboard.html`;
  } else {
    window.location.href = `${BASE}/pages/supervisor-dashboard.html`;
  }
}
