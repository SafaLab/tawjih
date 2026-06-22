// ============================================
// إعدادات Firebase — نسخة الإنتاج
// ضع قيم مشروعك من: Firebase Console > Project Settings > General > Your apps
// ============================================
const firebaseConfig = {
  apiKey: "ضع_API_KEY_هنا",
  authDomain: "ضع_PROJECT_ID.firebaseapp.com",
  projectId: "ضع_PROJECT_ID",
  storageBucket: "ضع_PROJECT_ID.appspot.com",
  messagingSenderId: "ضع_SENDER_ID",
  appId: "ضع_APP_ID",
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
