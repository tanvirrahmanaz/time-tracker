import React, { useEffect, useMemo, useState } from 'react';
import { createSpend, listSpend } from '../../services/serverApi';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  return x;
}
function startOfMonth(d = new Date()) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

function formatMoney(n) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 2,
  }).format(n);
}

const BD_TIME_ZONE = 'Asia/Dhaka';
function formatBd(date, options) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: BD_TIME_ZONE, ...options }).format(date);
}
function formatBdDate(date, options = {}) {
  return formatBd(date, { year: 'numeric', month: 'long', day: 'numeric', ...options });
}
function formatBdTime(date) {
  return formatBd(date, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
}

function buildSeriesDays(entries, fromDate, days) {
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { key, label: formatBdDate(d, { weekday: 'short' }), date: d, out: 0 };
  });
  const map = new Map(buckets.map((b) => [b.key, b]));
  for (const entry of entries) {
    if (entry.type !== 'out') continue;
    const d = new Date(entry.at);
    if (d >= fromDate) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (map.has(key)) map.get(key).out += entry.amount;
    }
  }
  const arr = Array.from(map.values());
  const max = Math.max(1, ...arr.map((a) => a.out));
  return { arr, max };
}

const entryKinds = [
  { value: 'expense', label: 'Expense', hint: 'Daily costs, bills, shopping' },
  { value: 'income', label: 'Income', hint: 'Salary, client payment, refunds' },
  { value: 'loan_out', label: 'Loan Given', hint: 'Money you gave to someone' },
  { value: 'loan_in', label: 'Loan Taken', hint: 'Money you borrowed' },
];

const categoryLabel = (entry) => {
  const map = {
    expense: 'Expense',
    income: 'Income',
    loan_in: 'Loan Taken',
    loan_out: 'Loan Given',
    general: entry.type === 'in' ? 'Income' : 'Expense',
  };
  return map[entry.category] || map.general;
};

