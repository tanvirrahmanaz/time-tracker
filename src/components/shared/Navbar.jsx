import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { listDailyLogs, listQuestionReminders } from '../../services/serverApi';
import { collectUpcomingRevisions } from '../../utils/revisionUtils';

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Projects', to: '/projects' },
  { label: 'Timer & Clock', to: '/start-timer' },
  { label: 'Daily', to: '/daily' },
  { label: 'Spend', to: '/spend' },
  { label: 'Questions', to: '/questions' },
];

const Navbar = () => {
  const { theme, toggle } = useTheme();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [revisionCount, setRevisionCount] = useState(0);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [questionReminderCount, setQuestionReminderCount] = useState(0);
  const [questionReminderLoading, setQuestionReminderLoading] = useState(false);

  const closeMenu = () => setOpen(false);
  const isDark = theme === 'dark';

  useEffect(() => {
    let ignore = false;
    let intervalId;

    async function load() {
      if (!user) {
        if (!ignore) {
          setRevisionCount(0);
          setQuestionReminderCount(0);
        }
        return;
      }
      setRevisionLoading(true);
      setQuestionReminderLoading(true);
      try {
        const data = await listDailyLogs({ limit: 60 });
        const upcoming = collectUpcomingRevisions(data || [], { withinDays: 7 });
        const questionReminders = await listQuestionReminders({ withinDays: 1, limit: 20 });
        if (!ignore) {
          setRevisionCount(upcoming.length);
          setQuestionReminderCount(Array.isArray(questionReminders) ? questionReminders.length : 0);
        }
      } catch (err) {
        if (!ignore) {
          setRevisionCount(0);
          setQuestionReminderCount(0);
        }
      } finally {
        if (!ignore) {
          setRevisionLoading(false);
          setQuestionReminderLoading(false);
        }
      }
    }

    load();
    if (user) intervalId = setInterval(load, 1000 * 60 * 10);

    return () => {
      ignore = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [user]);

  const renderNavLabel = (item) => {
    const isDaily = user && item.to === '/daily';
    const isQuestion = user && item.to === '/questions';
    const displayRevisionCount = revisionCount > 9 ? '9+' : revisionCount;
    const displayQuestionCount = questionReminderCount > 9 ? '9+' : questionReminderCount;
    return (
      <span className='relative inline-flex items-center gap-2'>
        {item.label}
        {isDaily && (
          revisionLoading ? (
            <span className='inline-block h-2 w-2 animate-pulse rounded-full bg-sky-400' aria-hidden='true' />
          ) : (revisionCount > 0 && (
            <span className='rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white'>{displayRevisionCount}</span>
          ))
        )}
        {isQuestion && (
          questionReminderLoading ? (
            <span className='inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400' aria-hidden='true' />
          ) : (questionReminderCount > 0 && (
            <span className='rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white'>{displayQuestionCount}</span>
          ))
        )}
      </span>
    );
  };

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
                isActive
                  ? `transition ${isDark ? 'text-white' : 'text-neutral-900'}`
                  : `transition ${isDark ? 'text-white/70 hover:text-white' : 'text-neutral-700 hover:text-neutral-900'}`
              }
            >
              {renderNavLabel(item)}
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
        <div
          className={`md:hidden ${
            isDark
              ? 'border-t border-white/10 bg-black/90 text-white'
              : 'border-t border-neutral-200 bg-white text-neutral-800'
          }`}
        >
          <div className='container flex flex-col gap-3 py-4'>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive
                    ? `rounded-xl border px-4 py-2 text-sm font-medium transition ${
                        isDark
                          ? 'border-white/40 bg-white/10 text-white'
                          : 'border-neutral-400 bg-neutral-100 text-neutral-900'
                      }`
                    : `rounded-xl border px-4 py-2 text-sm font-medium transition ${
                        isDark
                          ? 'border-white/15 text-white/70 hover:border-white/30 hover:bg-white/5'
                          : 'border-neutral-200 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-100'
                      }`
                }
                onClick={closeMenu}
              >
                {renderNavLabel(item)}
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
