import React from 'react';
import { Link } from 'react-router-dom';

const Banner = () => {
  return (
    <section className='relative overflow-hidden bg-black py-24 text-white'>
      <div className='absolute inset-0 -z-10'>
        <div className='absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-black opacity-90' />
        <div className='absolute left-1/2 top-0 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-blue-500/20 blur-3xl' />
        <div className='absolute right-[10%] top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-2xl' />
      </div>

      <div className='container relative flex flex-col items-center gap-8 text-center'>
        <div className='flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-white/70'>
          <span>Track smarter</span>
          <span className='hidden sm:inline'>|</span>
          <span className='text-sky-300'>Dhaka time ready</span>
        </div>
        <h1 className='max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl md:text-[3.4rem] md:leading-[1.1]'>All your timers, projects, and spending in one dark dashboard.</h1>
        <p className='max-w-2xl text-lg text-white/70'>Switch between stopwatch, countdown, and Pomodoro without losing progress. Sync project totals, log sessions, and review expenses — everything calibrated for Bangladesh time.</p>
        <div className='flex flex-wrap items-center justify-center gap-3'>
          <Link className='tt-button tt-button-primary min-w-[160px]' to='/projects'>Start Tracking</Link>
          <Link className='tt-button tt-button-outline min-w-[160px]' to='/start-timer'>Open Time Desk</Link>
          <Link className='tt-button tt-button-outline min-w-[160px]' to='/spend'>Spend Tracker</Link>
        </div>
      </div>
    </section>
  );
};

export default Banner;
