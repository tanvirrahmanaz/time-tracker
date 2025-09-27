// Lightweight client for the local Express API
// Base URL resolution priority:
// 1) import.meta.env.VITE_API_URL
// 2) window.__TT_API__ (set from console for quick testing)
// 3) localStorage 'tt_api_url'
// 4) http://localhost:5174

let baseOverride = null;
export function setApiBase(url) { baseOverride = url; }

const fallback = 'http://localhost:5174';
export const getBaseUrl = () => {
  if (baseOverride) return baseOverride;
  // Vite env if provided
  const envUrl = (typeof import !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || null;
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined') {
    const win = window;
    const fromWin = win.__TT_API__ || localStorage.getItem('tt_api_url');
    if (fromWin) return fromWin;
  }
  return fallback;
};

async function http(path, opts = {}) {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // Friendlier hint if server route is missing or server down
    const hint = text && text.includes('Cannot') ? `Check API base ${getBaseUrl()} and that the server is running.` : '';
    throw new Error(`API ${res.status} ${res.statusText} at ${url}${hint ? ' — ' + hint : ''}`);
  }
  return res.json();
}

export async function createProject({ name, description = '' }) {
  return http('/projects', { method: 'POST', body: JSON.stringify({ name, description }) });
}

export async function postSession(projectRemoteId, session) {
  return http(`/projects/${projectRemoteId}/sessions`, { method: 'POST', body: JSON.stringify(session) });
}

export async function getProjects() {
  return http('/projects');
}

export async function getProject(id) {
  return http(`/projects/${id}`);
}

// Spend tracker
export async function listSpend() {
  try {
    return await http('/spend');
  } catch (e) {
    // If spend route missing, return empty list so UI stays usable
    if (String(e.message || '').includes('/spend')) return [];
    throw e;
  }
}

export async function createSpend(entry) {
  return http('/spend', { method: 'POST', body: JSON.stringify(entry) });
}
