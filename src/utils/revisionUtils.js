export const BD_TIME_ZONE = 'Asia/Dhaka';

export function getBdDateKey(date = new Date()) {
  const bdNow = new Date(date.toLocaleString('en-US', { timeZone: BD_TIME_ZONE }));
  const year = bdNow.getFullYear();
  const month = String(bdNow.getMonth() + 1).padStart(2, '0');
  const day = String(bdNow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatBdDate(date, options = {}) {
  if (!date) return '';
  const target = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(target.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: BD_TIME_ZONE, ...options }).format(target);
}

export function parseDateKey(key) {
  if (!key || typeof key !== 'string') return null;
  const trimmed = key.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [_, yearStr, monthStr, dayStr] = match;
  const date = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr)));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function computeRevisionDate(baseDate, afterDays) {
  if (afterDays === null || afterDays === undefined) return null;
  const parsed = Number(afterDays);
  if (!Number.isFinite(parsed)) return null;
  const base = baseDate instanceof Date ? new Date(baseDate) : parseDateKey(baseDate) || new Date();
  const result = new Date(base);
  result.setUTCDate(result.getUTCDate() + parsed);
  if (Number.isNaN(result.getTime())) return null;
  return result;
}

export function collectUpcomingRevisions(dailyLogs = [], options = {}) {
  const withinDays = Number.isFinite(options.withinDays) ? Number(options.withinDays) : 7;
  const now = new Date();
  const todayKey = getBdDateKey(now);
  let limitDate = null;
  if (withinDays >= 0) {
    limitDate = new Date(now);
    limitDate.setUTCDate(limitDate.getUTCDate() + withinDays);
  }

  const items = [];
  const seen = new Set();

  for (const entry of dailyLogs || []) {
    const entryDate = entry?.date ? new Date(entry.date) : parseDateKey(entry?.dateKey);
    const baseDate = entryDate && !Number.isNaN(entryDate.getTime()) ? entryDate : null;
    const studies = Array.isArray(entry?.studies) ? entry.studies : [];

    studies.forEach((study) => {
      if (!study) return;
      const studyId = study.id || study._id || study.topic || 'study';
      let revisions = Array.isArray(study.revisions) && study.revisions.length
        ? study.revisions
        : [];

      if (!revisions.length) {
        const fallbackDate = study.revisionDate || null;
        const fallbackAfter = study.revisionAfterDays ?? null;
        if (fallbackDate || fallbackAfter !== null) {
          revisions = [{
            id: `${studyId}-legacy`,
            date: fallbackDate,
            afterDays: fallbackAfter,
            isDone: Boolean(study.isRevised),
            doneAt: study.revisedAt || null,
          }];
        }
      }

      revisions.forEach((rev) => {
        if (!rev || rev.isDone) return;
        let target = rev.date ? new Date(rev.date) : null;
        if (target && Number.isNaN(target.getTime())) target = null;
        if (!target && (rev.afterDays !== null && rev.afterDays !== undefined)) {
          const computed = computeRevisionDate(baseDate || entry?.dateKey, rev.afterDays);
          if (computed) target = computed;
        }
        if (!target || Number.isNaN(target.getTime())) return;
        if (target < now) return;
        if (limitDate && target > limitDate) return;
        const key = `${entry.id || entry.dateKey || ''}-${studyId}-${rev.id || target.toISOString()}`;
        if (seen.has(key)) return;
        seen.add(key);
        items.push({
          id: key,
          topic: study.topic || 'Revision',
          date: target.toISOString(),
          dateObj: target,
          daysUntil: Math.max(0, Math.round((target - now) / (1000 * 60 * 60 * 24))),
        });
      });
    });
  }

  items.sort((a, b) => a.dateObj - b.dateObj);
  return items;
}