function getBdInputString(date = new Date()) {
  const bdNow = new Date(date.toLocaleString('en-US', { timeZone: BD_TIME_ZONE }));
  const year = bdNow.getFullYear();
  const month = String(bdNow.getMonth() + 1).padStart(2, '0');
  const day = String(bdNow.getDate()).padStart(2, '0');
  const hours = String(bdNow.getHours()).padStart(2, '0');
  const minutes = String(bdNow.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function bdInputToIso(value) {
  if (!value) return new Date().toISOString();
  return new Date(`${value}:00+06:00`).toISOString();
}

const Spend = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [entryKind, setEntryKind] = useState('expense');
  const [amount, setAmount] = useState('');
  const [place, setPlace] = useState('');
  const [method, setMethod] = useState('');
  const [reason, setReason] = useState('');
  const [loanWith, setLoanWith] = useState('');
  const [autoNow, setAutoNow] = useState(true);
  const [when, setWhen] = useState(() => getBdInputString());
  const [chartTab, setChartTab] = useState('week');
  const [chartMode, setChartMode] = useState('histogram');
  const [now, setNow] = useState(() => new Date());

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const data = await listSpend();
      setEntries(data);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!autoNow) return;
    const id = setInterval(() => setWhen(getBdInputString()), 1000);
    return () => clearInterval(id);
  }, [autoNow]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  async function onAdd(e) {
    e.preventDefault();
    setError('');
    if (!amount || Number(amount) <= 0) {
      setError('Enter a valid amount');
      return;
    }

    try {
      const type = entryKind === 'income' || entryKind === 'loan_in' ? 'in' : 'out';
      const targetInput = autoNow ? getBdInputString() : when;
      const atIso = bdInputToIso(targetInput);
      const payload = {
        type,
        amount: Number(amount),
        place: place.trim(),
        method: method.trim(),
        reason: reason.trim(),
        at: atIso,
        category: entryKind,
        loanParty: entryKind.includes('loan') ? loanWith.trim() : '',
      };
      await createSpend(payload);
      setAmount('');
      setPlace('');
      setMethod('');
      setReason('');
      setLoanWith('');
      setEntryKind('expense');
      setWhen(getBdInputString());
      refresh();
    } catch (err) {
      setError(err.message || 'Failed to add');
    }
  }

  const totals = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today);
    const monthStart = startOfMonth(today);
    const sum = (fromDate) => entries.reduce(
      (acc, e) => {
        const at = e.at ? new Date(e.at) : new Date();
        if (at >= fromDate) {
          if (e.type === 'out') acc.out += e.amount;
          else acc.in += e.amount;
        }
        return acc;
      },
      { in: 0, out: 0 },
    );
    return {
      week: sum(weekStart),
      month: sum(monthStart),
    };
  }, [entries]);

  const summary = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let loanGivenTotal = 0;
    let loanTakenTotal = 0;
    const givenMap = new Map();
    const takenMap = new Map();
    const categoryTotals = {
      expense: 0,
      income: 0,
      loan_out: 0,
      loan_in: 0,
    };

    entries.forEach((raw) => {
      const e = {
        ...raw,
        amount: Number(raw.amount) || 0,
        category: raw.category || (raw.type === 'in' ? 'income' : 'expense'),
        loanParty: raw.loanParty || '',
      };
      if (e.type === 'in') totalIn += e.amount;
      else totalOut += e.amount;

      const catKey = ['expense', 'income', 'loan_out', 'loan_in'].includes(e.category)
        ? e.category
        : (e.type === 'in' ? 'income' : 'expense');
      categoryTotals[catKey] += e.amount;

      if (e.category === 'loan_out') {
        loanGivenTotal += e.amount;
        const key = e.loanParty || 'Unknown';
        if (!givenMap.has(key)) {
          givenMap.set(key, { party: key, total: 0, entries: [] });
        }
        const item = givenMap.get(key);
        item.total += e.amount;
        item.entries.push(e);
      }
      if (e.category === 'loan_in') {
        loanTakenTotal += e.amount;
        const key = e.loanParty || 'Unknown';
        if (!takenMap.has(key)) {
          takenMap.set(key, { party: key, total: 0, entries: [] });
        }
        const item = takenMap.get(key);
        item.total += e.amount;
        item.entries.push(e);
      }
    });

    const toArray = (map) =>
      Array.from(map.values())
        .map((item) => ({
          ...item,
          entries: item.entries.sort((a, b) => new Date(b.at) - new Date(a.at)),
        }))
        .sort((a, b) => b.total - a.total);
    const balance = totalIn - totalOut;
    const netWorth = balance + loanGivenTotal - loanTakenTotal;

    return {
      totalIn,
      totalOut,
      balance,
      loanGivenTotal,
      loanTakenTotal,
      netWorth,
      loansGiven: toArray(givenMap),
      loansTaken: toArray(takenMap),
      byCategory: categoryTotals,
    };
  }, [entries]);

  const periodSlices = useMemo(() => {
    const compute = (fromDate) => {
      const totals = {
        expense: 0,
        income: 0,
        loan_out: 0,
        loan_in: 0,
      };
      entries.forEach((raw) => {
        const at = raw.at ? new Date(raw.at) : new Date();
        if (at < fromDate) return;
        const amount = Number(raw.amount) || 0;
        const cat = ['expense', 'income', 'loan_out', 'loan_in'].includes(raw.category)
          ? raw.category
          : (raw.type === 'in' ? 'income' : 'expense');
        totals[cat] += amount;
      });
      return totals;
    };
    const nowDate = new Date();
    return {
      week: compute(startOfWeek(nowDate)),
      month: compute(startOfMonth(nowDate)),
    };
  }, [entries]);

  const pieView = useMemo(() => {
    const mapping = [
      { key: 'expense', label: 'Expense', color: 'var(--color-danger-500)' },
      { key: 'income', label: 'Income', color: 'var(--color-success-500)' },
      { key: 'loan_out', label: 'Loan Given', color: 'var(--color-warning-500)' },
      { key: 'loan_in', label: 'Loan Taken', color: 'var(--color-primary-500)' },
    ];
    const source = chartTab === 'week' ? periodSlices.week : periodSlices.month;
    const items = mapping
      .map((item) => ({ ...item, value: Number(source?.[item.key] || 0) }))
      .filter((item) => item.value > 0);
    const total = items.reduce((sum, item) => sum + item.value, 0);
    if (!total) {
      return { total: 0, items: [], gradient: '' };
    }
    let cursor = 0;
    const segments = items.map((item) => {
      const start = cursor;
      const percent = item.value / total;
      cursor += percent;
      const end = cursor;
      return { ...item, start, end, percent };
    });
    const gradient = segments
      .map((seg) => `${seg.color} ${Math.round(seg.start * 100)}% ${Math.round(seg.end * 100)}%`)
      .join(', ');
    return { total, items: segments, gradient };
  }, [chartTab, periodSlices]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const d = new Date(e.at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  const weekSeries = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    return buildSeriesDays(entries, weekStart, 7);
  }, [entries]);
  const monthSeries = useMemo(() => {
    const first = startOfMonth(new Date());
    const next = new Date(first);
    next.setMonth(next.getMonth() + 1);
    next.setDate(0);
    const days = next.getDate();
    return buildSeriesDays(entries, first, days);
  }, [entries]);

  const activeSeries = chartTab === 'week' ? weekSeries : monthSeries;

  return (
    <div className='container mx-auto px-3 py-6 max-w-5xl'>
      <div className='space-y-6'>
        <section className='space-y-4'>
          <h1 className='text-2xl font-semibold'>Spend Tracker</h1>
          <article className='card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <div className='text-sm opacity-75'>Cash on hand</div>
              <div className='text-3xl font-semibold tracking-tight'>{formatMoney(summary.balance)}</div>
            </div>
            <div className='flex flex-col items-start gap-1 text-sm text-neutral-400 sm:items-end'>
              <span>{formatBdDate(now, { weekday: 'long' })}</span>
              <span className='font-mono text-base text-neutral-300'>{formatBdTime(now)}</span>
            </div>
          </article>
          <details className='card p-4 sm:p-5'>
            <summary className='nav-link cursor-pointer text-base font-semibold'>View details</summary>
            <div className='mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
              <div className='rounded-lg border border-neutral-200/50 bg-white/80 p-3 text-sm shadow-sm sm:p-4 dark:border-neutral-800/60 dark:bg-neutral-900/50'>
                <div className='text-neutral-500 dark:text-neutral-400'>Total assets</div>
                <div className='mt-1 text-xl font-semibold'>{formatMoney(summary.netWorth)}</div>
              </div>
              <div className='rounded-lg border border-neutral-200/50 bg-white/80 p-3 text-sm shadow-sm sm:p-4 dark:border-neutral-800/60 dark:bg-neutral-900/50'>
                <div className='text-neutral-500 dark:text-neutral-400'>Total income</div>
                <div className='mt-1 text-xl font-semibold text-success-500'>{formatMoney(summary.totalIn)}</div>
              </div>
              <div className='rounded-lg border border-neutral-200/50 bg-white/80 p-3 text-sm shadow-sm sm:p-4 dark:border-neutral-800/60 dark:bg-neutral-900/50'>
                <div className='text-neutral-500 dark:text-neutral-400'>Total expense</div>
                <div className='mt-1 text-xl font-semibold text-danger-500'>{formatMoney(summary.totalOut)}</div>
              </div>
              <div className='rounded-lg border border-neutral-200/50 bg-white/80 p-3 text-sm shadow-sm sm:p-4 dark:border-neutral-800/60 dark:bg-neutral-900/50'>
                <div className='text-neutral-500 dark:text-neutral-400'>Loans overview</div>
                <div className='mt-1 text-sm text-neutral-600 dark:text-neutral-300'>
                  Given: <span className='font-mono text-success-500'>{formatMoney(summary.loanGivenTotal)}</span>
                </div>
                <div className='text-sm text-neutral-600 dark:text-neutral-300'>
                  Taken: <span className='font-mono text-danger-500'>{formatMoney(summary.loanTakenTotal)}</span>
                </div>
              </div>
            </div>
          </details>
        </section>

        <section className='card space-y-4 p-4 sm:p-6'>
          <header className='space-y-1'>
            <h2 className='text-lg font-semibold'>Add Entry</h2>
            <p className='text-sm text-neutral-400'>Track expenses, income, and loans in one place.</p>
            <p className='text-xs uppercase tracking-[0.18em] text-neutral-400'>Dhaka time: {formatBdDate(now)} — <span className='font-mono text-neutral-300'>{formatBdTime(now)}</span></p>
          </header>
          {error && (
            <div
              className='rounded border border-danger-500 px-3 py-2 text-sm'
              style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#fecaca' }}
            >
              {error}
            </div>
          )}
          <form className='space-y-4' onSubmit={onAdd}>
            <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
              {entryKinds.map((opt) => (
                <button
                  key={opt.value}
                  type='button'
                  className={`btn w-full text-left ${entryKind === opt.value ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setEntryKind(opt.value)}
                >
                  <div className='font-medium'>{opt.label}</div>
                  <div className='text-xs opacity-70'>{opt.hint}</div>
                </button>
              ))}
            </div>

            <div className='grid gap-3 sm:grid-cols-2'>
              <label className='flex flex-col gap-1'>
                <span className='label'>Amount (BDT)</span>
                <input
                  className='input'
                  type='number'
                  min='0'
                  step='0.01'
                  placeholder='0.00'
                  value={amount}
                  onChange={(evt) => setAmount(evt.target.value)}
                  required
                />
              </label>
              <label className='flex flex-col gap-1'>
                <span className='label'>Where</span>
                <input
                  className='input'
                  placeholder='Shop, client, location'
                  value={place}
                  onChange={(evt) => setPlace(evt.target.value)}
                />
              </label>
            </div>

            <div className='grid gap-3 sm:grid-cols-2'>
              <label className='flex flex-col gap-1'>
                <span className='label'>Method</span>
                <input
                  className='input'
                  placeholder='Cash, card, bKash'
                  value={method}
                  onChange={(evt) => setMethod(evt.target.value)}
                />
              </label>
              <label className='flex flex-col gap-1'>
                <span className='label'>Notes</span>
                <input
                  className='input'
                  placeholder='Groceries, electricity bill, etc.'
                  value={reason}
                  onChange={(evt) => setReason(evt.target.value)}
                />
              </label>
            </div>

            {entryKind.includes('loan') && (
              <label className='flex flex-col gap-1'>
                <span className='label'>Loan with (name)</span>
                <input
                  className='input'
                  placeholder='Who is involved in this loan?'
                  value={loanWith}
                  onChange={(evt) => setLoanWith(evt.target.value)}
                  required={entryKind.includes('loan')}
                />
              </label>
            )}

            <div className='grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end'>
              <label className='flex flex-col gap-1'>
                <span className='label'>Date & time</span>
                <input
                  className='input'
                  type='datetime-local'
                  value={when}
                  onChange={(evt) => setWhen(evt.target.value)}
                  disabled={autoNow}
                />
              </label>
              <button
                type='button'
                className='btn btn-outline h-[42px]'
                onClick={() => setAutoNow((prev) => !prev)}
              >
                {autoNow ? 'Set manually' : 'Use current time'}
              </button>
            </div>

            <button className='btn btn-primary w-full sm:w-auto' type='submit' disabled={loading}>
              {loading ? 'Saving…' : 'Add Entry'}
            </button>
          </form>
        </section>

        <details className='card space-y-4 p-4 sm:p-6'>
          <summary className='nav-link cursor-pointer text-base font-semibold'>Loan tracker</summary>
          <div className='mt-4 grid gap-3 md:grid-cols-2'>
            <div className='space-y-3 rounded-lg border border-neutral-200/40 bg-white/70 p-4 dark:border-neutral-800/60 dark:bg-neutral-900/40'>
              <h3 className='text-base font-semibold'>People owe me</h3>
              {summary.loansGiven.length === 0 && <p className='text-sm text-neutral-400'>No active loans given.</p>}
              <ul className='space-y-2'>
                {summary.loansGiven.map((loan) => (
                  <li
                    key={`given-${loan.party}`}
                    className='rounded border border-success-500 px-3 py-2'
                    style={{ background: 'rgba(34, 197, 94, 0.12)' }}
                  >
                    <div className='flex items-center justify-between text-sm'>
                      <span className='font-semibold'>{loan.party}</span>
                      <span className='font-mono'>{formatMoney(loan.total)}</span>
                    </div>
                    <div className='text-xs text-neutral-400'>
                      {loan.entries.length} entr{loan.entries.length === 1 ? 'y' : 'ies'} • Last: {formatBdDate(new Date(loan.entries[0].at))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className='space-y-3 rounded-lg border border-neutral-200/40 bg-white/70 p-4 dark:border-neutral-800/60 dark:bg-neutral-900/40'>
              <h3 className='text-base font-semibold'>I owe to</h3>
              {summary.loansTaken.length === 0 && <p className='text-sm text-neutral-400'>No active loans taken.</p>}
              <ul className='space-y-2'>
                {summary.loansTaken.map((loan) => (
                  <li
                    key={`taken-${loan.party}`}
                    className='rounded border border-danger-500 px-3 py-2'
                    style={{ background: 'rgba(239, 68, 68, 0.12)' }}
                  >
                    <div className='flex items-center justify-between text-sm'>
                      <span className='font-semibold'>{loan.party}</span>
                      <span className='font-mono'>{formatMoney(loan.total)}</span>
                    </div>
                    <div className='text-xs text-neutral-400'>
                      {loan.entries.length} entr{loan.entries.length === 1 ? 'y' : 'ies'} • Last: {formatBdDate(new Date(loan.entries[0].at))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>

        <section className='card space-y-4 p-4 sm:p-6'>
          <header className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h2 className='text-lg font-semibold'>Spending insights</h2>
              <p className='text-sm text-neutral-400'>Switch between histogram and pie to see trends.</p>
            </div>
            <div className='flex flex-wrap gap-2 sm:justify-end'>
              <div className='flex gap-2'>
                <button
                  className={`btn ${chartTab === 'week' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setChartTab('week')}
                >
                  Week
                </button>
                <button
                  className={`btn ${chartTab === 'month' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setChartTab('month')}
                >
                  Month
                </button>
              </div>
              <div className='flex gap-2'>
                <button
                  className={`btn ${chartMode === 'histogram' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setChartMode('histogram')}
                >
                  Histogram
                </button>
                <button
                  className={`btn ${chartMode === 'pie' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setChartMode('pie')}
                >
                  Pie
                </button>
              </div>
            </div>
          </header>
          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='rounded-lg border border-neutral-200/40 bg-white/80 p-3 sm:p-4 dark:border-neutral-800/60 dark:bg-neutral-900/40'>
              <div className='text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400'>This Week</div>
              <div className='mt-2 flex flex-wrap gap-3 text-sm text-neutral-600 dark:text-neutral-300'>
                <span>Out: <strong className='font-mono text-danger-500'>{formatMoney(totals.week.out)}</strong></span>
                <span>In: <strong className='font-mono text-success-500'>{formatMoney(totals.week.in)}</strong></span>
                <span>Net: <strong className='font-mono'>{formatMoney(totals.week.in - totals.week.out)}</strong></span>
              </div>
            </div>
            <div className='rounded-lg border border-neutral-200/40 bg-white/80 p-3 sm:p-4 dark:border-neutral-800/60 dark:bg-neutral-900/40'>
              <div className='text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400'>This Month</div>
              <div className='mt-2 flex flex-wrap gap-3 text-sm text-neutral-600 dark:text-neutral-300'>
                <span>Out: <strong className='font-mono text-danger-500'>{formatMoney(totals.month.out)}</strong></span>
                <span>In: <strong className='font-mono text-success-500'>{formatMoney(totals.month.in)}</strong></span>
                <span>Net: <strong className='font-mono'>{formatMoney(totals.month.in - totals.month.out)}</strong></span>
              </div>
            </div>
          </div>

          {chartMode === 'histogram' ? (
            <div className='card p-4'>
              <div className='mb-3 text-sm text-neutral-400'>Daily spend trend ({chartTab === 'week' ? 'last 7 days' : 'this month'})</div>
              <div className='grid grid-cols-7 gap-2 md:grid-cols-14' style={{ minHeight: 140 }}>
                {activeSeries.arr.map((bucket) => {
                  const height = Math.round((bucket.out / activeSeries.max) * 120);
                  return (
                    <div key={bucket.key} className='flex flex-col items-center justify-end gap-1'>
                      <div className='w-full' style={{ height: 120 }}>
                        <div
                          className='rounded'
                          style={{
                            height,
                            background: 'linear-gradient(180deg, var(--color-accent-400), var(--color-primary-500))',
                          }}
                          title={`${bucket.label}: ${formatMoney(bucket.out)}`}
                        />
                      </div>
                      <div className='text-[10px] text-neutral-500'>
                        {chartTab === 'week' ? bucket.label : new Date(bucket.date).getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className='card p-4'>
              {pieView.total > 0 ? (
                <div className='flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center'>
                  <div
                    className='relative h-48 w-48 rounded-full border border-neutral-800/60'
                    style={{ background: `conic-gradient(${pieView.gradient})` }}
                  >
                    <div className='absolute inset-10 flex flex-col items-center justify-center rounded-full bg-neutral-950/80 text-center text-sm text-neutral-300'>
                      <span className='uppercase tracking-wider text-[10px] text-neutral-500'>Total</span>
                      <span className='font-mono text-base'>{formatMoney(pieView.total)}</span>
                    </div>
                  </div>
                  <ul className='w-full max-w-xs space-y-2 text-sm'>
                    {pieView.items.map((item) => (
                      <li key={item.key} className='flex items-center gap-3 rounded border border-neutral-800/40 px-3 py-2'>
                        <span className='inline-block h-3 w-3 rounded-full' style={{ background: item.color }} />
                        <span className='flex-1'>{item.label}</span>
                        <span className='font-mono'>{formatMoney(item.value)}</span>
                        <span className='text-xs text-neutral-400'>{Math.round(item.percent * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className='text-sm text-neutral-400'>No data for the selected period yet.</p>
              )}
            </div>
          )}
        </section>

        <section className='card space-y-4 p-4 sm:p-6'>
          <header className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h2 className='text-lg font-semibold'>Expense history</h2>
              <p className='text-sm text-neutral-400'>Latest spends stay at the bottom as you wanted.</p>
            </div>
          </header>
          {entries.length === 0 && (
            <p className='text-neutral-400'>No entries yet. Add your first expense above.</p>
          )}
          <div className='space-y-4'>
            {grouped.map(([dateKey, list]) => (
              <article key={dateKey} className='border-t border-neutral-800 pt-4'>
                <div className='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
                  <span className='font-medium'>{formatBdDate(new Date(dateKey))}</span>
                  <span className='text-xs text-neutral-500'>{dateKey}</span>
                </div>
                <div className='mt-3 space-y-2'>
                  {list.map((entry) => (
                    <div key={entry._id} className='card flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between'>
                      <div className='flex flex-1 flex-col gap-1'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <span
                            className={`text-xs uppercase tracking-wide rounded px-2 py-0.5 border ${
                              entry.type === 'out' ? 'border-danger-500 text-danger-500' : 'border-success-500 text-success-500'
                            }`}
                          >
                            {categoryLabel(entry)}
                          </span>
                          <span className='font-mono text-lg'>{formatMoney(entry.amount)}</span>
                        </div>
                        <div className='text-xs text-neutral-400'>
                          {(entry.place || '-')}
                          {entry.method ? ` • ${entry.method}` : ''}
                          {entry.reason ? ` • ${entry.reason}` : ''}
                          {entry.loanParty ? ` • Loan with ${entry.loanParty}` : ''}
                        </div>
                      </div>
                      <div className='text-xs text-neutral-500'>{formatBdTime(new Date(entry.at))}</div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Spend;
