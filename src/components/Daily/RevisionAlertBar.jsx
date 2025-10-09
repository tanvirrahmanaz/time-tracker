import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listDailyLogs, listQuestionReminders } from '../../services/serverApi';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { collectUpcomingRevisions, formatBdDate } from '../../utils/revisionUtils';

const UPCOMING_WINDOW_DAYS = 7;

const RevisionAlertBar = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [upcoming, setUpcoming] = useState([]);
  const [questionReminders, setQuestionReminders] = useState([]);
  const [questionError, setQuestionError] = useState('');
  const [questionLoading, setQuestionLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    let intervalId;

    async function load() {
      if (!user) {
        if (!ignore) {
          setUpcoming([]);
          setError('');
          setQuestionReminders([]);
          setQuestionError('');
        }
        return;
      }
      setLoading(true);
      setQuestionLoading(true);
      setError('');
      setQuestionError('');
      try {
        const [dailyResult, questionResult] = await Promise.allSettled([
          listDailyLogs({ limit: 60 }),
          listQuestionReminders({ withinDays: 1, limit: 10 }),
        ]);
        if (!ignore) {
          if (dailyResult.status === 'fulfilled') {
            const data = dailyResult.value || [];
            const alerts = collectUpcomingRevisions(data, { withinDays: UPCOMING_WINDOW_DAYS });
            setUpcoming(alerts);
          } else {
            setUpcoming([]);
            setError(dailyResult.reason?.message || 'Failed to load revision reminders');
          }
          if (questionResult.status === 'fulfilled') {
            setQuestionReminders(Array.isArray(questionResult.value) ? questionResult.value : []);
          } else {
            setQuestionReminders([]);
            setQuestionError(questionResult.reason?.message || 'Failed to load interview reminders');
          }
        }
      } catch (err) {
        if (!ignore) {
          setUpcoming([]);
          setQuestionReminders([]);
          setError(err.message || 'Failed to load revision reminders');
          setQuestionError(err.message || 'Failed to load interview reminders');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          setQuestionLoading(false);
        }
      }
    }

    load();
    if (user) {
      intervalId = setInterval(load, 1000 * 60 * 10);
    }

    return () => {
      ignore = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [user]);

  const upcomingPreview = useMemo(() => upcoming.slice(0, 3), [upcoming]);
  const questionPreview = useMemo(() => questionReminders.slice(0, 2), [questionReminders]);

  const hasRevisions = upcoming.length > 0;
  const hasQuestionReminders = questionReminders.length > 0;
  const showBar = user && (
    loading || questionLoading || hasRevisions || hasQuestionReminders || error || questionError
  );

  if (!showBar) return null;

  return (
    <div className='border-b border-amber-200 bg-amber-50/90 text-amber-900 backdrop-blur'>
      <div className='container flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between'>
        <div>
          {(loading || questionLoading) && !hasRevisions && !hasQuestionReminders ? (
            <span>Checking revision reminders…</span>
          ) : error ? (
            <span>{error}</span>
          ) : questionError ? (
            <span>{questionError}</span>
          ) : (
            <span>
              {hasRevisions && (
                <>
                  {upcoming.length === 1
                    ? '1 study revision is coming up'
                    : `${upcoming.length} study revisions are coming up`}
                  {upcomingPreview.length > 0 && (
                    <>
                      {' '}· Next: {upcomingPreview.map((item, index) => (
                        <span key={item.id}>
                          {index > 0 ? ', ' : ''}{item.topic} ({formatBdDate(item.date, { day: 'numeric', month: 'short' })})
                        </span>
                      ))}
                    </>
                  )}
                </>
              )}
              {hasRevisions && hasQuestionReminders && ' · '}
              {hasQuestionReminders && (
                <>
                  {questionReminders.length === 1
                    ? '1 interview question is ready to review'
                    : `${questionReminders.length} interview questions are ready to review`}
                  {questionPreview.length > 0 && (
                    <>
                      {' '}· Focus: {questionPreview.map((item, index) => (
                        <span key={item.id}>
                          {index > 0 ? ', ' : ''}"{item.question.length > 50 ? `${item.question.slice(0, 50)}…` : item.question}"
                        </span>
                      ))}
                    </>
                  )}
                </>
              )}
              {!hasRevisions && !hasQuestionReminders && 'All clear for now. Nice work!'}
            </span>
          )}
        </div>
        <div className='flex flex-wrap items-center gap-2 text-xs'>
          {(loading || questionLoading) && !hasRevisions && !hasQuestionReminders && (
            <span className='animate-pulse text-amber-700'>…</span>
          )}
          <Link className='tt-button tt-button-outline text-xs' to='/daily'>Open planner</Link>
          <Link className='tt-button tt-button-outline text-xs' to='/questions'>Review questions</Link>
        </div>
      </div>
    </div>
  );
};

export default RevisionAlertBar;
