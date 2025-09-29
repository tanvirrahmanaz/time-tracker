import React from 'react';
import { Link } from 'react-router-dom';
import Banner from './Banner';

const features = [
  {
    title: 'Project heatmap',
    body: 'See total tracked hours at a glance with per-project breakdowns and session history grouped by day.',
    cta: { label: 'View projects', to: '/projects' },
  },
  {
    title: 'Dhaka aligned timers',
    body: 'Live clock, countdown, and Pomodoro respect Bangladesh time zones by default — perfect for local workflows.',
    cta: { label: 'Open Timer Desk', to: '/start-timer' },
  },
  {
    title: 'Spend insights',
    body: 'Track income, expenses, and loans with mobile-friendly charts and quick summaries for week and month.',
    cta: { label: 'Review spend', to: '/spend' },
  },
];

const HomeLayout = () => {
  return (
    <div className='bg-black text-white'>
      <Banner />

      <section className='container flex flex-col gap-10 pb-24 pt-10'>
        <div className='text-center'>
          <p className='text-xs uppercase tracking-[0.2em] text-white/50'>Why teams use Time Desk</p>
          <h2 className='mt-3 text-3xl font-semibold sm:text-[2.4rem]'>Bring every timer and ledger together</h2>
        </div>

        <div className='grid gap-5 md:grid-cols-3'>
          {features.map((item) => (
            <article key={item.title} className='flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/70 p-6 shadow-lg backdrop-blur transition hover:border-white/25'>
              <h3 className='text-xl font-semibold'>{item.title}</h3>
              <p className='text-sm text-white/60'>{item.body}</p>
              <Link className='tt-button tt-button-outline mt-auto w-fit' to={item.cta.to}>{item.cta.label}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className='border-t border-white/10 bg-black/80 py-16'>
        <div className='container flex flex-col items-center gap-6 text-center'>
          <p className='text-xs uppercase tracking-[0.2em] text-white/50'>Start in seconds</p>
          <h2 className='max-w-2xl text-3xl font-semibold sm:text-[2.2rem]'>Open the timer, add your first project, or log today’s spend — it all stays synced.</h2>
          <div className='flex flex-wrap justify-center gap-3'>
            <Link className='tt-button tt-button-primary min-w-[160px]' to='/projects'>Create project</Link>
            <Link className='tt-button tt-button-outline min-w-[160px]' to='/start-timer'>Launch timer</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomeLayout;
