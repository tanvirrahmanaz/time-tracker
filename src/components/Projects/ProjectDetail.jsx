import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addSessionToProject, bumpDailySession, mirrorAggregateToServer, formatDuration, getProjectById, updateProject } from '../../services/storage';
import { createProject as apiCreateProject } from '../../services/serverApi';

function useForceRerender() {
  const [, setTick] = useState(0);
  return () => setTick(t => t + 1);
}

const Stopwatch = ({ projectId, onSaved }) => {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  const timerRef = useRef(null);
  const chunkRef = useRef(0);
  const flushRef = useRef(0);

  useEffect(() => {
    if (running) {
      if (!startRef.current) startRef.current = Date.now() - elapsed;
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startRef.current);
        // accumulate ~200ms ticks into 10s local updates (no server spam)
        chunkRef.current += 200;
        if (chunkRef.current >= 10000) {
          bumpDailySession(projectId, 'stopwatch', 10000);
          flushRef.current += 10000;
          onSaved?.();
          chunkRef.current -= 10000;
        }
      }, 200);
    }
    return () => clearInterval(timerRef.current);
  }, [running]);

  const start = () => setRunning(true);
  const pause = () => {
    setRunning(false);
    clearInterval(timerRef.current);
    // flush remainder locally and mirror once
    const rem = chunkRef.current;
    if (rem > 0) {
      bumpDailySession(projectId, 'stopwatch', rem);
      flushRef.current += rem;
      onSaved?.();
      chunkRef.current = 0;
    }
    if (flushRef.current > 0) {
      mirrorAggregateToServer(projectId, 'stopwatch', flushRef.current);
      flushRef.current = 0;
    }
  };
  const reset = () => {
    setRunning(false);
    clearInterval(timerRef.current);
    startRef.current = null;
    setElapsed(0);
    chunkRef.current = 0;
    flushRef.current = 0;
  };
  const save = () => {
    if (elapsed < 1000) return; // ignore very short
    const end = new Date();
    const start = new Date(end.getTime() - elapsed);
    addSessionToProject(projectId, {
      type: 'stopwatch',
      start: start.toISOString(),
      end: end.toISOString(),
      durationMs: elapsed,
    });
    onSaved?.();
    reset();
  };

  return (
    <div className='card'>
      <h3 className='font-medium mb-2'>Stopwatch</h3>
      <div className='text-3xl font-mono mb-3 text-white fs-time'>{formatDuration(elapsed)}</div>
      <div className='flex gap-2'>
        {!running && <button className='btn btn-primary' onClick={start}>Start</button>}
        {running && <button className='btn btn-outline' onClick={pause}>Pause</button>}
        <button className='btn btn-outline' onClick={reset}>Reset</button>
      </div>
    </div>
  );
};

