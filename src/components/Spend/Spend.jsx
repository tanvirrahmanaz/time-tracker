import React, { useEffect, useMemo, useState } from 'react';
import { createSpend, listSpend } from '../../services/serverApi';

function startOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(0,0,0,0); return x;
}
function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun - 6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // Monday as start
  x.setDate(x.getDate() + diff);
  return x;
}
function startOfMonth(d = new Date()) {
  const x = startOfDay(d); x.setDate(1); return x;
}

function formatMoney(n) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(n);
}

const Spend = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [type, setType] = useState('out'); // 'in' | 'out'
  const [amount, setAmount] = useState('');
  const [place, setPlace] = useState('');
  const [method, setMethod] = useState('');
  const [reason, setReason] = useState('');
  const [autoNow, setAutoNow] = useState(true);
  const [when, setWhen] = useState(() => new Date().toISOString().slice(0,16)); // datetime-local

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

  useEffect(() => { refresh(); }, []);

  // Keep the displayed time fresh when auto mode is on
  useEffect(() => {
    if (!autoNow) return;
    const id = setInterval(() => setWhen(new Date().toISOString().slice(0,16)), 1000);
    return () => clearInterval(id);
  }, [autoNow]);

  async function onAdd(e) {
    e.preventDefault();
    setError('');
    if (!amount || Number(amount) <= 0) {
      setError('Enter a valid amount');
      return;
    }
    try {
      const atIso = autoNow ? new Date().toISOString() : new Date(when).toISOString();
      await createSpend({ type, amount: Number(amount), place: place.trim(), method: method.trim(), reason: reason.trim(), at: atIso });
      setAmount(''); setPlace(''); setMethod(''); setReason(''); setWhen(new Date().toISOString().slice(0,16));
      refresh();
    } catch (e) {
      setError(e.message || 'Failed to add');
    }
  }

  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const totals = useMemo(() => {
    const sum = (fromDate) => entries.reduce((acc, e) => {
      const at = e.at ? new Date(e.at) : new Date();
      if (at >= fromDate) {
        if (e.type === 'out') acc.out += e.amount;
        else acc.in += e.amount;
      }
      return acc;
    }, { in: 0, out: 0 });
    return {
      week: sum(weekStart),
      month: sum(monthStart),
    };
  }, [entries]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const d = new Date(e.at);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return Array.from(map.entries()).sort((a,b) => b[0].localeCompare(a[0]));
  }, [entries]);

  // Simple charts (CSS bars) — shows Out totals only
  function buildSeriesDays(fromDate, days) {
    const buckets = Array.from({ length: days }, (_, i) => {
      const d = new Date(fromDate); d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return { key, label: d.toLocaleDateString(undefined, { weekday: 'short' }), date: d, out: 0 };
    });
    const map = new Map(buckets.map(b => [b.key, b]));
    for (const e of entries) {
      if (e.type !== 'out') continue;
      const d = new Date(e.at);
      if (d >= fromDate) {
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (map.has(key)) map.get(key).out += e.amount;
      }
    }
    const arr = Array.from(map.values());
    const max = Math.max(1, ...arr.map(a => a.out));
    return { arr, max };
  }

  const weekSeries = useMemo(() => buildSeriesDays(weekStart, 7), [entries]);
  const monthSeries = useMemo(() => {
    const first = startOfMonth(now);
    const next = new Date(first); next.setMonth(next.getMonth() + 1); next.setDate(0); // last day of month
    const days = next.getDate();
    return buildSeriesDays(first, days);
  }, [entries]);

  const [chartTab, setChartTab] = useState('week'); // 'week' | 'month'

  return (
    <div className='container max-w-5xl'>
      <h1 className='text-2xl font-semibold mb-4'>Spend Tracker</h1>

      <div className='card'>
        {/* Totals row (Week / Month) */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-3 mb-4'>
          <div className='card'>
            <div className='text-sm text-neutral-400'>This Week</div>
            <div className='mt-1 flex flex-wrap gap-4'>
              <div>Out: <span className='font-mono'>{formatMoney(totals.week.out)}</span></div>
              <div>In: <span className='font-mono'>{formatMoney(totals.week.in)}</span></div>
              <div>Net: <span className='font-mono'>{formatMoney(totals.week.in - totals.week.out)}</span></div>
            </div>
          </div>
          <div className='card'>
            <div className='text-sm text-neutral-400'>This Month</div>
            <div className='mt-1 flex flex-wrap gap-4'>
              <div>Out: <span className='font-mono'>{formatMoney(totals.month.out)}</span></div>
              <div>In: <span className='font-mono'>{formatMoney(totals.month.in)}</span></div>
              <div>Net: <span className='font-mono'>{formatMoney(totals.month.in - totals.month.out)}</span></div>
            </div>
          </div>
        </div>

        {/* Add entry */}
        <div className='mb-3'>
          <div className='text-sm text-neutral-400 mb-2'>Add Entry</div>
          {error && <div className='text-danger-500 text-sm mb-2'>{error}</div>}
          <form className='grid grid-cols-1 gap-2' onSubmit={onAdd}>
            <div className='flex flex-wrap gap-2'>
              <div className='flex gap-2'>
                <button type='button' className={`btn ${type==='out' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setType('out')}>Money Out</button>
                <button type='button' className={`btn ${type==='in' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setType('in')}>Money In</button>
              </div>
              <input className='input' type='number' min='0' step='0.01' placeholder='Amount' value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <input className='input' placeholder='Where (e.g., shop, client)' value={place} onChange={e => setPlace(e.target.value)} />
            <input className='input' placeholder='How (e.g., cash, card, bKash)' value={method} onChange={e => setMethod(e.target.value)} />
            <input className='input' placeholder='Why / notes (e.g., grocery, bill)' value={reason} onChange={e => setReason(e.target.value)} />
            <div className='flex items-end gap-2'>
              <div className='flex-1'>
                <label className='label'>Date & time</label>
                <input className='input' type='datetime-local' value={when} onChange={e => setWhen(e.target.value)} disabled={autoNow} />
              </div>
              <button type='button' className='btn btn-outline' onClick={() => setAutoNow(a => !a)}>{autoNow ? 'Set manually' : 'Use current time'}</button>
            </div>
            <button className='btn btn-primary mt-1' type='submit' disabled={loading}>{loading ? 'Saving…' : 'Add Entry'}</button>
          </form>
        </div>

        {/* Collapsible: Graphs */}
        <details className='mb-3'>
          <summary className='cursor-pointer nav-link'>Show Graph</summary>
          <div className='mt-3'>
            <div className='flex items-center justify-between mb-3'>
              <div className='font-medium'>Spending Graph</div>
              <div className='flex gap-2'>
                <button className={`btn ${chartTab==='week' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setChartTab('week')}>Week</button>
                <button className={`btn ${chartTab==='month' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setChartTab('month')}>Month</button>
              </div>
            </div>
            <div className='grid grid-cols-7 md:grid-cols-14 gap-2 items-end' style={{ minHeight: 140 }}>
              {(chartTab==='week' ? weekSeries.arr : monthSeries.arr).map((b) => {
                const max = chartTab==='week' ? weekSeries.max : monthSeries.max;
                const h = Math.round((b.out / max) * 120);
                return (
                  <div key={b.key} className='flex flex-col items-center justify-end gap-1'>
                    <div className='w-full' style={{ height: 120 }}>
                      <div className='rounded' style={{ height: h, background: 'linear-gradient(180deg,var(--color-accent-500),var(--color-primary-500))' }} />
                    </div>
                    <div className='text-[10px] text-neutral-400'>{chartTab==='week' ? b.label : new Date(b.date).getDate()}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </details>

        {/* Collapsible: Entries */}
        <details>
          <summary className='cursor-pointer nav-link'>Show Entries</summary>
          <div className='mt-3'>
            {entries.length === 0 && <p className='text-neutral-400'>No entries yet. Add one above.</p>}
            <div className='space-y-3'>
              {grouped.map(([dateKey, list]) => (
                <div key={dateKey} className='border-t border-neutral-800 pt-2'>
                  <div className='flex items-center justify-between mb-2'>
                    <div className='font-medium'>{new Date(dateKey).toLocaleDateString()}</div>
                    <div className='text-sm text-neutral-400'>{dateKey}</div>
                  </div>
                  <div className='space-y-2'>
                    {list.map(e => (
                      <div key={e._id} className='card p-2 flex items-center justify-between'>
                        <div className='flex items-center gap-3'>
                          <span className={`text-xs uppercase tracking-wide border rounded px-2 py-0.5 ${e.type==='out' ? 'text-danger-500' : 'text-success-500'}`}>{e.type}</span>
                          <div>
                            <div className='font-mono'>{formatMoney(e.amount)}</div>
                            <div className='text-xs text-neutral-400'>{e.place || '-'} · {e.method || '-'} · {e.reason || '-'}</div>
                          </div>
                        </div>
                        <div className='text-xs text-neutral-400'>{new Date(e.at).toLocaleTimeString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default Spend;
