import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext.jsx';

const SignIn = () => {
  const { signIn, signInWithGoogle } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      nav('/projects');
    } catch (err) {
      setError(err?.message || 'Failed to sign in');
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
    <div className='container max-w-md'>
      <div className='card'>
        <h1 className='text-2xl font-semibold mb-1'>Welcome back</h1>
        <p className='text-neutral-400 mb-6'>Sign in to continue tracking time.</p>
        {error && <div className='text-danger-500 text-sm mb-3'>{error}</div>}
        <form className='space-y-4' onSubmit={onSubmit}>
          <div>
            <label className='label'>Email</label>
            <input className='input' type='email' value={email} onChange={(e) => setEmail(e.target.value)} placeholder='you@example.com' required />
          </div>
          <div>
            <label className='label'>Password</label>
            <input className='input' type='password' value={password} onChange={(e) => setPassword(e.target.value)} placeholder='••••••••' required />
          </div>
          <button type='submit' className='btn btn-primary w-full' disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</button>
        </form>
        <div className='mt-4'>
          <button className='btn btn-outline w-full' onClick={onGoogle} disabled={loading}>Continue with Google</button>
        </div>
        <p className='text-sm text-neutral-400 mt-4'>Don’t have an account? <Link className='nav-link underline' to='/sign-up'>Sign up</Link></p>
      </div>
    </div>
  );
};

export default SignIn;
