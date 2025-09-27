// Firestore-based storage adapter (example). Not used by default.
// Steps:
// - npm i firebase
// - create src/services/firebaseClient.js from firebaseClient.example.js
// - replace imports from './storage' with './storage.firebase' in components

// import { collection, addDoc, getDocs, getDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
// import { db } from './firebaseClient';

// const col = () => collection(db, 'projects');

// export async function getProjects() {
//   const snap = await getDocs(col());
//   return snap.docs.map(d => ({ id: d.id, ...d.data() }));
// }

// export async function getProjectById(id) {
//   const snap = await getDoc(doc(db, 'projects', id));
//   return snap.exists() ? { id: snap.id, ...snap.data() } : null;
// }

// export async function addProject({ name, description = '' }) {
//   const res = await addDoc(col(), { name, description, createdAt: serverTimestamp(), totalMs: 0, sessions: [] });
//   const docSnap = await getDoc(res);
//   return { id: docSnap.id, ...docSnap.data() };
// }

// export async function updateProject(updated) {
//   const { id, ...rest } = updated;
//   await updateDoc(doc(db, 'projects', id), rest);
// }

// export async function addSessionToProject(projectId, session) {
//   const p = await getProjectById(projectId);
//   const next = { ...p, sessions: [ { id: crypto.randomUUID(), ...session }, ...(p.sessions || []) ], totalMs: (p.totalMs || 0) + (session.durationMs || 0) };
//   await updateProject(next);
//   return next;
// }

// export function formatDuration(ms) {
//   const totalSeconds = Math.floor(ms / 1000);
//   const h = Math.floor(totalSeconds / 3600);
//   const m = Math.floor((totalSeconds % 3600) / 60);
//   const s = totalSeconds % 60;
//   const hh = String(h).padStart(2, '0');
//   const mm = String(m).padStart(2, '0');
//   const ss = String(s).padStart(2, '0');
//   return `${hh}:${mm}:${ss}`;
// }

