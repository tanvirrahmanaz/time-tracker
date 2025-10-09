import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const tabs = [
  { id: 'stopwatch', label: 'Timer' },
  { id: 'countdown', label: 'Countdown' },
  { id: 'pomodoro', label: 'Pomodoro' },
];

const FocusTools = ({ todos, projects = [], onLogMinutes }) => {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [activeTab, setActiveTab] = useState('stopwatch');
  const [selectedTodoId, setSelectedTodoId] = useState('');
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoProjectId, setNewTodoProjectId] = useState('');

  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchStart, setStopwatchStart] = useState(null);
  const [stopwatchElapsed, setStopwatchElapsed] = useState(0);

  const [countdownInput, setCountdownInput] = useState('25');
  const [countdownRunning, setCountdownRunning] = useState(false);
  const [countdownTarget, setCountdownTarget] = useState(null);
  const [countdownRemaining, setCountdownRemaining] = useState(0);
  const [countdownInitial, setCountdownInitial] = useState(0);

  const [pomodoroWork, setPomodoroWork] = useState(25);
  const [pomodoroBreak, setPomodoroBreak] = useState(5);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const [pomodoroPhase, setPomodoroPhase] = useState('work');
  const [pomodoroTarget, setPomodoroTarget] = useState(null);
  const [pomodoroRemaining, setPomodoroRemaining] = useState(0);

  const todoOptions = useMemo(() => (
    todos.map((todo) => ({ id: todo.id, label: todo.title || 'Todo', minutes: Number(todo.minutesSpent) || 0 }))
  ), [todos]);

  const logMinutes = useCallback(async (minutes, sourceLabel) => {
    const amount = Math.max(0, Math.round(minutes));
    if (!amount) return;
    try {
      await onLogMinutes({
        todoId: selectedTodoId || null,
        title: newTodoTitle,
        projectId: newTodoProjectId,
        minutes: amount,
        source: sourceLabel,
      });
      if (!selectedTodoId) {
        setNewTodoTitle('');
        setNewTodoProjectId('');
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed to log time', text: err.message || 'Please try again.' });
    }
  }, [selectedTodoId, newTodoTitle, newTodoProjectId, onLogMinutes]);

  useEffect(() => {
    if (!stopwatchRunning) return undefined;
    const id = setInterval(() => {
      setStopwatchElapsed(Date.now() - stopwatchStart);
    }, 200);
    return () => clearInterval(id);
  }, [stopwatchRunning, stopwatchStart]);

  useEffect(() => {
    if (!countdownRunning || !countdownTarget) return undefined;
    const id = setInterval(() => {
      const remaining = countdownTarget - Date.now();
      if (remaining <= 0) {
        clearInterval(id);
        setCountdownRunning(false);
        setCountdownRemaining(0);
        setCountdownInitial(0);
        setCountdownTarget(null);
        if (countdownInitial > 0) {
          logMinutes(countdownInitial / 60000, 'Countdown finished');
        }
      } else {
        setCountdownRemaining(remaining);
      }
    }, 200);
    return () => clearInterval(id);
  }, [countdownRunning, countdownTarget, countdownInitial, logMinutes]);

  useEffect(() => {
    if (!pomodoroRunning || !pomodoroTarget) return undefined;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const remaining = pomodoroTarget - Date.now();
      if (remaining <= 0) {
        if (pomodoroPhase === 'work') {
          const minutes = Number(pomodoroWork);
          if (minutes > 0) logMinutes(minutes, 'Pomodoro work session');
          const breakMs = Math.max(0, Number(pomodoroBreak) * 60000);
          setPomodoroPhase('break');
          setPomodoroTarget(Date.now() + breakMs);
          setPomodoroRemaining(breakMs);
          if (breakMs === 0) {
            setPomodoroPhase('work');
            const workMs = Math.max(0, Number(pomodoroWork) * 60000);
            setPomodoroTarget(Date.now() + workMs);
            setPomodoroRemaining(workMs);
          }
        } else {
          const workMs = Math.max(0, Number(pomodoroWork) * 60000);
          setPomodoroPhase('work');
          setPomodoroTarget(Date.now() + workMs);
          setPomodoroRemaining(workMs);
        }
      } else {
        setPomodoroRemaining(remaining);
      }
      if (!cancelled) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [pomodoroRunning, pomodoroTarget, pomodoroPhase, pomodoroWork, pomodoroBreak, logMinutes]);

  const resetStopwatch = () => {
    setStopwatchRunning(false);
    setStopwatchStart(null);
    setStopwatchElapsed(0);
  };

  const startStopwatch = () => {
    if (stopwatchRunning) return;
    setStopwatchStart(Date.now() - stopwatchElapsed);
    setStopwatchRunning(true);
  };

  const stopStopwatch = async () => {
    const totalMs = stopwatchRunning ? Date.now() - stopwatchStart : stopwatchElapsed;
    resetStopwatch();
    if (totalMs > 0) await logMinutes(totalMs / 60000, 'Timer session');
  };

  const startCountdown = () => {
    if (countdownRunning) return;
    const minutes = Number(countdownInput);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      Swal.fire({ icon: 'info', title: 'Set a duration', text: 'Enter minutes greater than zero.' });
      return;
    }
    const ms = minutes * 60000;
    setCountdownInitial(ms);
    setCountdownTarget(Date.now() + ms);
    setCountdownRemaining(ms);
    setCountdownRunning(true);
  };

  const stopCountdown = async (log = false) => {
    const running = countdownRunning;
    const target = countdownTarget;
    const remaining = running && target ? Math.max(0, target - Date.now()) : countdownRemaining;
    setCountdownRunning(false);
    setCountdownRemaining(0);
    setCountdownInitial(0);
    setCountdownTarget(null);
    const spent = (countdownInitial - remaining) / 60000;
    if (log && spent > 0) await logMinutes(spent, 'Countdown session');
  };

  const startPomodoro = () => {
    if (pomodoroRunning) return;
    const workMs = Math.max(0, Number(pomodoroWork) * 60000);
    const breakMs = Math.max(0, Number(pomodoroBreak) * 60000);
    if (!workMs) {
      Swal.fire({ icon: 'info', title: 'Set work duration', text: 'Work minutes must be greater than zero.' });
      return;
    }
    setPomodoroPhase('work');
    setPomodoroTarget(Date.now() + workMs);
    setPomodoroRemaining(workMs);
    setPomodoroRunning(true);
    if (breakMs === 0) setPomodoroBreak(0);
  };

  const stopPomodoro = () => {
    setPomodoroRunning(false);
    setPomodoroTarget(null);
    setPomodoroRemaining(0);
    setPomodoroPhase('work');
  };

  const renderStopwatch = () => (
    <div className='space-y-3'>
      <div className='text-center text-4xl font-semibold tracking-tight'>{formatClock(stopwatchRunning ? Date.now() - stopwatchStart : stopwatchElapsed)}</div>
      <div className='flex flex-wrap items-center justify-center gap-2'>
        {!stopwatchRunning ? (
          <button className='btn btn-primary' type='button' onClick={startStopwatch}>Start</button>
        ) : (
          <button className='btn btn-primary' type='button' onClick={stopStopwatch}>Stop & Log</button>
        )}
        <button className='btn btn-outline' type='button' onClick={resetStopwatch} disabled={stopwatchRunning && stopwatchElapsed === 0}>Reset</button>
      </div>
    </div>
  );

  const renderCountdown = () => (
    <div className='space-y-3'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
        <label className='flex flex-col gap-1 text-sm'>
          <span>Minutes</span>
          <input
            className='input'
            type='number'
            min='1'
            step='1'
            value={countdownInput}
            onChange={(event) => setCountdownInput(event.target.value)}
            disabled={countdownRunning}
          />
        </label>
        <div className='flex flex-1 items-center justify-center text-4xl font-semibold tracking-tight'>
          {formatClock(countdownRunning ? countdownRemaining : countdownRemaining || Number(countdownInput) * 60000)}
        </div>
      </div>
      <div className='flex flex-wrap items-center justify-center gap-2'>
        {!countdownRunning ? (
          <button className='btn btn-primary' type='button' onClick={startCountdown}>Start</button>
        ) : (
          <button className='btn btn-primary' type='button' onClick={() => stopCountdown(true)}>Stop & Log</button>
        )}
        <button className='btn btn-outline' type='button' onClick={() => { setCountdownRunning(false); setCountdownRemaining(0); }} disabled={!countdownRunning && countdownRemaining === 0}>Reset</button>
      </div>
    </div>
  );

  const renderPomodoro = () => (
    <div className='space-y-3'>
      <div className='grid gap-2 sm:grid-cols-2'>
        <label className='flex flex-col gap-1 text-sm'>
          <span>Work minutes</span>
          <input
            className='input'
            type='number'
            min='1'
            step='1'
            value={pomodoroWork}
            onChange={(event) => setPomodoroWork(event.target.value)}
            disabled={pomodoroRunning}
          />
        </label>
        <label className='flex flex-col gap-1 text-sm'>
          <span>Break minutes</span>
          <input
            className='input'
            type='number'
            min='0'
            step='1'
            value={pomodoroBreak}
            onChange={(event) => setPomodoroBreak(event.target.value)}
            disabled={pomodoroRunning}
          />
        </label>
      </div>
      <div className='text-center text-sm uppercase tracking-[0.18em] text-neutral-500'>
        Phase: <span className='font-semibold text-neutral-700'>{pomodoroPhase === 'work' ? 'Focus' : 'Break'}</span>
      </div>
      <div className='text-center text-4xl font-semibold tracking-tight'>{formatClock(pomodoroRemaining)}</div>
      <div className='flex flex-wrap items-center justify-center gap-2'>
        {!pomodoroRunning ? (
          <button className='btn btn-primary' type='button' onClick={startPomodoro}>Start</button>
        ) : (
          <button className='btn btn-primary' type='button' onClick={stopPomodoro}>Stop</button>
        )}
        <button className='btn btn-outline' type='button' onClick={() => { stopPomodoro(); }} disabled={!pomodoroRunning && pomodoroRemaining === 0}>Reset</button>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'countdown':
        return renderCountdown();
      case 'pomodoro':
        return renderPomodoro();
      case 'stopwatch':
      default:
        return renderStopwatch();
    }
  };

  const panelClass = full
    ? 'fixed inset-4 z-50 flex flex-col rounded-3xl border border-neutral-200/80 bg-white/95 p-4 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900/95'
    : 'fixed bottom-5 right-5 z-50 flex w-full max-w-md flex-col rounded-3xl border border-neutral-200/80 bg-white/95 p-4 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900/95';

  return (
    <>
      {!open && (
        <button
          type='button'
          className='btn btn-primary fixed bottom-5 right-5 z-40 shadow-lg'
          onClick={() => setOpen(true)}
        >
          Focus tools
        </button>
      )}
      {open && (
        <div className={panelClass}>
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='text-lg font-semibold'>Focus tools</h2>
              <p className='text-xs text-neutral-500'>Log time straight into your daily planner.</p>
            </div>
            <div className='flex items-center gap-2'>
              <button type='button' className='tt-button tt-button-outline text-xs' onClick={() => setFull((prev) => !prev)}>
                {full ? 'Window' : 'Fullscreen'}
              </button>
              <button type='button' className='tt-button tt-button-outline text-xs' onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>

          <div className='mt-4 flex gap-2'>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type='button'
                className={`btn flex-1 text-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className='mt-4'>{renderTabContent()}</div>

          <div className='mt-6 space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-700'>
            <div className='flex flex-col gap-2'>
              <label className='flex flex-col gap-1 text-xs uppercase tracking-[0.18em] text-neutral-500'>Log to todo</label>
              <select
                className='input'
                value={selectedTodoId}
                onChange={(event) => setSelectedTodoId(event.target.value)}
              >
                <option value=''>Create new entry</option>
                {todoOptions.map((todo) => (
                  <option key={todo.id} value={todo.id}>
                    {todo.label}
                  </option>
                ))}
              </select>
            </div>
            {!selectedTodoId && (
              <div className='grid gap-3 sm:grid-cols-2'>
                <label className='flex flex-col gap-1 text-sm'>
                  <span>Title</span>
                  <input
                    className='input'
                    placeholder='e.g. Focus session'
                    value={newTodoTitle}
                    onChange={(event) => setNewTodoTitle(event.target.value)}
                  />
                </label>
                <label className='flex flex-col gap-1 text-sm'>
                  <span>Project</span>
                  <select
                    className='input'
                    value={newTodoProjectId}
                    onChange={(event) => setNewTodoProjectId(event.target.value)}
                  >
                    <option value=''>No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default FocusTools;
