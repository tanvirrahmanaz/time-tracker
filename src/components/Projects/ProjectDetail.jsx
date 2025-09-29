import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addSessionToProject, bumpDailySession, mirrorAggregateToServer, formatDuration, getProjectById, updateProject, syncProjectsFromServer } from '../../services/storage';

function useForceRerender() {
  const [, setTick] = useState(0);
  return () => setTick(t => t + 1);
}

const colorPresets = ['#38bdf8', '#facc15', '#f97316', '#22c55e', '#a855f7', '#f472b6', '#ffffff'];

const Stopwatch = ({ projectId, onSaved, active = true, fullscreen = false, color = '#ffffff' }) => {
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

  const containerClass = fullscreen
    ? 'flex h-full w-full flex-col items-center justify-center gap-8 bg-transparent text-center'
    : 'flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/70 p-6 shadow-lg backdrop-blur';
  const timeClass = fullscreen
    ? 'fs-time mx-auto font-mono text-6xl font-semibold text-white sm:text-7xl'
    : 'fs-time mx-auto mb-4 font-mono text-4xl font-semibold text-white';

  return (
    <div hidden={!active} className={containerClass}>
      {!fullscreen && (
        <div className='flex items-center justify-between'>
          <h3 className='text-lg font-semibold'>Stopwatch</h3>
          <button className='tt-button tt-button-outline' onClick={save} disabled={running || elapsed < 1000}>Log Session</button>
        </div>
      )}
      <div className='text-center'>
        <div className={timeClass} style={{ color }}>{formatDuration(elapsed)}</div>
      </div>
      <div className='flex flex-wrap justify-center gap-3'>
        {!running && <button className='tt-button tt-button-primary min-w-[140px]' onClick={start}>Start</button>}
        {running && <button className='tt-button tt-button-outline min-w-[140px]' onClick={pause}>Pause</button>}
        <button className='tt-button tt-button-outline min-w-[140px]' onClick={reset}>Reset</button>
      </div>
    </div>
  );
};

