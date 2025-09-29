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
  return load().find(p => p.id === id || p.remoteId === id) || null;
}

import {
  createProject as apiCreateProject,
  postSession as apiPostSession,
  getProjects as apiGetProjects,
  deleteProjectRemote,
  patchProjectRemote,
  getApiUser,
} from './serverApi';

function normalizeRemoteProject(doc) {
  if (!doc) return null;
  const id = doc.id || doc._id || doc.remoteId;
  return {
    id: String(id || crypto.randomUUID()),
    remoteId: id ? String(id) : null,
    name: doc.name || '',
    description: doc.description || '',
    createdAt: doc.createdAt || new Date().toISOString(),
    totalMs: doc.totalMs || 0,
    sessions: Array.isArray(doc.sessions) ? doc.sessions : [],
  };
}

export async function syncProjectsFromServer() {
  if (!getApiUser()) return load();
  try {
    const remote = await apiGetProjects();
    if (!Array.isArray(remote)) return load();
    const normalized = remote
      .map(normalizeRemoteProject)
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    save(normalized);
    return normalized;
  } catch (e) {
    console.warn('syncProjectsFromServer failed', e);
    return load();
  }
}

export async function addProject({ name, description = '' }) {
  const owner = getApiUser();
  if (owner) {
    try {
      const remote = await apiCreateProject({ name, description });
      const normalized = normalizeRemoteProject(remote);
      if (normalized) {
        const current = load().filter(p => p.id !== normalized.id && p.remoteId !== normalized.id);
        save([normalized, ...current]);
        return normalized;
      }
    } catch (err) {
      console.warn('createProject remote failed', err);
    }
  }
  const current = load();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const project = { id, name, description, createdAt: now, totalMs: 0, sessions: [], remoteId: null };
  current.unshift(project);
  save(current);
  return project;
}

export function updateProject(updated) {
  const projects = load();
  const idx = projects.findIndex(p => p.id === updated.id || p.remoteId === updated.id);
  if (idx === -1) return;
  const merged = { ...projects[idx], ...updated };
  projects[idx] = merged;
  save(projects);
  const remoteId = merged.remoteId || merged.id;
  if (remoteId && getApiUser()) {
    try {
      patchProjectRemote(remoteId, { name: merged.name, description: merged.description })
        .then(() => syncProjectsFromServer())
        .catch(() => {});
    } catch {}
  }
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
  const remoteId = projects[idx].remoteId || projectId;
  if (remoteId && getApiUser()) {
    try {
      apiPostSession(remoteId, session)
        .then(updated => {
          const normalized = normalizeRemoteProject(updated);
          if (!normalized) return;
          const current = load();
          const list = current.filter(p => p.id !== normalized.id && p.remoteId !== normalized.id);
          list.unshift(normalized);
          save(list);
        })
        .catch(() => {});
    } catch {}
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
  if (!p || !p.remoteId || !getApiUser()) return;
  const now = new Date();
  const session = { type, start: new Date(now.getTime() - durationMs).toISOString(), end: now.toISOString(), durationMs };
  try {
    if (!getApiUser()) throw new Error('no user');
    apiPostSession(p.remoteId, session)
      .then(updated => {
        const normalized = normalizeRemoteProject(updated);
        if (!normalized) return;
        const current = load().filter(x => x.id !== normalized.id && x.remoteId !== normalized.id);
        save([normalized, ...current]);
      })
      .catch(() => {});
  } catch {}
}

export function deleteProject(projectId) {
  const projects = load();
  const target = projects.find(p => p.id === projectId || p.remoteId === projectId);
  const next = projects.filter(p => p !== target);
  save(next);
  const remoteId = target?.remoteId || target?.id;
  if (remoteId) {
    try {
      deleteProjectRemote(remoteId).then(() => syncProjectsFromServer()).catch(() => {});
    } catch {}
  }
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
