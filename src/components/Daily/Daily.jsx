import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  createDailyLog,
  getDailyLog,
  updateDailyLog,
  getProjects,
} from '../../services/serverApi';
import FocusTools from './FocusTools';

const BD_TIME_ZONE = 'Asia/Dhaka';

function getBdDateKey(date = new Date()) {
  const bdNow = new Date(date.toLocaleString('en-US', { timeZone: BD_TIME_ZONE }));
  const year = bdNow.getFullYear();
  const month = String(bdNow.getMonth() + 1).padStart(2, '0');
  const day = String(bdNow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatBdDate(date, options = {}) {
  if (!date) return '';
  const target = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(target.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: BD_TIME_ZONE, ...options }).format(target);
}

function parseKeyToDate(key) {
  if (!key) return new Date();
  return new Date(`${key}T00:00:00Z`);
}

function addDaysToKey(key, days) {
  const date = parseKeyToDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return getBdDateKey(date);
}

function formatMinutes(totalMinutes) {
  const minutes = Math.round(totalMinutes || 0);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins} min`;
  if (!mins) return `${hours} hr${hours > 1 ? 's' : ''}`;
  return `${hours}h ${mins}m`;
}

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Math.random().toString(36).slice(2, 10)}`;
}

function buildRevisionDate(dateKey, afterDays, explicitDate) {
  if (explicitDate) {
    const direct = new Date(explicitDate);
    if (!Number.isNaN(direct.getTime())) return direct.toISOString();
  }
  if (afterDays === null || afterDays === undefined) return null;
  const days = Number(afterDays);
  if (!Number.isFinite(days)) return null;
  const base = parseKeyToDate(dateKey);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString();
}

const revisionPresets = [2, 3, 4, 5, 7, 14, 30];

