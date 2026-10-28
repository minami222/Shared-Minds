// Shared dreams in the class Firebase (same project as Constellation, own folder: dreamGallery/dreams)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase, ref, set, get } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBp4VZMMi4KXts_ZqGLs9JkZSmfAnV78b4',
  authDomain: 'sharedminds26-809c7.firebaseapp.com',
  databaseURL: 'https://sharedminds26-809c7-default-rtdb.firebaseio.com',
  projectId: 'sharedminds26-809c7',
  storageBucket: 'sharedminds26-809c7.firebasestorage.app',
  messagingSenderId: '102824611711',
  appId: '1:102824611711:web:df6236df840b70c925d44a'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const ready = signInAnonymously(auth);

// dream: { versions: [url, url, url], answers: [...], picked: 0-2, createdAt }
export async function saveDream(dream) {
  await ready;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await set(ref(db, `dreamGallery/dreams/${id}`), { ...dream, uid: auth.currentUser.uid });
  return id;
}

export async function loadDreams() {
  await ready;
  const snap = await get(ref(db, 'dreamGallery/dreams'));
  const all = snap.val() || {};
  return Object.entries(all)
    .map(([id, d]) => ({ id, ...d }))
    .sort((a, b) => b.createdAt - a.createdAt);
}