const Countdown = ({ projectId, onSaved }) => {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const calcMs = (h, m, s) => (Math.max(0, Number(h) || 0) * 3600 + Math.max(0, Number(m) || 0) * 60 + Math.max(0, Number(s) || 0)) * 1000;
  const [remaining, setRemaining] = useState(calcMs(0, 25, 0));
  const [running, setRunning] = useState(false);
  const targetRef = useRef(null);
  const ref = useRef(null);
  const flushPomRef = useRef(0);
  const chunkAccRef = useRef(0);
  const flushCountdownRef = useRef(0);

  useEffect(() => {
    if (running) {
      if (!targetRef.current) targetRef.current = Date.now() + remaining;
      ref.current = setInterval(() => {
        const left = Math.max(0, targetRef.current - Date.now());
        setRemaining(left);
        const delta = Math.min(200, left);
        chunkAccRef.current += delta;
        if (chunkAccRef.current >= 10000) {
          bumpDailySession(projectId, 'countdown', 10000);
          flushCountdownRef.current += 10000;
          onSaved?.();
          chunkAccRef.current -= 10000;
        }
        if (left <= 0) {
          setRunning(false);
          clearInterval(ref.current);
          // flush remainder (<10s)
          const rem = chunkAccRef.current;
          if (rem > 0) {
            bumpDailySession(projectId, 'countdown', rem);
            flushCountdownRef.current += rem;
            onSaved?.();
            chunkAccRef.current = 0;
          }
          if (flushCountdownRef.current > 0) {
            mirrorAggregateToServer(projectId, 'countdown', flushCountdownRef.current);
            flushCountdownRef.current = 0;
          }
        }
      }, 200);
    }
    return () => clearInterval(ref.current);
  }, [running]);

  const applyInput = () => {
    const ms = calcMs(hours, minutes, seconds);
    setRemaining(ms);
    targetRef.current = null;
  };

  const reset = () => {
    setRunning(false);
    clearInterval(ref.current);
    chunkAccRef.current = 0;
    setRemaining(calcMs(hours, minutes, seconds));
    targetRef.current = null;
  };

  const display = formatDuration(remaining);

  return (
    <div className='card'>
      <h3 className='font-medium mb-2'>Countdown</h3>
      <div className='flex items-end gap-2 mb-3'>
        <div>
          <label className='block text-xs text-neutral-400'>Hours</label>
          <input className='input w-24' type='number' value={hours} onChange={e => setHours(e.target.value)} />
        </div>
        <div>
          <label className='block text-xs text-neutral-400'>Minutes</label>
          <input className='input w-24' type='number' value={minutes} onChange={e => setMinutes(e.target.value)} />
        </div>
        <div>
          <label className='block text-xs text-neutral-400'>Seconds</label>
          <input className='input w-24' type='number' value={seconds} onChange={e => setSeconds(e.target.value)} />
        </div>
        <button className='btn btn-outline' onClick={applyInput}>Set</button>
      </div>
      <div className='text-3xl font-mono mb-3 text-white fs-time'>{display}</div>
      <div className='flex gap-2'>
        {!running && <button className='btn btn-primary' onClick={() => setRunning(true)} disabled={remaining <= 0}>Start</button>}
        {running && <button className='btn btn-outline' onClick={() => {
          setRunning(false);
          // flush remainder on pause
          const rem = chunkAccRef.current;
          if (rem > 0) {
            bumpDailySession(projectId, 'countdown', rem);
            flushCountdownRef.current += rem;
            onSaved?.();
            chunkAccRef.current = 0;
          }
          if (flushCountdownRef.current > 0) {
            mirrorAggregateToServer(projectId, 'countdown', flushCountdownRef.current);
            flushCountdownRef.current = 0;
          }
        }}>Pause</button>}
        <button className='btn btn-outline' onClick={reset}>Reset</button>
      </div>
    </div>
  );
};

