import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext.jsx';

const SignUp = () => {
  const { signUp, signInWithGoogle } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signUp(name.trim(), email, password);
      nav('/projects');
    } catch (err) {
      setError(err?.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      nav('/projects');
    } catch (err) {
      setError(err?.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-black to-slate-900 px-6 py-10 text-white shadow-[0_30px_120px_rgba(0,0,0,0.55)] sm:px-10'>
      <div className='absolute inset-x-0 top-0 z-0 h-48 bg-gradient-to-br from-emerald-500/10 via-sky-500/5 to-transparent blur-3xl' />
      <div className='relative z-10 grid gap-10 lg:grid-cols-[1.1fr_auto]'>
        <div className='space-y-4'>
          <p className='text-xs uppercase tracking-[0.25em] text-white/40'>Join the desk</p>
          <h1 className='text-3xl font-semibold sm:text-[2.4rem]'>Create your Time Desk account</h1>
          <p className='max-w-md text-sm text-white/60'>Save your timers, sync sessions across devices, and capture spend history that updates in real-time.</p>
          <div className='hidden gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/60 sm:flex'>
            <div className='flex-1'>
              <p className='text-xs uppercase tracking-[0.18em] text-white/40'>You’ll get</p>
              <ul className='mt-2 list-disc space-y-1 pl-4 text-white/70'>
                <li>Unlimited projects and sessions</li>
                <li>Pomodoro, countdown, and live Dhaka clock</li>
                <li>Spend tracker with loan reminders</li>
              </ul>
            </div>
          </div>
        </div>

        <div className='w-full max-w-md rounded-2xl border border-white/10 bg-black/70 p-6 shadow-lg backdrop-blur'>
          <h2 className='text-xl font-semibold text-white'>Sign up</h2>
          <p className='text-sm text-white/60'>We’ll create your profile and sync everything automatically.</p>
          {error && <div className='mt-4 rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-sm text-danger-200'>{error}</div>}
          <form className='mt-5 space-y-4' onSubmit={onSubmit}>
            <label className='flex flex-col gap-2 text-sm text-white/70'>
              <span className='text-xs uppercase tracking-[0.18em] text-white/50'>Name</span>
              <input
                className='rounded-lg border border-white/15 bg-black/60 px-4 py-2.5 text-white placeholder:text-white/40 focus:border-white/35 focus:outline-none'
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Your name'
              />
            </label>
            <label className='flex flex-col gap-2 text-sm text-white/70'>
              <span className='text-xs uppercase tracking-[0.18em] text-white/50'>Email</span>
              <input
                className='rounded-lg border border-white/15 bg-black/60 px-4 py-2.5 text-white placeholder:text-white/40 focus:border-white/35 focus:outline-none'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='you@example.com'
                required
              />
            </label>
            <label className='flex flex-col gap-2 text-sm text-white/70'>
              <span className='text-xs uppercase tracking-[0.18em] text-white/50'>Password</span>
              <input
                className='rounded-lg border border-white/15 bg-black/60 px-4 py-2.5 text-white placeholder:text-white/40 focus:border-white/35 focus:outline-none'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='Create a strong password'
                required
              />
            </label>
            <button type='submit' className='tt-button tt-button-primary w-full' disabled={loading}>
              {loading ? 'Creating…' : 'Sign Up'}
            </button>
          </form>
          <div className='mt-4'>
            <button className='tt-button tt-button-outline w-full' onClick={onGoogle} disabled={loading}>
              {loading ? 'Please wait…' : 'Continue with Google'}
            </button>
          </div>
          <p className='mt-5 text-center text-sm text-white/50'>
            Already have an account?{' '}
            <Link className='text-white underline transition hover:text-white/80' to='/sign-in'>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