const Countdown = ({ projectId, onSaved, active = true, fullscreen = false, color = '#ffffff' }) => {
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

  const containerClass = fullscreen
    ? 'flex h-full w-full flex-col items-center justify-center gap-6 bg-transparent text-center'
    : 'flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/70 p-6 shadow-lg backdrop-blur';
  const timeClass = fullscreen
    ? 'fs-time mx-auto font-mono text-6xl font-semibold text-white sm:text-7xl'
    : 'fs-time mx-auto text-center font-mono text-4xl font-semibold text-white';

  return (
    <div hidden={!active} className={containerClass}>
      {!fullscreen && (
        <div className='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
          <h3 className='text-lg font-semibold'>Countdown</h3>
          <span className='text-xs uppercase tracking-[0.18em] text-white/40'>Flexible timer</span>
        </div>
      )}
      {!fullscreen && (
        <div className='flex flex-wrap items-end gap-3'>
          <div className='flex min-w-[110px] flex-1 flex-col gap-2'>
            <label className='text-xs uppercase tracking-[0.18em] text-white/50'>Hours</label>
            <input className='w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none' type='number' value={hours} onChange={e => setHours(e.target.value)} />
          </div>
          <div className='flex min-w-[110px] flex-1 flex-col gap-2'>
            <label className='text-xs uppercase tracking-[0.18em] text-white/50'>Minutes</label>
            <input className='w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none' type='number' value={minutes} onChange={e => setMinutes(e.target.value)} />
          </div>
          <div className='flex min-w-[110px] flex-1 flex-col gap-2'>
            <label className='text-xs uppercase tracking-[0.18em] text-white/50'>Seconds</label>
            <input className='w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none' type='number' value={seconds} onChange={e => setSeconds(e.target.value)} />
          </div>
          <button className='tt-button tt-button-outline min-w-[120px]' onClick={applyInput}>Set</button>
        </div>
      )}
      <div className={timeClass} style={{ color }}>{display}</div>
      <div className='flex flex-wrap justify-center gap-3'>
        {!running && <button className='tt-button tt-button-primary min-w-[140px]' onClick={() => setRunning(true)} disabled={remaining <= 0}>Start</button>}
        {running && <button className='tt-button tt-button-outline min-w-[140px]' onClick={() => {
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
        <button className='tt-button tt-button-outline min-w-[140px]' onClick={reset}>Reset</button>
      </div>
    </div>
  );
};

const Pomodoro = ({ projectId, onSaved, active = true, fullscreen = false, color = '#ffffff' }) => {
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

  const containerClass = fullscreen
    ? 'flex h-full w-full flex-col items-center justify-center gap-6 bg-transparent text-center'
    : 'flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/70 p-6 shadow-lg backdrop-blur';
  const timeClass = fullscreen
    ? 'fs-time mx-auto font-mono text-6xl font-semibold text-white sm:text-7xl'
    : 'fs-time mx-auto text-center font-mono text-4xl font-semibold text-white';

  return (
    <div hidden={!active} className={containerClass}>
      {!fullscreen && (
        <>
          <div className='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
            <h3 className='text-lg font-semibold'>Pomodoro</h3>
            <span className='text-xs uppercase tracking-[0.18em] text-white/40'>Focus & break cycles</span>
          </div>
          <div className='flex flex-wrap items-end gap-3'>
            <div className='flex min-w-[110px] flex-1 flex-col gap-2'>
              <label className='text-xs uppercase tracking-[0.18em] text-white/50'>Focus (min)</label>
              <input className='w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none' type='number' value={focusMin} onChange={e => setFocusMin(e.target.value)} />
            </div>
            <div className='flex min-w-[110px] flex-1 flex-col gap-2'>
              <label className='text-xs uppercase tracking-[0.18em] text-white/50'>Break (min)</label>
              <input className='w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none' type='number' value={breakMin} onChange={e => setBreakMin(e.target.value)} />
            </div>
            <div className='flex min-w-[110px] flex-1 flex-col gap-2'>
              <label className='text-xs uppercase tracking-[0.18em] text-white/50'>Cycles</label>
              <input className='w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none' type='number' value={cycles} onChange={e => setCycles(e.target.value)} />
            </div>
            <button className='tt-button tt-button-outline min-w-[120px]' onClick={applyConfig}>Set</button>
          </div>
          <div className='text-sm text-white/60'>Phase: <span className='font-semibold text-white'>{phase}</span> · Completed: {completed}/{cycles}</div>
        </>
      )}
      <div className={timeClass} style={{ color }}>{display}</div>
      <div className='flex flex-wrap justify-center gap-3'>
        {!running && <button className='tt-button tt-button-primary min-w-[150px]' onClick={() => setRunning(true)}>Start</button>}
        {running && <button className='tt-button tt-button-outline min-w-[150px]' onClick={() => setRunning(false)}>Pause</button>}
        <button className='tt-button tt-button-outline min-w-[150px]' onClick={applyConfig}>Reset</button>
      </div>
    </div>
  );
};

const ProjectDetail = () => {
  const { id } = useParams();
  const force = useForceRerender();
  const project = useMemo(() => getProjectById(id), [id, force]);
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    // Ensure latest remote copy loaded for this user
    setSyncing(true);
    syncProjectsFromServer()
      .then(() => {
        force();
        setSyncing(false);
      })
      .catch(() => setSyncing(false));
  }, [id]);

  if (!project && syncing) {
    return (
      <div className='mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10 text-white sm:px-6'>
        <p className='text-sm text-white/60'>Loading project…</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className='mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10 text-white sm:px-6'>
        <p className='rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-200'>Project not found.</p>
        <Link className='tt-button tt-button-outline w-fit' to='/projects'>Back to projects</Link>
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
  const [timeColor, setTimeColor] = useState('#38bdf8');

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
    <div className='mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-3xl bg-black px-4 pb-16 pt-6 text-white shadow-2xl sm:px-6'>
      <div className='flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/70 p-6 shadow-xl backdrop-blur-lg sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-2'>
          <h1 className='text-3xl font-semibold sm:text-[2.4rem]'>{project.name}</h1>
          {project.description && <p className='text-sm text-white/60'>{project.description}</p>}
          <div className='text-sm text-white/60'>Total tracked: <span className='font-mono text-white'>{formatDuration(project.totalMs || 0)}</span></div>
        </div>
        <div className='flex flex-wrap gap-3'>
          <button className='tt-button tt-button-outline' onClick={rename}>Rename</button>
          <Link className='tt-button tt-button-primary' to='/projects'>Back</Link>
        </div>
      </div>

      <div className='grid gap-5 md:grid-cols-[minmax(0,260px)_1fr]'>
        <aside className='flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/70 p-4 shadow-lg backdrop-blur'>
          <p className='text-xs uppercase tracking-[0.18em] text-white/50'>Modes</p>
          <div className='flex flex-col gap-2'>
            <button className={`tt-button ${mode==='stopwatch' ? 'tt-button-primary' : 'tt-button-outline'} w-full`} onClick={() => setMode('stopwatch')}>Stopwatch</button>
            <button className={`tt-button ${mode==='countdown' ? 'tt-button-primary' : 'tt-button-outline'} w-full`} onClick={() => setMode('countdown')}>Countdown</button>
            <button className={`tt-button ${mode==='pomodoro' ? 'tt-button-primary' : 'tt-button-outline'} w-full`} onClick={() => setMode('pomodoro')}>Pomodoro</button>
          </div>
        </aside>
        <section className={`relative rounded-2xl border border-white/10 ${isFs ? 'bg-black' : 'bg-black/80'} p-5 shadow-xl backdrop-blur-lg ${isFs ? 'flex h-full w-full items-center justify-center' : ''}`} ref={containerRef}>
          {!isFs && (
            <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
              <div className='time-color-picker flex-1 min-w-[220px]'>
                <span className='picker-label'>Timer color</span>
                <div className='picker-swatches'>
                  {colorPresets.map((color) => (
                    <button
                      key={color}
                      type='button'
                      className={`picker-swatch${timeColor === color ? ' active' : ''}`}
                      style={{ background: color }}
                      onClick={() => setTimeColor(color)}
                      aria-label={`Set timer color ${color}`}
                    />
                  ))}
                  <label className='picker-custom'>
                    <span className='sr-only'>Choose custom color</span>
                    <input
                      type='color'
                      value={timeColor}
                      onChange={(event) => setTimeColor(event.target.value)}
                    />
                  </label>
                </div>
              </div>
              <button className='tt-button tt-button-outline' onClick={toggleFullscreen} aria-label='Toggle fullscreen'>
                Fullscreen
              </button>
            </div>
          )}
          <div className={`${isFs ? 'mx-auto flex h-full w-full max-w-4xl items-center justify-center' : 'space-y-5'}`}>
            <Stopwatch projectId={project.id} onSaved={force} active={mode === 'stopwatch'} fullscreen={isFs} color={timeColor} />
            <Countdown projectId={project.id} onSaved={force} active={mode === 'countdown'} fullscreen={isFs} color={timeColor} />
            <Pomodoro projectId={project.id} onSaved={force} active={mode === 'pomodoro'} fullscreen={isFs} color={timeColor} />
          </div>
        </section>
      </div>

      <div className='rounded-2xl border border-white/10 bg-black/70 p-6 shadow-lg backdrop-blur'>
        <div className='mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
          <h3 className='text-lg font-semibold text-white'>Daily Totals</h3>
          <span className='text-xs uppercase tracking-[0.18em] text-white/40'>Auto-saved sessions</span>
        </div>
        {project.sessions.length === 0 && (
          <p className='rounded-xl border border-dashed border-white/15 bg-black/40 px-4 py-6 text-center text-sm text-white/60'>No sessions yet. Start a timer above to log time.</p>
        )}
        <div className='space-y-3'>
          {Object.entries((() => {
            const totals = {};
            for (const s of project.sessions) {
              const d = s.date || (s.start ? new Date(s.start) : null);
              const key = typeof d === 'string' ? d : (d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : 'Unknown');
              totals[key] = (totals[key] || 0) + (s.durationMs || 0);
            }
            return totals;
          })()).sort((a,b) => b[0].localeCompare(a[0])).map(([dateKey, ms]) => (
            <div key={dateKey} className='flex items-center justify-between rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white shadow-sm'>
              <div className='space-y-1'>
                <div className='font-medium'>{new Date(dateKey).toLocaleDateString()}</div>
                <div className='text-xs uppercase tracking-[0.18em] text-white/40'>{dateKey}</div>
              </div>
              <div className='rounded-full border border-white/10 bg-white/10 px-3 py-1 font-mono text-base text-white'>
                {formatDuration(ms)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
