// Simple localStorage-based storage service for projects and sessions
// Shape:
// Project: { id, name, description, createdAt, totalMs, sessions: TimeLog[] }
// TimeLog: { id, type, start, end, durationMs, notes }

const STORAGE_KEY = 'tt_projects_v1';

function ymd(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function getProjects() {
  return load();
}

export function getProjectById(id) {
  return load().find(p => p.id === id) || null;
}

import { createProject as apiCreateProject, postSession as apiPostSession } from './serverApi';

export function addProject({ name, description = '' }) {
  const projects = load();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const project = { id, name, description, createdAt: now, totalMs: 0, sessions: [], remoteId: null };
  // Try to create on server as well (best-effort)
  try {
    apiCreateProject({ name, description }).then((remote) => {
      const p = load().find(x => x.id === id);
      if (!p) return;
      p.remoteId = remote?._id || null;
      save(load());
    }).catch(() => {});
  } catch {}
  projects.unshift(project);
  save(projects);
  return project;
}

export function updateProject(updated) {
  const projects = load();
  const idx = projects.findIndex(p => p.id === updated.id);
  if (idx === -1) return;
  projects[idx] = updated;
  save(projects);
}

export function addSessionToProject(projectId, session) {
  const projects = load();
  const idx = projects.findIndex(p => p.id === projectId);
  if (idx === -1) return null;
  const log = { id: crypto.randomUUID(), ...session };
  projects[idx].sessions.unshift(log);
  projects[idx].totalMs = (projects[idx].totalMs || 0) + (session.durationMs || 0);
  save(projects);
  // Mirror to server if project is linked
  const remoteId = projects[idx].remoteId;
  if (remoteId) {
    try { apiPostSession(remoteId, session).catch(() => {}); } catch {}
  }
  return log;
}

// Increment or create a single session entry for the day and type
export function bumpDailySession(projectId, type, deltaMs) {
  if (!deltaMs) return null;
  const projects = load();
  const idx = projects.findIndex(p => p.id === projectId);
  if (idx === -1) return null;
  const today = ymd();
  const list = projects[idx].sessions || [];
  // find most recent session with same type and same date marker
  const matchIdx = list.findIndex(s => (s.type === type) && (s.date === today));
  if (matchIdx >= 0) {
    const s = { ...list[matchIdx] };
    s.durationMs = (s.durationMs || 0) + deltaMs;
    s.end = new Date().toISOString();
    list[matchIdx] = s;
  } else {
    list.unshift({ id: crypto.randomUUID(), type, date: today, start: new Date().toISOString(), end: new Date().toISOString(), durationMs: deltaMs });
  }
  projects[idx].sessions = list;
  projects[idx].totalMs = (projects[idx].totalMs || 0) + deltaMs;
  save(projects);
  return true;
}

// Best-effort mirror of an aggregate duration to server as a single session
export function mirrorAggregateToServer(projectId, type, durationMs) {
  if (!durationMs) return;
  const p = load().find(p => p.id === projectId);
  if (!p || !p.remoteId) return;
  const now = new Date();
  const session = { type, start: new Date(now.getTime() - durationMs).toISOString(), end: now.toISOString(), durationMs };
  try { apiPostSession(p.remoteId, session).catch(() => {}); } catch {}
}

export function deleteProject(projectId) {
  const projects = load();
  const next = projects.filter(p => p.id !== projectId);
  save(next);
}

export function clearAll() {
  save([]);
}

export function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
