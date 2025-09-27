import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';

const Navbar = () => {
  const { theme, toggle } = useTheme();
  const { user, signOut } = useAuth();
  return (
    <div className='navbar'>
      <nav className='container py-3 flex items-center justify-between'>
        <div className='flex items-center gap-6'>
          <Link to='/' className='text-white font-semibold text-lg'>Time Tracker</Link>
          <div className='hidden sm:flex items-center gap-2'>
            <Link className='nav-link' to='/'>Home</Link>
            <Link className='nav-link' to='/projects'>Projects</Link>
            <Link className='nav-link' to='/start-timer'>Timer</Link>
            <Link className='nav-link' to='/start-tracking'>Clock</Link>
            <Link className='nav-link' to='/spend'>Spend</Link>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          {!user && (
            <>
              <Link className='btn btn-outline' to='/sign-in'>Sign In</Link>
              <Link className='btn btn-primary' to='/sign-up'>Sign Up</Link>
            </>
          )}
          {user && (
            <>
              <span className='text-neutral-300 text-sm hidden sm:inline'>Hi, {user.displayName || user.email}</span>
              <button className='btn btn-outline' onClick={signOut}>Sign Out</button>
            </>
          )}
          <button className='btn btn-ghost' onClick={toggle} aria-label='Toggle theme'>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
