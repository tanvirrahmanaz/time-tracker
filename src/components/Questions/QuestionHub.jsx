import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  createQuestion,
  createQuestionTopic,
  deleteQuestion,
  deleteQuestionTopic,
  listQuestionReminders,
  listQuestionTopics,
  listQuestions,
  reviewQuestion,
  updateQuestion,
  updateQuestionTopic,
} from '../../services/serverApi';

const difficultyOptions = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const defaultTopicForm = {
  name: '',
  description: '',
  color: '',
  icon: '',
};

const defaultQuestionForm = {
  question: '',
  answer: '',
  tagsInput: '',
  difficulty: 'medium',
  isFavorite: false,
  reviewIntervalDays: 1,
};

function parseTagInput(input) {
  if (!input) return [];
  return input
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function tagsToInput(tags) {
  if (!Array.isArray(tags) || !tags.length) return '';
  return tags.join(', ');
}

function formatDate(value) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

const QuestionHub = () => {
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicFeedback, setTopicFeedback] = useState('');
  const [topicForm, setTopicForm] = useState(defaultTopicForm);
  const [selectedTopicId, setSelectedTopicId] = useState('');

  const [questions, setQuestions] = useState([]);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionFeedback, setQuestionFeedback] = useState('');
  const [questionError, setQuestionError] = useState('');
  const [questionForm, setQuestionForm] = useState(defaultQuestionForm);

  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [favoriteFilter, setFavoriteFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [reminders, setReminders] = useState([]);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState(() => {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  });

  const isSignedOut = !user;

  const loadTopics = async () => {
    if (!user) return;
    setTopicsLoading(true);
    try {
      const data = await listQuestionTopics();
      setTopics(Array.isArray(data) ? data : []);
      setTopicFeedback('');
    } catch (err) {
      setTopicFeedback(err.message || 'Failed to load topics');
    } finally {
      setTopicsLoading(false);
    }
  };

  const loadQuestions = async () => {
    if (!user) {
      setQuestions([]);
      return;
    }
    setQuestionLoading(true);
    setQuestionError('');
    try {
      const data = await listQuestions({ limit: 500 });
      setQuestions(Array.isArray(data) ? data : []);
    } catch (err) {
      setQuestionError(err.message || 'Failed to load questions');
      setQuestions([]);
    } finally {
      setQuestionLoading(false);
    }
  };

  const loadReminders = async () => {
    if (!user) {
      setReminders([]);
      return;
    }
    setReminderLoading(true);
    try {
      const data = await listQuestionReminders({ withinDays: 1, limit: 5 });
      setReminders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load question reminders', err);
    } finally {
      setReminderLoading(false);
    }
  };

  useEffect(() => {
    loadTopics();
  }, [user]);

  useEffect(() => {
    loadQuestions();
    loadReminders();
  }, [user]);

  useEffect(() => {
    if (!topics.length) {
      setSelectedTopicId('');
      return;
    }
    setSelectedTopicId((prev) => {
      if (prev === 'none' || prev === 'all') return prev;
      if (!prev) return topics[0].id;
      const exists = topics.some((topic) => topic.id === prev);
      return exists ? prev : topics[0].id;
    });
  }, [topics]);

  const selectedTopic = useMemo(() => {
    if (selectedTopicId === 'none') {
      return {
        id: 'none',
        name: 'Uncategorized',
        description: 'Questions that are not assigned to any topic yet.',
        questionCount: questions.filter((item) => !item.topicId).length,
      };
    }
    return topics.find((topic) => topic.id === selectedTopicId) || null;
  }, [selectedTopicId, topics, questions]);

  const tags = useMemo(() => {
    const set = new Set();
    questions.forEach((item) => {
      (item.tags || []).forEach((tag) => set.add(tag));
    });
    return Array.from(set).sort();
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();
    return questions
      .filter((question) => {
        if (selectedTopicId === 'none') {
          if (question.topicId) return false;
        } else if (selectedTopicId) {
          if (question.topicId !== selectedTopicId) return false;
        }
        if (difficultyFilter !== 'all' && question.difficulty !== difficultyFilter) return false;
        if (favoriteFilter === 'true' && !question.isFavorite) return false;
        if (favoriteFilter === 'false' && question.isFavorite) return false;
        if (tagFilter && !question.tags?.includes(tagFilter)) return false;
        if (searchLower) {
          const haystack = `${question.question} ${question.answer} ${question.notes || ''}`.toLowerCase();
          if (!haystack.includes(searchLower)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aDate = a.updatedAt || a.createdAt || 0;
        const bDate = b.updatedAt || b.createdAt || 0;
        return new Date(bDate) - new Date(aDate);
      });
  }, [questions, selectedTopicId, difficultyFilter, favoriteFilter, tagFilter, searchTerm]);

  const handleTopicSubmit = async (e) => {
    e.preventDefault();
    if (!topicForm.name.trim()) {
      setTopicFeedback('Topic name is required');
      return;
    }
    try {
      await createQuestionTopic(topicForm);
      setTopicForm(defaultTopicForm);
      setTopicFeedback('Topic created');
      await loadTopics();
    } catch (err) {
      setTopicFeedback(err.message || 'Failed to create topic');
    }
  };

  const handleTopicUpdate = async (topic) => {
    const name = window.prompt('Rename topic', topic.name);
    if (name === null) return;
    try {
      await updateQuestionTopic(topic.id, { ...topic, name });
      await loadTopics();
      await loadQuestions();
    } catch (err) {
      setTopicFeedback(err.message || 'Failed to update topic');
    }
  };

  const handleTopicDelete = async (topic) => {
    if (!window.confirm(`Remove topic "${topic.name}"? Questions will remain as uncategorized.`)) return;
    try {
      await deleteQuestionTopic(topic.id, { reassign: true });
      await loadTopics();
      await loadQuestions();
      if (selectedTopicId === topic.id) {
        setSelectedTopicId('none');
      }
    } catch (err) {
      setTopicFeedback(err.message || 'Failed to delete topic');
    }
  };

  const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    setQuestionFeedback('');
    if (!selectedTopicId) {
      setQuestionFeedback('Select a topic before adding a question.');
      return;
    }
    if (!questionForm.question.trim()) {
      setQuestionFeedback('Question text is required');
      return;
    }
    try {
      const payload = {
        question: questionForm.question,
        answer: questionForm.answer,
        tags: parseTagInput(questionForm.tagsInput),
        difficulty: questionForm.difficulty,
        isFavorite: questionForm.isFavorite,
        reviewIntervalDays: Number(questionForm.reviewIntervalDays) || 1,
      };
      if (selectedTopicId !== 'none') {
        payload.topicId = selectedTopicId;
      }
      await createQuestion(payload);
      setQuestionForm((prev) => ({
        ...defaultQuestionForm,
        difficulty: prev.difficulty,
      }));
      setQuestionFeedback('Question saved');
      await loadQuestions();
      await loadTopics();
      await loadReminders();
    } catch (err) {
      setQuestionFeedback(err.message || 'Failed to save question');
    }
  };

  const handleUpdateQuestion = async (question, partial) => {
    try {
      const payload = {
        question: partial.question ?? question.question,
        answer: partial.answer ?? question.answer,
        tags: partial.tags ?? question.tags,
        difficulty: partial.difficulty ?? question.difficulty,
        isFavorite: partial.isFavorite ?? question.isFavorite,
        reviewIntervalDays: partial.reviewIntervalDays ?? question.reviewIntervalDays ?? 1,
      };
      if (Object.prototype.hasOwnProperty.call(partial, 'topicId')) {
        payload.topicId = partial.topicId ?? '';
      } else if (question.topicId) {
        payload.topicId = question.topicId;
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'nextReviewAt')) {
        payload.nextReviewAt = partial.nextReviewAt;
      }
      await updateQuestion(question.id, payload);
      await loadQuestions();
      await loadTopics();
      await loadReminders();
    } catch (err) {
      setQuestionFeedback(err.message || 'Failed to update question');
    }
  };

  const handleEditQuestion = async (question) => {
    const nextQuestion = window.prompt('Update question text', question.question);
    if (nextQuestion === null) return;
    const nextAnswer = window.prompt('Update answer', question.answer || '');
    if (nextAnswer === null) return;
    await handleUpdateQuestion(question, { question: nextQuestion, answer: nextAnswer });
  };

  const handleToggleFavorite = async (question) => {
    await handleUpdateQuestion(question, { isFavorite: !question.isFavorite });
  };

  const handleDifficultyChange = async (question, value) => {
    await handleUpdateQuestion(question, { difficulty: value });
  };

  const handleDeleteQuestion = async (question) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await deleteQuestion(question.id);
      await loadQuestions();
      await loadTopics();
      await loadReminders();
    } catch (err) {
      setQuestionFeedback(err.message || 'Failed to delete question');
    }
  };

  const handleReviewQuestion = async (question) => {
    try {
      await reviewQuestion(question.id, { intervalDays: question.reviewIntervalDays });
      await loadQuestions();
      await loadReminders();
    } catch (err) {
      setQuestionFeedback(err.message || 'Failed to mark revision');
    }
  };

  const handleNotificationRequest = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const perm = await Notification.requestPermission();
      setNotificationStatus(perm);
    } catch (err) {
      console.warn('Notification permission request failed', err);
    }
  };

  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (notificationStatus !== 'granted') return;
    if (!reminders.length) return;
    const first = reminders[0];
    if (!first) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `tt_question_notify_${first.id}_${todayKey}`;
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(storageKey)) return;
    try {
      const notification = new Notification('Daily interview question', {
        body: first.question,
        tag: first.id,
      });
      notification.onclick = () => window.focus();
      window.localStorage.setItem(storageKey, 'shown');
    } catch (err) {
      console.warn('Notification failed', err);
    }
  }, [notificationStatus, reminders]);

  useEffect(() => {
    setQuestionFeedback('');
    setQuestionForm((prev) => ({
      ...defaultQuestionForm,
      difficulty: prev.difficulty,
    }));
  }, [selectedTopicId]);

  if (isSignedOut) {
    return (
      <div className='mx-auto max-w-3xl rounded-2xl border border-white/10 bg-black/40 p-6 text-center text-white/70'>
        Sign in to manage your interview question bank.
      </div>
    );
  }

  return (
    <div className='space-y-8 text-white'>
      <section className='rounded-3xl border border-white/10 bg-black/50 p-6'>
        <h1 className='text-2xl font-semibold text-white'>Interview Question Hub</h1>
        <p className='mt-1 text-sm text-white/60'>
          Create topics for Python, Machine Learning or anything you are studying, save questions with answers, and track revision reminders so nothing slips.
        </p>
        <div className='mt-4 flex flex-wrap gap-2 text-xs text-white/60'>
          <span className='rounded-full border border-white/10 px-3 py-1'>Topics {topics.length}</span>
          <span className='rounded-full border border-white/10 px-3 py-1'>Questions {questions.length}</span>
        </div>
      </section>

      <section className='rounded-3xl border border-white/10 bg-black/50 p-6'>
        <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
          <div>
            <h2 className='text-xl font-semibold text-white'>Revision reminders</h2>
            <p className='text-sm text-white/60'>
              {reminderLoading ? 'Checking reminders…' : reminders.length
                ? `${reminders.length} question${reminders.length > 1 ? 's are' : ' is'} ready to review.`
                : 'No pending reminders right now. Keep pushing!'}
            </p>
          </div>
          <div className='flex flex-wrap gap-2 text-sm text-white/70'>
            {notificationStatus === 'unsupported' ? (
              <span>Notifications are not supported on this device.</span>
            ) : notificationStatus !== 'granted' ? (
              <button className='tt-button tt-button-outline text-xs' onClick={handleNotificationRequest}>
                Enable notifications
              </button>
            ) : (
              <span className='rounded-full border border-emerald-400/40 px-3 py-1 text-xs text-emerald-200'>Notifications on</span>
            )}
          </div>
        </div>
        {reminders.length > 0 && (
          <div className='mt-4 space-y-3'>
            {reminders.map((item) => (
              <div key={item.id} className='rounded-2xl border border-white/10 bg-black/60 p-4'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div>
                    <p className='text-xs uppercase tracking-[0.18em] text-white/40'>
                      Due {formatDate(item.nextReviewAt)} · {item.topicName || 'Uncategorized'}
                    </p>
                    <h3 className='mt-1 text-lg font-semibold text-white'>{item.question}</h3>
                  </div>
                  <button className='tt-button tt-button-primary text-xs' onClick={() => handleReviewQuestion(item)}>
                    Mark reviewed
                  </button>
                </div>
                {item.answer && (
                  <p className='mt-2 text-sm text-white/70'>{item.answer}</p>
                )}
                <div className='mt-2 flex flex-wrap gap-2 text-xs text-white/50'>
                  <span className='rounded-full border border-white/20 px-2 py-0.5'>Difficulty: {item.difficulty}</span>
                  {item.tags?.map((tag) => (
                    <span key={tag} className='rounded-full border border-white/20 px-2 py-0.5'>#{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className='grid gap-6 lg:grid-cols-[290px,1fr]'>
        <aside className='space-y-6 rounded-3xl border border-white/10 bg-black/50 p-6'>
          <div>
            <h2 className='text-lg font-semibold text-white'>Create topic</h2>
            <p className='text-xs text-white/60'>Organise questions by subject before you add them.</p>
            <form className='mt-4 space-y-3' onSubmit={handleTopicSubmit}>
              <div>
                <label className='mb-1 block text-xs uppercase tracking-[0.18em] text-white/50'>Name</label>
                <input
                  className='tt-input w-full'
                  value={topicForm.name}
                  onChange={(e) => setTopicForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder='e.g. Python, Machine Learning'
                />
              </div>
              <div>
                <label className='mb-1 block text-xs uppercase tracking-[0.18em] text-white/50'>Description</label>
                <input
                  className='tt-input w-full'
                  value={topicForm.description}
                  onChange={(e) => setTopicForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder='Optional note'
                />
              </div>
              <button className='tt-button tt-button-primary w-full' type='submit'>Save topic</button>
              {topicFeedback && <p className='text-xs text-amber-400'>{topicFeedback}</p>}
            </form>
          </div>

          <div>
            <div className='flex items-center justify-between'>
              <h3 className='text-lg font-semibold text-white'>Topics</h3>
              {topicsLoading && <span className='text-xs text-white/60'>Loading…</span>}
            </div>
            <div className='mt-3 flex flex-col gap-2'>
              <button
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                  selectedTopicId === 'all'
                    ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                    : 'border-white/15 text-white/70 hover:border-white/30 hover:text-white'
                }`}
                onClick={() => setSelectedTopicId('all')}
              >
                <span>All questions</span>
                <span className='text-xs text-white/60'>{questions.length}</span>
              </button>
              <button
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                  selectedTopicId === 'none'
                    ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                    : 'border-white/15 text-white/70 hover:border-white/30 hover:text-white'
                }`}
                onClick={() => setSelectedTopicId('none')}
              >
                <span>Uncategorized</span>
                <span className='text-xs text-white/60'>{questions.filter((item) => !item.topicId).length}</span>
              </button>
              {topics.map((topic) => (
                <div key={topic.id} className='flex items-center gap-2'>
                  <button
                    className={`flex grow items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                      selectedTopicId === topic.id
                        ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                        : 'border-white/15 text-white/70 hover:border-white/30 hover:text-white'
                    }`}
                    onClick={() => setSelectedTopicId(topic.id)}
                  >
                    <span>{topic.name}</span>
                    <span className='text-xs text-white/60'>{topic.questionCount}</span>
                  </button>
                  <button
                    className='rounded-full border border-white/20 px-2 text-xs text-white/60 hover:border-white/40 hover:text-white'
                    onClick={() => handleTopicUpdate(topic)}
                    title='Rename topic'
                  >
                    ✎
                  </button>
                  <button
                    className='rounded-full border border-white/20 px-2 text-xs text-white/60 hover:border-rose-500 hover:text-rose-300'
                    onClick={() => handleTopicDelete(topic)}
                    title='Delete topic'
                  >
                    ✕
                  </button>
                </div>
              ))}
              {!topics.length && !topicsLoading && (
                <p className='rounded-xl border border-dashed border-white/20 px-3 py-4 text-center text-xs text-white/60'>
                  Create your first topic to get started.
                </p>
              )}
            </div>
          </div>
        </aside>

        <div className='space-y-6'>
          {selectedTopicId && selectedTopicId !== 'all' ? (
            <>
              <section className='rounded-3xl border border-white/10 bg-black/50 p-6'>
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                  <div>
                    <h2 className='text-xl font-semibold text-white'>{selectedTopic?.name || 'Select a topic'}</h2>
                    <p className='text-sm text-white/60'>
                      {selectedTopic?.description || 'Choose a topic from the list to see and add questions.'}
                    </p>
                  </div>
                  <div className='text-xs text-white/50'>
                    {selectedTopic ? `${filteredQuestions.length} question${filteredQuestions.length === 1 ? '' : 's'} here` : ''}
                  </div>
                </div>

                {selectedTopic && (
                  <form className='mt-4 space-y-3' onSubmit={handleQuestionSubmit}>
                    <div>
                      <label className='mb-1 block text-xs uppercase tracking-[0.18em] text-white/50'>Question</label>
                      <textarea
                        className='tt-input h-28'
                        value={questionForm.question}
                        onChange={(e) => setQuestionForm((prev) => ({ ...prev, question: e.target.value }))}
                        placeholder='Write the interview question...'
                      />
                    </div>
                    <div>
                      <label className='mb-1 block text-xs uppercase tracking-[0.18em] text-white/50'>Answer / Notes</label>
                      <textarea
                        className='tt-input h-28'
                        value={questionForm.answer}
                        onChange={(e) => setQuestionForm((prev) => ({ ...prev, answer: e.target.value }))}
                        placeholder='Store the way you would answer it...'
                      />
                    </div>
                    <div className='grid gap-3 md:grid-cols-2'>
                      <div>
                        <label className='mb-1 block text-xs uppercase tracking-[0.18em] text-white/50'>Tags</label>
                        <input
                          className='tt-input'
                          value={questionForm.tagsInput}
                          onChange={(e) => setQuestionForm((prev) => ({ ...prev, tagsInput: e.target.value }))}
                          placeholder='python, recursion, algorithms'
                        />
                      </div>
                      <div>
                        <label className='mb-1 block text-xs uppercase tracking-[0.18em] text-white/50'>Difficulty</label>
                        <select
                          className='tt-input'
                          value={questionForm.difficulty}
                          onChange={(e) => setQuestionForm((prev) => ({ ...prev, difficulty: e.target.value }))}
                        >
                          {difficultyOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                      <label className='inline-flex items-center gap-2 text-sm text-white/70'>
                        <input
                          type='checkbox'
                          checked={questionForm.isFavorite}
                          onChange={(e) => setQuestionForm((prev) => ({ ...prev, isFavorite: e.target.checked }))}
                        />
                        Mark as favourite
                      </label>
                      <div className='flex items-center gap-2 text-sm text-white/70'>
                        <span>Review every</span>
                        <input
                          type='number'
                          min='1'
                          max='365'
                          className='tt-input w-20'
                          value={questionForm.reviewIntervalDays}
                          onChange={(e) => setQuestionForm((prev) => ({ ...prev, reviewIntervalDays: e.target.value }))}
                        />
                        <span>day(s)</span>
                      </div>
                    </div>
                    <button className='tt-button tt-button-primary w-full' type='submit'>Add question to this topic</button>
                    {questionFeedback && <p className='text-xs text-amber-400'>{questionFeedback}</p>}
                  </form>
                )}
              </section>

              <section className='rounded-3xl border border-white/10 bg-black/50 p-6'>
                <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
                  <div>
                    <h2 className='text-xl font-semibold text-white'>Questions</h2>
                    {questionError ? (
                      <p className='text-sm text-rose-300'>{questionError}</p>
                    ) : (
                      <p className='text-sm text-white/60'>
                        {questionLoading ? 'Loading questions…' : `${filteredQuestions.length} question${filteredQuestions.length === 1 ? '' : 's'} in this view`}
                      </p>
                    )}
                  </div>
                  <div className='flex flex-wrap gap-2 text-sm text-white/70'>
                    <select className='tt-input' value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)}>
                      <option value='all'>All difficulty</option>
                      {difficultyOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <select className='tt-input' value={favoriteFilter} onChange={(e) => setFavoriteFilter(e.target.value)}>
                      <option value='all'>All</option>
                      <option value='true'>Favourites</option>
                      <option value='false'>Non favourites</option>
                    </select>
                    <select className='tt-input' value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                      <option value=''>All tags</option>
                      {tags.map((tag) => (
                        <option key={tag} value={tag}>#{tag}</option>
                      ))}
                    </select>
                    <input
                      className='tt-input'
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder='Search question…'
                    />
                  </div>
                </div>

                <div className='mt-4 space-y-3'>
                  {filteredQuestions.map((question) => (
                    <div key={question.id} className='rounded-2xl border border-white/10 bg-black/60 p-4'>
                      <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                        <div>
                          <p className='text-xs uppercase tracking-[0.18em] text-white/40'>
                            {question.topicName || 'Uncategorized'} · Next review {formatDate(question.nextReviewAt)}
                          </p>
                          <h3 className='mt-1 text-lg font-semibold text-white'>{question.question}</h3>
                          {question.answer && (
                            <p className='mt-2 text-sm text-white/70 whitespace-pre-wrap'>{question.answer}</p>
                          )}
                          {question.notes && (
                            <p className='mt-2 text-xs text-white/50'>{question.notes}</p>
                          )}
                          <div className='mt-2 flex flex-wrap gap-2 text-xs text-white/50'>
                            <span className='rounded-full border border-white/20 px-2 py-0.5'>Difficulty: {question.difficulty}</span>
                            {question.isFavorite && (
                              <span className='rounded-full border border-amber-400/40 px-2 py-0.5 text-amber-300'>Favourite</span>
                            )}
                            {question.tags?.map((tag) => (
                              <span key={tag} className='rounded-full border border-white/20 px-2 py-0.5'>#{tag}</span>
                            ))}
                          </div>
                        </div>
                        <div className='flex flex-col gap-2 text-xs md:text-sm'>
                          <button className='tt-button tt-button-outline' onClick={() => handleEditQuestion(question)}>Edit</button>
                          <button className='tt-button tt-button-outline' onClick={() => handleToggleFavorite(question)}>
                            {question.isFavorite ? 'Remove favourite' : 'Mark favourite'}
                          </button>
                          <select
                            className='tt-input'
                            value={question.difficulty}
                            onChange={(e) => handleDifficultyChange(question, e.target.value)}
                          >
                            {difficultyOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <button className='tt-button tt-button-outline' onClick={() => handleReviewQuestion(question)}>
                            Mark reviewed
                          </button>
                          <button
                            className='tt-button tt-button-outline text-rose-300 hover:bg-rose-500/10'
                            onClick={() => handleDeleteQuestion(question)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!filteredQuestions.length && !questionLoading && (
                    <div className='rounded-2xl border border-dashed border-white/20 bg-black/40 p-10 text-center text-white/60'>
                      No questions here yet. Add one above and start revising.
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <div className='rounded-3xl border border-dashed border-white/20 bg-black/40 p-10 text-center text-white/60'>
              Select a topic from the left to add and review questions.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default QuestionHub;
