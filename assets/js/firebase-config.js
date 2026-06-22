// ============================================
// إعدادات Firebase — نسخة الإنتاج
// ضع قيم مشروعك من: Firebase Console > Project Settings > General > Your apps
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyAnVTXnHVXqtowhu6aI0aWtZLCGIwHqt2Y",
  authDomain: "tawjih-69771.firebaseapp.com",
  projectId: "tawjih-69771",
  storageBucket: "tawjih-69771.firebasestorage.app",
  messagingSenderId: "334272223434",
  appId: "1:334272223434:web:ea10e0a04aa0b075ef7c33"
};

const FIREBASE_SDK_VERSION = "10.12.2";
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

const [appMod, authMod, fsMod] = await Promise.all([
  import(`${CDN}/firebase-app.js`),
  import(`${CDN}/firebase-auth.js`),
  import(`${CDN}/firebase-firestore.js`),
]);

const sdk = { ...appMod, ...authMod, ...fsMod };

export const {
  initializeApp,
  deleteApp,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
} = sdk;

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
