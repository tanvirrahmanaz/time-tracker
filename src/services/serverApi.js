// Lightweight client for the local Express API
// Base URL resolution priority:
// 1) import.meta.env.VITE_API_URL
// 2) window.__TT_API__ (set from console for quick testing)
// 3) localStorage 'tt_api_url'
// 4) http://localhost:5174

let baseOverride = null;
export function setApiBase(url) { baseOverride = url; }

const localDefault = 'http://localhost:5174';
const hostedDefault = 'https://time-tracker-server-sable.vercel.app';

const fallback = typeof window !== 'undefined'
  ? (['127.0.0.1', 'localhost'].includes(window.location.hostname) ? localDefault : hostedDefault)
  : hostedDefault;

let userOverride = null;
export function setApiUser(value) {
  userOverride = value ? String(value).toLowerCase() : null;
}
export function getApiUser() { return userOverride; }
export const getBaseUrl = () => {
  if (baseOverride) return baseOverride;
  // Vite env if provided
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || null;
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
    headers: {
      'Content-Type': 'application/json',
      ...(userOverride ? { 'x-user': userOverride } : {}),
      ...(opts.headers || {}),
    },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // Friendlier hint if server route is missing or server down
    const hint = text && text.includes('Cannot') ? `Check API base ${getBaseUrl()} and that the server is running.` : '';
    throw new Error(`API ${res.status} ${res.statusText} at ${url}${hint ? ' — ' + hint : ''}`);
  }
  if (res.status === 204) return null;
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

export async function deleteProjectRemote(id) {
  return http(`/projects/${id}`, { method: 'DELETE' });
}

export async function patchProjectRemote(id, payload) {
  return http(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

// Spend tracker
export async function listSpend(params = {}) {
  const search = new URLSearchParams();
  if (params.month) search.set('month', params.month);
  if (params.mustSpend) search.set('must', String(params.mustSpend));
  const qs = search.toString();
  try {
    return await http(`/spend${qs ? `?${qs}` : ''}`);
  } catch (e) {
    // If spend route missing, return empty list so UI stays usable
    if (String(e.message || '').includes('/spend')) return [];
    throw e;
  }
}

export async function listMustSpend(monthKey) {
  return listSpend({ month: monthKey, mustSpend: true });
}

export async function createSpend(entry) {
  return http('/spend', { method: 'POST', body: JSON.stringify(entry) });
}

export async function updateSpend(id, payload) {
  return http(`/spend/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteSpend(id) {
  return http(`/spend/${id}`, { method: 'DELETE' });
}

// Daily logs
export async function getDailyLog(dateKey) {
  const search = new URLSearchParams();
  if (dateKey) search.set('date', dateKey);
  const qs = search.toString();
  return http(`/daily${qs ? `?${qs}` : ''}`);
}

export async function listDailyLogs(params = {}) {
  const search = new URLSearchParams();
  if (params.month) search.set('month', params.month);
  if (params.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  return http(`/daily${qs ? `?${qs}` : ''}`);
}

export async function createDailyLog(payload) {
  return http('/daily', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateDailyLog(id, payload) {
  return http(`/daily/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteDailyLog(id) {
  return http(`/daily/${id}`, { method: 'DELETE' });
}

// Question bank
export async function listQuestionTopics() {
  return http('/question-topics');
}

export async function createQuestionTopic(payload) {
  return http('/question-topics', { method: 'POST', body: JSON.stringify(payload || {}) });
}

export async function updateQuestionTopic(id, payload) {
  return http(`/question-topics/${id}`, { method: 'PATCH', body: JSON.stringify(payload || {}) });
}

export async function deleteQuestionTopic(id, { reassign = false } = {}) {
  const search = reassign ? '?reassign=true' : '';
  return http(`/question-topics/${id}${search}`, { method: 'DELETE' });
}

export async function listQuestions(params = {}) {
  const search = new URLSearchParams();
  if (params.topicId) search.set('topicId', params.topicId);
  if (params.difficulty) search.set('difficulty', params.difficulty);
  if (params.favorite !== undefined) search.set('favorite', String(params.favorite));
  if (params.tag) search.set('tag', params.tag);
  if (params.search) search.set('search', params.search);
  if (params.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  return http(`/questions${qs ? `?${qs}` : ''}`);
}

export async function createQuestion(payload) {
  return http('/questions', { method: 'POST', body: JSON.stringify(payload || {}) });
}

export async function updateQuestion(id, payload) {
  return http(`/questions/${id}`, { method: 'PATCH', body: JSON.stringify(payload || {}) });
}

export async function deleteQuestion(id) {
  return http(`/questions/${id}`, { method: 'DELETE' });
}

export async function reviewQuestion(id, payload = {}) {
  return http(`/questions/${id}/review`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function listQuestionReminders(params = {}) {
  const search = new URLSearchParams();
  if (params.withinDays) search.set('withinDays', String(params.withinDays));
  if (params.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  return http(`/questions/reminders${qs ? `?${qs}` : ''}`);
}
