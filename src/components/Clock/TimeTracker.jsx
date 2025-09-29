import React, { useEffect, useRef, useState } from 'react';

const BD_TIME_ZONE = 'Asia/Dhaka';

function formatBd(date, options) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: BD_TIME_ZONE, ...options }).format(date);
}

function formatBdDate(date) {
  return formatBd(date, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

function formatBdTime(date) {
  return formatBd(date, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, totalSeconds);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hrs, mins, secs].map((n) => String(n).padStart(2, '0')).join(':');
}

export default function TimeTracker({ showTimer = true, defaultMinutes = 25 }) {
  const [now, setNow] = useState(() => new Date());
  const [inputMinutes, setInputMinutes] = useState(String(defaultMinutes));
  const [secondsLeft, setSecondsLeft] = useState(defaultMinutes * 60);
  const [running, setRunning] = useState(false);
  const [fullscreenTarget, setFullscreenTarget] = useState(null); // 'clock' | 'timer' | null

  const timerIntervalRef = useRef(null);
  const clockRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!running) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return undefined;
    }

    timerIntervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [running]);

  useEffect(() => {
    const handler = () => {
      const el = document.fullscreenElement;
      if (el === clockRef.current) setFullscreenTarget('clock');
      else if (el === timerRef.current) setFullscreenTarget('timer');
      else setFullscreenTarget(null);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const requestFullscreen = async (node) => {
    if (node.requestFullscreen) return node.requestFullscreen();
    if (node.webkitRequestFullscreen) return node.webkitRequestFullscreen();
    if (node.mozRequestFullScreen) return node.mozRequestFullScreen();
    if (node.msRequestFullscreen) return node.msRequestFullscreen();
    return Promise.reject(new Error('Fullscreen API not supported'));
  };

  const exitFullscreen = async () => {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
    if (document.msExitFullscreen) return document.msExitFullscreen();
    return Promise.resolve();
  };

  const enterFullscreen = async (target) => {
    const node = target === 'clock' ? clockRef.current : timerRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) {
        if (document.fullscreenElement === node) {
          await exitFullscreen();
          setFullscreenTarget(null);
          return;
        }
        await exitFullscreen();
      }
      await requestFullscreen(node);
      setFullscreenTarget(target);
    } catch (error) {
      console.warn('Fullscreen error', error);
    }
  };

  const applyMinutes = () => {
    const mins = Math.max(1, Number(inputMinutes) || 0);
    setRunning(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setSecondsLeft(mins * 60);
  };

  const toggleRunning = () => {
    if (running) {
      setRunning(false);
      return;
    }
    if (secondsLeft <= 0) {
      applyMinutes();
      const mins = Math.max(1, Number(inputMinutes) || 0);
      setSecondsLeft(mins * 60);
    }
    setRunning(true);
  };

  const resetTimer = () => {
    setRunning(false);
    const mins = Math.max(1, Number(inputMinutes) || 0);
    setSecondsLeft(mins * 60);
  };

  const isClockFullscreen = fullscreenTarget === 'clock';
  const isTimerFullscreen = fullscreenTarget === 'timer';

  const clockSectionClass = `${isClockFullscreen ? 'fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black text-center text-white' : 'flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/70 p-6 shadow-lg backdrop-blur'} ${isTimerFullscreen ? 'hidden' : ''}`;
  const timerSectionClass = !showTimer
    ? 'hidden'
    : `${isTimerFullscreen ? 'fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black text-center text-white' : 'flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/70 p-6 shadow-lg backdrop-blur'} ${isClockFullscreen ? 'hidden' : ''}`;

  return (
    <div className='time-tracker-shell bg-black text-white'>
      <div className='mx-auto flex w-full max-w-4xl flex-col gap-6'>
        <section ref={clockRef} className={clockSectionClass}>
          {!isClockFullscreen && (
            <div className='flex w-full items-center justify-between'>
              <div>
                <p className='text-xs uppercase tracking-[0.2em] text-white/50'>Bangladesh Time</p>
                <h2 className='text-3xl font-semibold text-white'>Live Clock</h2>
              </div>
              <button className='tt-button tt-button-outline' onClick={() => enterFullscreen('clock')}>
                Fullscreen
              </button>
            </div>
          )}
          <div className='flex flex-col items-center gap-2 text-center'>
            <div className={`${isClockFullscreen ? 'text-xs uppercase tracking-[0.25em] text-white/50' : 'text-sm text-white/60'}`}>
              {formatBdDate(now)}
            </div>
            <div className={`${isClockFullscreen ? 'font-mono text-6xl font-semibold sm:text-[5.5rem]' : 'fs-time mx-auto font-mono text-5xl font-semibold text-white sm:text-6xl'}`}>
              {formatBdTime(now)}
            </div>
          </div>
          {isClockFullscreen && <p className='mt-3 text-xs text-white/40'>Press Esc to exit fullscreen</p>}
        </section>

        {showTimer && (
          <section ref={timerRef} className={timerSectionClass}>
            {!isTimerFullscreen && (
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-xs uppercase tracking-[0.2em] text-white/50'>Focus timer</p>
                  <h2 className='text-2xl font-semibold text-white'>Countdown</h2>
                </div>
                <button className='tt-button tt-button-outline' onClick={() => enterFullscreen('timer')}>
                  Fullscreen
                </button>
              </div>
            )}
            {!isTimerFullscreen && (
              <div className='flex flex-wrap items-end gap-3'>
                <label className='flex flex-col gap-1 text-sm text-white/70'>
                  <span className='text-xs uppercase tracking-[0.18em] text-white/50'>Minutes</span>
                  <input
                    className='w-28 rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-white focus:border-white/30 focus:outline-none'
                    type='number'
                    min='1'
                    value={inputMinutes}
                    onChange={(event) => setInputMinutes(event.target.value)}
                  />
                </label>
                <button className='tt-button tt-button-outline min-w-[120px]' type='button' onClick={applyMinutes}>
                  Set
                </button>
              </div>
            )}
            <div className={`${isTimerFullscreen ? 'font-mono text-6xl font-semibold sm:text-[5.5rem]' : 'fs-time mx-auto text-center font-mono text-4xl font-semibold text-white sm:text-5xl'}`}>
              {formatDuration(secondsLeft)}
            </div>
            <div className='flex flex-wrap justify-center gap-3'>
              <button className='tt-button tt-button-primary min-w-[140px]' type='button' onClick={toggleRunning}>
                {running ? 'Pause' : 'Start'}
              </button>
              <button className='tt-button tt-button-outline min-w-[140px]' type='button' onClick={resetTimer}>
                Reset
              </button>
            </div>
            {isTimerFullscreen && <p className='mt-3 text-xs text-white/40'>Press Esc to exit fullscreen</p>}
          </section>
        )}
      </div>
    </div>
  );
}