const Daily = () => {
  const [selectedDate, setSelectedDate] = useState(() => getBdDateKey());
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]);

  const [todoInput, setTodoInput] = useState('');
  const [todoProjectId, setTodoProjectId] = useState('');
  const [todoMinutes, setTodoMinutes] = useState('');
  const [todoMinutesDraft, setTodoMinutesDraft] = useState({});

  const [timers, setTimers] = useState({});
  const [timerNow, setTimerNow] = useState(Date.now());

  const [studyTopic, setStudyTopic] = useState('');
  const [studyNotes, setStudyNotes] = useState('');
  const [studyRevisionDays, setStudyRevisionDays] = useState([]);
  const [studyRevisionDate, setStudyRevisionDate] = useState('');

  const [revisionDraft, setRevisionDraft] = useState({ studyId: null, days: '', date: '' });

  useEffect(() => {
    async function loadProjects() {
      try {
        const list = await getProjects();
        setProjects(Array.isArray(list) ? list : []);
      } catch (err) {
        console.warn('Failed to load projects', err);
      }
    }
    loadProjects();
  }, []);

  useEffect(() => {
    async function loadEntry(dateKey) {
      setLoading(true);
      setError('');
      try {
        let data = await getDailyLog(dateKey);
        if (!data) {
          data = await createDailyLog({ date: dateKey });
        }
        setEntry(data);
      } catch (err) {
        setError(err.message || 'Failed to load daily log');
      } finally {
        setLoading(false);
      }
    }
    loadEntry(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    setTodoMinutesDraft({});
    setTimers({});
  }, [entry?.id]);

  useEffect(() => {
    setTodoProjectId('');
    setTodoMinutes('');
    setStudyRevisionDays([]);
    setStudyRevisionDate('');
  }, [selectedDate]);

  const projectLookup = useMemo(() => {
    const map = new Map();
    projects.forEach((project) => {
      if (project && project.id) map.set(project.id, project.name || 'Untitled project');
    });
    return map;
  }, [projects]);

  const todos = useMemo(() => (
    (entry?.todos ?? []).map((todo) => ({
      ...todo,
      minutesSpent: Number(todo.minutesSpent) || 0,
      projectId: todo.projectId || '',
      projectName: todo.projectName || '',
    }))
  ), [entry]);

  const studies = useMemo(() => (
    (entry?.studies ?? []).map((study) => {
      const revisions = Array.isArray(study.revisions)
        ? study.revisions.map((rev) => ({
          ...rev,
          id: rev.id || generateId(),
          afterDays: rev.afterDays ?? rev.revisionAfterDays ?? null,
          date: rev.date || rev.revisionDate || null,
          isDone: Boolean(rev.isDone ?? rev.isRevised),
          doneAt: rev.doneAt || rev.revisedAt || null,
        }))
        : (() => {
          const afterDays = study.revisionAfterDays ?? null;
          const date = study.revisionDate || null;
          if (afterDays === null && !date) return [];
          return [{
            id: generateId(),
            afterDays,
            date,
            isDone: Boolean(study.isRevised),
            doneAt: study.revisedAt || null,
          }];
        })();
      return {
        ...study,
        revisions,
      };
    })
  ), [entry]);

  const runningExtras = useMemo(() => {
    const map = {};
    Object.entries(timers).forEach(([todoId, timer]) => {
      if (timer?.running) {
        const deltaMinutes = (timerNow - timer.startedAt) / 60000;
        map[todoId] = deltaMinutes > 0 ? deltaMinutes : 0;
      }
    });
    return map;
  }, [timers, timerNow]);

  const totalFocusMinutes = useMemo(() => (
    todos.reduce((sum, todo) => sum + (Number(todo.minutesSpent) || 0) + (runningExtras[todo.id] || 0), 0)
  ), [todos, runningExtras]);

  const runningCount = useMemo(() => (
    Object.values(timers).filter((timer) => timer?.running).length
  ), [timers]);

  useEffect(() => {
    if (!runningCount) return undefined;
    const id = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [runningCount]);

  async function ensureEntry() {
    if (entry && entry.id) return entry;
    const created = await createDailyLog({ date: selectedDate });
    setEntry(created);
    return created;
  }

  async function commitUpdate(patch) {
    try {
      setSaving(true);
      const current = await ensureEntry();
      const next = await updateDailyLog(current.id, patch);
      setEntry(next);
    } catch (err) {
      const message = err.message || 'Failed to save changes';
      setError(message);
      Swal.fire({ icon: 'error', title: 'Save failed', text: message });
    } finally {
      setSaving(false);
    }
  }

  const handleAddTodo = async (event) => {
    event.preventDefault();
    const title = todoInput.trim();
    const projectId = todoProjectId.trim();
    const projectName = projectId ? (projectLookup.get(projectId) || '') : '';
    const minutesValue = Number(todoMinutes);
    const minutesSpent = Number.isFinite(minutesValue) && minutesValue >= 0 ? minutesValue : 0;
    if (!title && !projectId) {
      setError('Add a title or pick a project for the todo');
      return;
    }
    const nowIso = new Date().toISOString();
    const nextTodos = [
      ...todos,
      {
        id: generateId(),
        title: title || projectName || 'Todo',
        done: false,
        projectId,
        projectName,
        minutesSpent,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];
    await commitUpdate({ todos: nextTodos });
    setTodoInput('');
    setTodoProjectId('');
    setTodoMinutes('');
  };

  const handleUpdateTodoProject = async (id, projectId) => {
    const projectName = projectId ? (projectLookup.get(projectId) || '') : '';
    const nowIso = new Date().toISOString();
    const nextTodos = todos.map((todo) => (todo.id === id ? {
      ...todo,
      projectId,
      projectName,
      updatedAt: nowIso,
    } : todo));
    await commitUpdate({ todos: nextTodos });
  };

  const handleMinutesDraftChange = (id, value) => {
    setTodoMinutesDraft((prev) => ({ ...prev, [id]: value }));
  };

  const handleCommitTodoMinutes = async (id) => {
    const value = todoMinutesDraft[id];
    const parsed = value === '' || value === undefined ? 0 : Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setTodoMinutesDraft((prev) => ({ ...prev, [id]: '' }));
      return;
    }
    const nowIso = new Date().toISOString();
    const nextTodos = todos.map((todo) => (todo.id === id ? {
      ...todo,
      minutesSpent: parsed,
      updatedAt: nowIso,
    } : todo));
    await commitUpdate({ todos: nextTodos });
    setTodoMinutesDraft((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleToggleTodo = async (id) => {
    const nowIso = new Date().toISOString();
    const nextTodos = todos.map((todo) => (todo.id === id ? { ...todo, done: !todo.done, updatedAt: nowIso } : todo));
    await commitUpdate({ todos: nextTodos });
  };

  const handleRemoveTodo = async (id) => {
    const nextTodos = todos.filter((todo) => todo.id !== id);
    setTimers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTodoMinutesDraft((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    await commitUpdate({ todos: nextTodos });
  };

  const handleStartTimer = (todo) => {
    if (timers[todo.id]?.running) return;
    setTimers((prev) => ({
      ...prev,
      [todo.id]: { running: true, startedAt: Date.now() },
    }));
    setTimerNow(Date.now());
  };

  const toggleRevisionDay = (value) => {
    setStudyRevisionDays((prev) => (prev.includes(value) ? prev.filter((day) => day !== value) : [...prev, value]));
  };

  const handleCancelRevisionDraft = () => {
    setRevisionDraft({ studyId: null, days: '', date: '' });
  };

  const handleStopTimer = async (todo) => {
    const timer = timers[todo.id];
    if (!timer?.running) return;
    const elapsedMinutes = Math.round((Date.now() - timer.startedAt) / 60000);
    setTimers((prev) => {
      const next = { ...prev };
      delete next[todo.id];
      return next;
    });
    if (!elapsedMinutes) return;
    const nowIso = new Date().toISOString();
    const nextTodos = todos.map((item) => (item.id === todo.id ? {
      ...item,
      minutesSpent: (Number(item.minutesSpent) || 0) + elapsedMinutes,
      updatedAt: nowIso,
    } : item));
    await commitUpdate({ todos: nextTodos });
  };

  const handleAddStudy = async (event) => {
    event.preventDefault();
    const topic = studyTopic.trim();
    if (!topic) {
      setError('Add a topic before saving');
      return;
    }
    const nowIso = new Date().toISOString();
    const uniqueDays = Array.from(new Set(studyRevisionDays.map((day) => Number(day)).filter((day) => Number.isFinite(day) && day >= 0)));
    const revisions = [];
    for (const day of uniqueDays) {
      const iso = buildRevisionDate(selectedDate, day, null);
      if (iso) {
        revisions.push({
          id: generateId(),
          afterDays: day,
          date: iso,
          isDone: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }
    if (studyRevisionDate) {
      const iso = buildRevisionDate(selectedDate, null, studyRevisionDate);
      if (iso) {
        revisions.push({
          id: generateId(),
          afterDays: null,
          date: iso,
          isDone: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }
    const nextStudies = [
      ...studies,
      {
        id: generateId(),
        topic,
        notes: studyNotes.trim(),
        revisions,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];
    await commitUpdate({ studies: nextStudies });
    setStudyTopic('');
    setStudyNotes('');
    setStudyRevisionDays([]);
    setStudyRevisionDate('');
  };

  const handleToggleRevision = async (studyId, revisionId, value) => {
    const nowIso = new Date().toISOString();
    const nextStudies = studies.map((study) => (study.id === studyId
      ? {
        ...study,
        revisions: (study.revisions || []).map((rev) => (rev.id === revisionId
          ? {
            ...rev,
            isDone: value,
            doneAt: value ? nowIso : null,
            updatedAt: nowIso,
          }
          : rev)),
        updatedAt: nowIso,
      }
      : study));
    await commitUpdate({ studies: nextStudies });
  };

  const handleRemoveRevision = async (studyId, revisionId) => {
    const nowIso = new Date().toISOString();
    const nextStudies = studies.map((study) => (study.id === studyId
      ? {
        ...study,
        revisions: (study.revisions || []).filter((rev) => rev.id !== revisionId),
        updatedAt: nowIso,
      }
      : study));
    await commitUpdate({ studies: nextStudies });
  };

  const handleAddRevisionReminder = async (event) => {
    event.preventDefault();
    const { studyId, days, date } = revisionDraft;
    if (!studyId) return;
    const target = studies.find((study) => study.id === studyId);
    if (!target) return;
    const nowIso = new Date().toISOString();
    const additions = [];
    if (days) {
      const parsed = Number(days);
      if (Number.isFinite(parsed) && parsed >= 0) {
        const iso = buildRevisionDate(selectedDate, parsed, null);
        if (iso) {
          additions.push({
            id: generateId(),
            afterDays: parsed,
            date: iso,
            isDone: false,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        }
      }
    }
    if (date) {
      const iso = buildRevisionDate(selectedDate, null, date);
      if (iso) {
        additions.push({
          id: generateId(),
          afterDays: null,
          date: iso,
          isDone: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }
    if (!additions.length) {
      handleCancelRevisionDraft();
      return;
    }
    const nextStudies = studies.map((study) => (study.id === studyId
      ? {
        ...study,
        revisions: [...(study.revisions || []), ...additions],
        updatedAt: nowIso,
      }
      : study));
    await commitUpdate({ studies: nextStudies });
    handleCancelRevisionDraft();
  };

  const handleRemoveStudy = async (id) => {
    const nextStudies = studies.filter((item) => item.id !== id);
    await commitUpdate({ studies: nextStudies });
  };

  const handleLogMinutes = async ({ todoId, minutes, title, projectId }) => {
    const amount = Math.max(0, Math.round(minutes));
    if (!amount) return;
    const nowIso = new Date().toISOString();

    if (todoId) {
      const target = todos.find((todo) => todo.id === todoId);
      if (!target) {
        Swal.fire({ icon: 'info', title: 'Todo not found', text: 'Pick a different todo before logging the timer.' });
        return;
      }
      const nextTodos = todos.map((todo) => (todo.id === todoId
        ? {
          ...todo,
          minutesSpent: (Number(todo.minutesSpent) || 0) + amount,
          updatedAt: nowIso,
        }
        : todo));
      await commitUpdate({ todos: nextTodos });
      Swal.fire({ icon: 'success', title: 'Time added to todo', timer: 1300, showConfirmButton: false });
      return;
    }

    const projectName = projectId ? (projectLookup.get(projectId) || '') : '';
    if (!title?.trim() && !projectId) {
      Swal.fire({ icon: 'info', title: 'Add details', text: 'Provide a title or choose a project before saving the timer.' });
      return;
    }
    const nextTodos = [
      ...todos,
      {
        id: generateId(),
        title: title?.trim() || projectName || 'Focus session',
        done: false,
        projectId: projectId || '',
        projectName,
        minutesSpent: amount,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];
    await commitUpdate({ todos: nextTodos });
    Swal.fire({ icon: 'success', title: 'New focus entry saved', timer: 1300, showConfirmButton: false });
  };

  const revisionUpcoming = useMemo(() => {
    const todayKey = getBdDateKey();
    const upcoming = [];
    studies.forEach((study) => {
      (study.revisions || []).forEach((rev) => {
        if (!rev?.date) return;
        const targetKey = getBdDateKey(new Date(rev.date));
        if (!rev.isDone && targetKey >= todayKey) {
          upcoming.push({
            ...rev,
            topic: study.topic,
          });
        }
      });
    });
    return upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [studies]);
  return (
    <div className='container mx-auto px-3 py-6 max-w-5xl'>
      <div className='space-y-6'>
        <header className='space-y-4'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <h1 className='text-2xl font-semibold'>Daily planner</h1>
            <div className='flex flex-wrap items-center gap-2'>
              <button
                type='button'
                className='btn btn-outline h-[42px]'
                onClick={() => setSelectedDate((prev) => addDaysToKey(prev, -1))}
              >
                Previous
              </button>
              <input
                className='input h-[42px] w-auto'
                type='date'
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
              <button
                type='button'
                className='btn btn-outline h-[42px]'
                onClick={() => setSelectedDate((prev) => addDaysToKey(prev, 1))}
              >
                Next
              </button>
            </div>
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            <article className='card flex flex-col gap-2'>
              <span className='text-sm text-neutral-500'>Focused time today</span>
              <span className='text-3xl font-semibold text-sky-500'>{formatMinutes(totalFocusMinutes)}</span>
              <span className='text-xs uppercase tracking-[0.18em] text-neutral-400'>{formatBdDate(parseKeyToDate(selectedDate), { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </article>
            <article className='card flex flex-col gap-2'>
              <span className='text-sm text-neutral-500'>Upcoming revision topics</span>
              {revisionUpcoming.length ? (
                <ul className='space-y-1 text-sm text-neutral-600'>
                  {revisionUpcoming.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      {item.topic}
                      {' '}• review on {formatBdDate(item.date, { day: 'numeric', month: 'short' })}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className='text-sm text-neutral-400'>No reviews scheduled.</span>
              )}
            </article>
          </div>
          {error && (
            <div
              className='rounded border border-danger-500 px-3 py-2 text-sm'
              style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#fecaca' }}
            >
              {error}
            </div>
          )}
        </header>

        <section className='card space-y-4 p-4 sm:p-6'>
          <header className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h2 className='text-lg font-semibold'>Today&apos;s todo list</h2>
              <p className='text-sm text-neutral-400'>Quick tasks you don&apos;t want to forget.</p>
            </div>
          </header>
          <form className='grid gap-3 sm:grid-cols-[2fr_1fr] lg:grid-cols-[2fr_1fr_1fr_auto]' onSubmit={handleAddTodo}>
            <label className='flex flex-col gap-1'>
              <span className='label'>Todo</span>
              <input
                className='input'
                placeholder='What needs to happen?'
                value={todoInput}
                onChange={(event) => setTodoInput(event.target.value)}
              />
            </label>
            <label className='flex flex-col gap-1'>
              <span className='label'>Project</span>
              <select
                className='input'
                value={todoProjectId}
                onChange={(event) => setTodoProjectId(event.target.value)}
              >
                <option value=''>No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </label>
            <label className='flex flex-col gap-1'>
              <span className='label'>Minutes (optional)</span>
              <input
                className='input'
                type='number'
                min='0'
                step='5'
                placeholder='30'
                value={todoMinutes}
                onChange={(event) => setTodoMinutes(event.target.value)}
              />
            </label>
            <button className='btn btn-primary sm:w-auto' type='submit' disabled={saving || (!todoInput.trim() && !todoProjectId)}>Add todo</button>
          </form>
          <ul className='space-y-3'>
            {todos.length === 0 && <li className='text-sm text-neutral-400'>No todos logged for today.</li>}
            {todos.map((todo) => {
              const hasDraft = Object.prototype.hasOwnProperty.call(todoMinutesDraft, todo.id);
              const draftValue = hasDraft ? todoMinutesDraft[todo.id] : Math.round(Number(todo.minutesSpent) || 0);
              const timer = timers[todo.id];
              const extraMinutes = runningExtras[todo.id] || 0;
              const totalMinutesLabel = formatMinutes((Number(todo.minutesSpent) || 0) + extraMinutes);
              const inputValue = draftValue === '' ? '' : String(draftValue);
              return (
                <li key={todo.id} className='space-y-3 rounded border border-neutral-200/60 bg-white/80 px-3 py-3 text-sm shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/40'>
                  <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                    <label className='flex items-center gap-3'>
                      <input
                        type='checkbox'
                        checked={Boolean(todo.done)}
                        onChange={() => handleToggleTodo(todo.id)}
                      />
                      <span className={todo.done ? 'line-through text-neutral-400' : 'font-medium text-neutral-800 dark:text-neutral-100'}>{todo.title}</span>
                    </label>
                    <div className='flex items-center gap-2'>
                      <button
                        type='button'
                        className='tt-button tt-button-outline text-xs'
                        onClick={() => handleRemoveTodo(todo.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
                    <div className='flex flex-wrap items-center gap-3'>
                      <label className='flex items-center gap-2 text-xs text-neutral-500'>
                        <span>Project</span>
                        <select
                          className='input h-9 w-auto text-sm'
                          value={todo.projectId}
                          onChange={(event) => handleUpdateTodoProject(todo.id, event.target.value)}
                        >
                          <option value=''>No project</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>{project.name}</option>
                          ))}
                        </select>
                      </label>
                      <span className='text-xs text-neutral-500'>Total: <span className='font-mono text-neutral-800 dark:text-neutral-100'>{totalMinutesLabel}</span></span>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                      <input
                        className='input h-9 w-24 text-sm'
                        type='number'
                        min='0'
                        step='5'
                        value={inputValue}
                        onChange={(event) => handleMinutesDraftChange(todo.id, event.target.value)}
                        onBlur={() => handleCommitTodoMinutes(todo.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleCommitTodoMinutes(todo.id);
                          }
                        }}
                      />
                      <button
                        type='button'
                        className='tt-button tt-button-outline text-xs'
                        onClick={() => (timer?.running ? handleStopTimer(todo) : handleStartTimer(todo))}
                      >
                        {timer?.running ? 'Stop timer' : 'Start timer'}
                      </button>
                      {timer?.running && <span className='text-xs text-success-500'>Running…</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className='card space-y-4 p-4 sm:p-6'>
          <header className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h2 className='text-lg font-semibold'>Topics learnt today</h2>
              <p className='text-sm text-neutral-400'>Capture what you studied and schedule the next revision.</p>
            </div>
          </header>
          <form className='grid gap-3 sm:grid-cols-2' onSubmit={handleAddStudy}>
            <label className='flex flex-col gap-1 sm:col-span-2'>
              <span className='label'>Topic</span>
              <input
                className='input'
                placeholder='e.g. React context, Mongo aggregations'
                value={studyTopic}
                onChange={(event) => setStudyTopic(event.target.value)}
                required
              />
            </label>
            <div className='flex flex-col gap-2 sm:col-span-2'>
              <span className='label'>Revision reminders</span>
              <div className='flex flex-wrap gap-2'>
                {revisionPresets.map((value) => {
                  const active = studyRevisionDays.includes(value);
                  return (
                    <button
                      key={value}
                      type='button'
                      className={`btn text-xs ${active ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => toggleRevisionDay(value)}
                    >
                      +{value} day{value > 1 ? 's' : ''}
                    </button>
                  );
                })}
              </div>
              <p className='text-xs text-neutral-400'>Pick one or more reminders to queue revisions automatically.</p>
            </div>
            <label className='flex flex-col gap-1'>
              <span className='label'>Custom revision date (optional)</span>
              <input
                className='input'
                type='date'
                value={studyRevisionDate}
                onChange={(event) => setStudyRevisionDate(event.target.value)}
              />
            </label>
            <label className='flex flex-col gap-1 sm:col-span-2'>
              <span className='label'>Notes</span>
              <textarea
                className='textarea'
                rows={2}
                placeholder='Key takeaways, resources, or questions to revisit'
                value={studyNotes}
                onChange={(event) => setStudyNotes(event.target.value)}
              />
            </label>
            <div className='sm:col-span-2'>
              <button className='btn btn-primary w-full sm:w-auto' type='submit' disabled={saving}>Add topic</button>
            </div>
          </form>

          <div className='space-y-3'>
            {studies.length === 0 && <p className='text-sm text-neutral-400'>No study notes added for today.</p>}
            {studies.map((item) => {
              const sortedRevisions = (item.revisions || []).slice().sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
              return (
                <article key={item.id} className='space-y-3 rounded-lg border border-neutral-200/60 bg-white/80 p-3 text-sm shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/40'>
                  <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                    <div className='space-y-1'>
                      <div className='flex items-center gap-2'>
                        <span className='rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-500/20 dark:text-purple-200'>Topic</span>
                        <span className='font-semibold text-neutral-800 dark:text-neutral-100'>{item.topic}</span>
                      </div>
                      {item.notes && <p className='text-xs text-neutral-500'>{item.notes}</p>}
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      <button
                        type='button'
                        className='tt-button tt-button-outline text-xs'
                        onClick={() => setRevisionDraft({ studyId: item.id, days: '', date: '' })}
                      >
                        + Add reminder
                      </button>
                      <button
                        type='button'
                        className='tt-button tt-button-outline text-xs'
                        onClick={() => handleRemoveStudy(item.id)}
                      >
                        Remove topic
                      </button>
                    </div>
                  </div>
                  <div className='space-y-2'>
                    {sortedRevisions.length ? (
                      sortedRevisions.map((rev) => (
                        <div key={rev.id} className='rounded border border-neutral-200/60 bg-white/80 p-3 text-xs shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/30'>
                          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                            <span>
                              Review {rev.date ? formatBdDate(rev.date, { day: 'numeric', month: 'short' }) : 'unscheduled'}
                              {rev.afterDays !== null && rev.afterDays !== undefined ? ` (+${rev.afterDays}d)` : ''}
                            </span>
                            <div className='flex items-center gap-2'>
                              <label className='flex items-center gap-2'>
                                <input
                                  type='checkbox'
                                  checked={Boolean(rev.isDone)}
                                  onChange={(event) => handleToggleRevision(item.id, rev.id, event.target.checked)}
                                />
                                <span>{rev.isDone ? 'Revised' : 'Pending'}</span>
                              </label>
                              <button
                                type='button'
                                className='tt-button tt-button-outline text-xs'
                                onClick={() => handleRemoveRevision(item.id, rev.id)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className='text-xs text-neutral-400'>No reminders scheduled.</p>
                    )}
                  </div>
                  {revisionDraft.studyId === item.id && (
                    <form className='grid gap-2 sm:grid-cols-[1fr_1fr_auto]' onSubmit={handleAddRevisionReminder}>
                      <label className='flex flex-col gap-1'>
                        <span className='label'>Spacing days</span>
                        <select
                          className='input'
                          value={revisionDraft.days}
                          onChange={(event) => setRevisionDraft((prev) => ({ ...prev, days: event.target.value }))}
                        >
                          <option value=''>Skip</option>
                          {revisionPresets.map((value) => (
                            <option key={value} value={value}>+{value} day{value > 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </label>
                      <label className='flex flex-col gap-1'>
                        <span className='label'>Custom date</span>
                        <input
                          className='input'
                          type='date'
                          value={revisionDraft.date}
                          onChange={(event) => setRevisionDraft((prev) => ({ ...prev, date: event.target.value }))}
                        />
                      </label>
                      <div className='flex items-center gap-2'>
                        <button className='btn btn-primary text-xs' type='submit'>Save</button>
                        <button className='btn btn-outline text-xs' type='button' onClick={handleCancelRevisionDraft}>Cancel</button>
                      </div>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
      {loading && (
        <div className='fixed inset-x-0 bottom-6 mx-auto w-fit rounded-full bg-neutral-900/80 px-4 py-2 text-xs text-white shadow-lg'>
          Loading daily data…
        </div>
      )}
      <FocusTools todos={todos} projects={projects} onLogMinutes={handleLogMinutes} />
    </div>
  );
};

export default Daily;
