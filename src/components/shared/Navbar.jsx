import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Projects', to: '/projects' },
  { label: 'Timer & Clock', to: '/start-timer' },
  { label: 'Spend', to: '/spend' },
];

const Navbar = () => {
  const { theme, toggle } = useTheme();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const closeMenu = () => setOpen(false);

  return (
    <header className='sticky top-0 z-50 border-b border-white/10 bg-black/80 text-white backdrop-blur'>
      <nav className='container flex h-16 items-center justify-between gap-4'>
        <Link to='/' className='text-lg font-semibold tracking-wide'>Time Desk</Link>

        <div className='hidden items-center gap-5 text-sm font-medium text-white/70 md:flex'>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `transition hover:text-white ${isActive ? 'text-white' : 'text-white/70'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className='flex items-center gap-2'>
          {!user ? (
            <>
              <Link className='tt-button tt-button-outline hidden sm:inline-flex' to='/sign-in'>Sign In</Link>
              <Link className='tt-button tt-button-primary hidden sm:inline-flex' to='/sign-up'>Sign Up</Link>
            </>
          ) : (
            <>
              <span className='hidden text-xs uppercase tracking-[0.18em] text-white/60 sm:inline'>Hi, {user.displayName || user.email}</span>
              <button className='tt-button tt-button-outline hidden sm:inline-flex' onClick={signOut}>Sign Out</button>
            </>
          )}
          <button className='tt-button tt-button-outline h-10 w-10 p-0' onClick={toggle} aria-label='Toggle theme'>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            className='tt-button tt-button-outline inline-flex h-10 w-10 items-center justify-center p-0 md:hidden'
            onClick={() => setOpen((prev) => !prev)}
            aria-label='Toggle navigation'
          >
            {open ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {open && (
        <div className='border-t border-white/10 bg-black/90 md:hidden'>
          <div className='container flex flex-col gap-3 py-4'>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-xl border border-white/10 px-4 py-2 text-sm font-medium transition hover:border-white/25 hover:bg-white/5 ${isActive ? 'text-white' : 'text-white/70'}`
                }
                onClick={closeMenu}
              >
                {item.label}
              </NavLink>
            ))}

            {!user ? (
              <>
                <Link className='tt-button tt-button-outline' to='/sign-in' onClick={closeMenu}>Sign In</Link>
                <Link className='tt-button tt-button-primary' to='/sign-up' onClick={closeMenu}>Sign Up</Link>
              </>
            ) : (
              <button className='tt-button tt-button-outline' onClick={() => { closeMenu(); signOut(); }}>Sign Out</button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