const Pomodoro = ({ projectId, onSaved }) => {
  const [focusMin, setFocusMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [cycles, setCycles] = useState(1);
  const [phase, setPhase] = useState('focus'); // 'focus' | 'break'
  const [remaining, setRemaining] = useState(25 * 60 * 1000);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const targetRef = useRef(null);
  const ref = useRef(null);

  const applyConfig = () => {
    const ms = Math.max(1, Number(focusMin) || 25) * 60 * 1000;
    setPhase('focus');
    setRemaining(ms);
    setRunning(false);
    setCompleted(0);
    clearInterval(ref.current);
    targetRef.current = null;
  };

  useEffect(() => {
    if (running) {
      if (!targetRef.current) targetRef.current = Date.now() + remaining;
      ref.current = setInterval(() => {
        const left = Math.max(0, targetRef.current - Date.now());
        setRemaining(left);
        // chunk auto-save every ~10s
        // use a ref to accumulate time between posts
        if (!ref.current.__chunk) ref.current.__chunk = 0;
        const delta = Math.min(200, left);
        ref.current.__chunk += delta;
        if (ref.current.__chunk >= 10000) {
          bumpDailySession(projectId, 'pomodoro', 10000);
          flushPomRef.current += 10000;
          onSaved?.();
          ref.current.__chunk -= 10000;
        }
        if (left <= 0) {
          clearInterval(ref.current);
          targetRef.current = null;
          if (phase === 'focus') {
            // flush remainder
            const rem = ref.current.__chunk || 0;
            if (rem > 0) {
              bumpDailySession(projectId, 'pomodoro', rem);
              flushPomRef.current += rem;
              onSaved?.();
              ref.current.__chunk = 0;
            }
            // Switch to break
            setPhase('break');
            const bms = Math.max(0, Number(breakMin) || 5) * 60 * 1000;
            setRemaining(bms);
            if (bms > 0) {
              setRunning(true);
            } else {
              // If no break, count cycle complete immediately
              setCompleted(c => c + 1);
              // Prepare next focus or stop
              if (completed + 1 >= cycles) {
                setRunning(false);
              } else {
                setPhase('focus');
                const fms = Math.max(1, Number(focusMin) || 25) * 60 * 1000;
                setRemaining(fms);
                setRunning(true);
              }
            }
          } else {
            // Break finished, increment completed cycles
            const rem = ref.current.__chunk || 0;
            if (rem > 0) {
              bumpDailySession(projectId, 'pomodoro', rem);
              flushPomRef.current += rem;
              onSaved?.();
              ref.current.__chunk = 0;
            }
            setCompleted(c => c + 1);
            if (completed + 1 >= cycles) {
              setRunning(false);
              if (flushPomRef.current > 0) {
                mirrorAggregateToServer(projectId, 'pomodoro', flushPomRef.current);
                flushPomRef.current = 0;
              }
            } else {
              setPhase('focus');
              const fms = Math.max(1, Number(focusMin) || 25) * 60 * 1000;
              setRemaining(fms);
              setRunning(true);
            }
          }
        }
      }, 200);
    }
    return () => clearInterval(ref.current);
  }, [running, phase, focusMin, breakMin, cycles, completed]);

  const display = formatDuration(remaining);

  return (
    <div className='card'>
      <h3 className='font-medium mb-2'>Pomodoro</h3>
      <div className='flex flex-wrap items-end gap-2 mb-3'>
        <div>
          <label className='block text-xs text-neutral-400'>Focus (min)</label>
          <input className='input w-24' type='number' value={focusMin} onChange={e => setFocusMin(e.target.value)} />
        </div>
        <div>
          <label className='block text-xs text-neutral-400'>Break (min)</label>
          <input className='input w-24' type='number' value={breakMin} onChange={e => setBreakMin(e.target.value)} />
        </div>
        <div>
          <label className='block text-xs text-neutral-400'>Cycles</label>
          <input className='input w-24' type='number' value={cycles} onChange={e => setCycles(e.target.value)} />
        </div>
        <button className='btn btn-outline' onClick={applyConfig}>Set</button>
      </div>
      <div className='mb-1 text-sm text-neutral-300'>Phase: <span className='font-medium'>{phase}</span> · Completed: {completed}/{cycles}</div>
      <div className='text-3xl font-mono mb-3 text-white fs-time'>{display}</div>
      <div className='flex gap-2'>
        {!running && <button className='btn btn-primary' onClick={() => setRunning(true)}>Start</button>}
        {running && <button className='btn btn-outline' onClick={() => setRunning(false)}>Pause</button>}
        <button className='btn btn-outline' onClick={applyConfig}>Reset</button>
      </div>
    </div>
  );
};

const ProjectDetail = () => {
  const { id } = useParams();
  const force = useForceRerender();
  const project = useMemo(() => getProjectById(id), [id, force]);

  useEffect(() => {
    // If project has no remoteId yet, try to create it on the server (best-effort)
    if (project && !project.remoteId) {
      apiCreateProject({ name: project.name, description: project.description || '' })
        .then(remote => {
          const updated = { ...project, remoteId: remote?._id || null };
          updateProject(updated);
          force();
        })
        .catch(() => {});
    }
  }, [project]);

  if (!project) {
    return (
      <div className='max-w-4xl mx-auto p-4'>
        <p className='text-danger-500'>Project not found.</p>
        <Link className='text-primary-600 hover:underline' to='/projects'>Back to projects</Link>
      </div>
    );
  }

  const rename = () => {
    const next = prompt('Rename project', project.name);
    if (next && next.trim()) {
      const updated = { ...project, name: next.trim() };
      updateProject(updated);
      force();
    }
  };

  const [mode, setMode] = useState('countdown'); // 'stopwatch' | 'countdown' | 'pomodoro'

  const containerRef = useRef(null);
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    function onFsChange() {
      setIsFs(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && containerRef.current) {
        await containerRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.warn('Fullscreen error:', e);
    }
  };

  return (
    <div className='max-w-5xl mx-auto p-4'>
      <div className='mb-4 flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>{project.name}</h1>
          {project.description && <p className='text-neutral-600'>{project.description}</p>}
          <div className='text-neutral-700 mt-1'>Total: <span className='font-mono'>{formatDuration(project.totalMs || 0)}</span></div>
        </div>
        <div className='flex gap-2'>
          <button className='btn border-2 px-3 py-1' onClick={rename}>Rename</button>
          <Link className='btn btn-primary border-2 px-3 py-1' to='/projects'>Back</Link>
        </div>
      </div>

      <div className='grid md:grid-cols-4 gap-3 mb-6'>
        <aside className='md:col-span-1'>
          <div className='card p-2'>
            <div className='flex md:flex-col gap-2'>
              <button className={`btn ${mode==='stopwatch' ? 'btn-primary' : 'btn-outline'} w-full`} onClick={() => setMode('stopwatch')}>Stopwatch</button>
              <button className={`btn ${mode==='countdown' ? 'btn-primary' : 'btn-outline'} w-full`} onClick={() => setMode('countdown')}>Countdown</button>
              <button className={`btn ${mode==='pomodoro' ? 'btn-primary' : 'btn-outline'} w-full`} onClick={() => setMode('pomodoro')}>Pomodoro</button>
            </div>
          </div>
        </aside>
        <section className='md:col-span-3 relative' ref={containerRef}>
          <div className='flex justify-end mb-2'>
            <button className='btn btn-outline' onClick={toggleFullscreen} aria-label='Toggle fullscreen'>
              {isFs ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
          </div>
          {mode === 'stopwatch' && <Stopwatch projectId={project.id} onSaved={force} />}
          {mode === 'countdown' && <Countdown projectId={project.id} onSaved={force} />}
          {mode === 'pomodoro' && <Pomodoro projectId={project.id} onSaved={force} />}
        </section>
      </div>

      <div className='card'>
        <h3 className='font-medium mb-3'>Daily Totals</h3>
        {project.sessions.length === 0 && (
          <p className='text-neutral-400'>No sessions yet. Start a timer above to log time.</p>
        )}
        <div className='space-y-2'>
          {Object.entries((() => {
            const totals = {};
            for (const s of project.sessions) {
              const d = s.date || (s.start ? new Date(s.start) : null);
              const key = typeof d === 'string' ? d : (d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : 'Unknown');
              totals[key] = (totals[key] || 0) + (s.durationMs || 0);
            }
            return totals;
          })()).sort((a,b) => b[0].localeCompare(a[0])).map(([dateKey, ms]) => (
            <div key={dateKey} className='flex items-center justify-between card p-2'>
              <div>
                <div className='font-medium'>{new Date(dateKey).toLocaleDateString()}</div>
                <div className='text-xs text-neutral-400'>{dateKey}</div>
              </div>
              <div className='font-mono'>{formatDuration(ms)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
