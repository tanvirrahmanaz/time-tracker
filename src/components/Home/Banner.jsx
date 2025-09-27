import React from 'react';
import { Link } from 'react-router-dom';

const Banner = () => {
  return (
    <section className='container'>
      <div className='card' style={{ background: 'linear-gradient(180deg, rgba(10,10,10,0.6), rgba(0,0,0,0.6))', padding: '3rem 2rem' }}>
        <h1 className='text-4xl md:text-5xl font-bold tracking-tight mb-4'>Track your time. Own your day.</h1>
        <p className='text-lg text-neutral-300 max-w-2xl mx-auto'>Projects, stopwatch, countdown and Pomodoro — plus a simple Spend Tracker to log money in/out with weekly and monthly insights.</p>
        <div className='mt-6 flex items-center justify-center gap-3'>
          <Link className='btn btn-primary' to='/projects'>Start Tracking</Link>
          <Link className='btn btn-outline' to='/start-timer'>Open Timer</Link>
          <Link className='btn btn-outline' to='/spend'>Spend Tracker</Link>
        </div>
      </div>
    </section>
  );
};

export default Banner;
