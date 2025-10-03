import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';
import { createSpend, listSpend, updateSpend, deleteSpend } from '../../services/serverApi';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title);

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

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

const paymentLabelByValue = paymentMethods.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const spendCategoryOptions = [
  { value: 'food', label: 'Food' },
  { value: 'rickshaw', label: 'Rickshaw' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
];

const spendCategoryLabelByValue = spendCategoryOptions.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const INSIGHT_DAY_COUNT = 5;
const FUND_SOURCE_STORAGE_KEY = 'tt_fund_sources';

function loadStoredFundSources() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FUND_SOURCE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item && item.toLowerCase() !== 'self' && item.toLowerCase() !== 'other');
  } catch (err) {
    console.warn('Failed to load stored fund sources', err);
    return [];
  }
}

function persistStoredFundSources(list) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FUND_SOURCE_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to persist fund sources', err);
  }
}

function formatFundSourceLabel(value) {
  if (!value || value === 'self') return 'My money';
  if (value.toLowerCase() === 'mother') return "Mom's money";
  return value;
}

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

const isPlannedSpend = (entry) => Boolean(entry?.mustSpend) && !entry?.isCleared;

const Spend = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [entryKind, setEntryKind] = useState('expense');
  const [amount, setAmount] = useState('');
  const [placeOption, setPlaceOption] = useState(spendCategoryOptions[0].value);
  const [placeCustom, setPlaceCustom] = useState('');
  const [methodOption, setMethodOption] = useState(paymentMethods[0].value);
  const [methodCustom, setMethodCustom] = useState('');
  const [reason, setReason] = useState('');
  const [loanWith, setLoanWith] = useState('');
  const [autoNow, setAutoNow] = useState(true);
  const [when, setWhen] = useState(() => getBdInputString());
  const [userFundSources, setUserFundSources] = useState(() => loadStoredFundSources());
  const [fundSourceOption, setFundSourceOption] = useState('self');
  const [fundSourceCustom, setFundSourceCustom] = useState('');
  const [chartTab, setChartTab] = useState('week');
  const [chartMode, setChartMode] = useState('histogram');
  const [now, setNow] = useState(() => new Date());
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [todoAmount, setTodoAmount] = useState('');
  const [todoReason, setTodoReason] = useState('');
  const [todoNote, setTodoNote] = useState('');
  const [todoWhen, setTodoWhen] = useState(() => getBdInputString());
  const [todoError, setTodoError] = useState('');
  const [todoSaving, setTodoSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const current = new Date();
    return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
  });
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [insightDayIndex, setInsightDayIndex] = useState(0);

  const fundSourceOptionsList = useMemo(() => {
    const seen = new Set();
    const customOptions = [];
    const register = (name) => {
      if (!name || typeof name !== 'string') return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      if (lower === 'self' || lower === 'other') return;
      if (seen.has(lower)) return;
      seen.add(lower);
      customOptions.push({
        value: `custom:${encodeURIComponent(trimmed)}`,
        label: trimmed,
      });
    };
    userFundSources.forEach(register);
    entries.forEach((entry) => register(entry?.fundSource));
    return [
      { value: 'self', label: 'My money' },
      ...customOptions,
      { value: 'other', label: 'Other (add new)' },
    ];
  }, [userFundSources, entries]);

  const insightDays = useMemo(() => {
    const todayStart = startOfDay(now);
    return Array.from({ length: INSIGHT_DAY_COUNT }, (_, idx) => {
      const date = new Date(todayStart);
      date.setDate(date.getDate() - idx);
      return {
        key: date.toISOString(),
        date,
        label: formatBdDate(date, { weekday: 'short', day: 'numeric', month: 'short' }),
        shortLabel: idx === 0 ? 'Today' : formatBdDate(date, { day: 'numeric' }),
      };
    });
  }, [now]);

  const selectedInsightDay = insightDays[Math.min(insightDayIndex, insightDays.length - 1)] || insightDays[0];

  const insightDaySpan = useMemo(() => {
    if (!selectedInsightDay) return null;
    const start = startOfDay(selectedInsightDay.date);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }, [selectedInsightDay]);

  const insightCategoryBreakdown = useMemo(() => {
    if (!insightDaySpan) return { total: 0, categories: [] };
    const map = new Map();
    for (const entry of entries) {
      if (entry.type !== 'out') continue;
      if (isPlannedSpend(entry)) continue;
      const at = entry.at ? new Date(entry.at) : new Date();
      if (at < insightDaySpan.start || at >= insightDaySpan.end) continue;
      const key = (entry.place && String(entry.place).trim()) || 'Uncategorized';
      const amount = Number(entry.amount) || 0;
      if (!map.has(key)) map.set(key, 0);
      map.set(key, map.get(key) + amount);
    }
    const categories = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const total = categories.reduce((sum, item) => sum + item.value, 0);
    return { total, categories };
  }, [entries, insightDaySpan]);

  const insightCategoryPieData = useMemo(() => {
    if (!insightCategoryBreakdown.categories.length) return null;
    const palette = ['#f87171', '#facc15', '#60a5fa', '#34d399', '#a855f7', '#fb923c', '#f472b6', '#22d3ee'];
    const colors = insightCategoryBreakdown.categories.map((_, idx) => palette[idx % palette.length]);
    return {
      labels: insightCategoryBreakdown.categories.map((item) => item.name),
      datasets: [
        {
          data: insightCategoryBreakdown.categories.map((item) => item.value),
          backgroundColor: colors,
          borderWidth: 1,
        },
      ],
    };
  }, [insightCategoryBreakdown]);

  const insightCategoryPieOptions = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#9ca3af' },
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${formatMoney(context.parsed)}`,
        },
      },
    },
  }), []);

  async function refresh(monthKey = selectedMonth) {
    setLoading(true);
    setError('');
    try {
      const params = monthKey ? { month: monthKey } : {};
      const data = await listSpend(params);
      setEntries(data);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    if (!autoNow) return;
    const id = setInterval(() => setWhen(getBdInputString()), 1000);
    return () => clearInterval(id);
  }, [autoNow]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    persistStoredFundSources(userFundSources);
  }, [userFundSources]);

  useEffect(() => {
    setInsightDayIndex(0);
  }, [selectedMonth]);

  async function onAdd(e) {
    e.preventDefault();
    setError('');
    if (!amount || Number(amount) <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (methodOption === 'other' && !methodCustom.trim()) {
      setError('Enter a payment method name');
      return;
    }
    const resolvedPlace = placeOption === 'other'
      ? placeCustom.trim()
      : (spendCategoryLabelByValue[placeOption] || '');
    if (placeOption === 'other' && !resolvedPlace) {
      setError('Enter a category for the spend');
      return;
    }
    let resolvedFundSource = 'self';
    if (fundSourceOption === 'self') {
      resolvedFundSource = 'self';
    } else if (fundSourceOption === 'other') {
      const customSource = fundSourceCustom.trim();
      if (!customSource) {
        setError('Enter a money source name');
        return;
      }
      resolvedFundSource = customSource;
    } else if (fundSourceOption.startsWith('custom:')) {
      resolvedFundSource = decodeURIComponent(fundSourceOption.slice(7));
    } else {
      resolvedFundSource = fundSourceOption;
    }

    try {
      const type = entryKind === 'income' || entryKind === 'loan_in' ? 'in' : 'out';
      const targetInput = autoNow ? getBdInputString() : when;
      const atIso = bdInputToIso(targetInput);
      const resolvedMethod = methodOption === 'other'
        ? methodCustom.trim()
        : (paymentLabelByValue[methodOption] || methodCustom.trim());
      const payload = {
        type,
        amount: Number(amount),
        place: resolvedPlace,
        method: resolvedMethod,
        reason: reason.trim(),
        at: atIso,
        category: entryKind,
        loanParty: entryKind.includes('loan') ? loanWith.trim() : '',
        fundSource: resolvedFundSource,
      };
      await createSpend(payload);
      if (fundSourceOption === 'other') {
        setUserFundSources((prev) => {
          const exists = prev.some((item) => item.toLowerCase() === resolvedFundSource.toLowerCase());
          if (exists) return prev;
          return [...prev, resolvedFundSource];
        });
      }
      setAmount('');
      setPlaceOption(spendCategoryOptions[0].value);
      setPlaceCustom('');
      setMethodOption(paymentMethods[0].value);
      setMethodCustom('');
      setReason('');
      setLoanWith('');
      setEntryKind('expense');
      setWhen(getBdInputString());
      setFundSourceOption('self');
      setFundSourceCustom('');
      refresh();
      Swal.fire({ icon: 'success', title: 'Expense added', timer: 1500, showConfirmButton: false });
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
          if (e.type === 'out') {
            if (!isPlannedSpend(e)) acc.out += e.amount;
          } else {
            acc.in += e.amount;
          }
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
      if ((e.category === 'loan_out' || e.category === 'loan_in') && e.isCleared) {
        return;
      }
      const includeAmount = !isPlannedSpend(e);
      if (e.type === 'in') totalIn += e.amount;
      else if (includeAmount) totalOut += e.amount;

      const catKey = ['expense', 'income', 'loan_out', 'loan_in'].includes(e.category)
        ? e.category
        : (e.type === 'in' ? 'income' : 'expense');
      if (includeAmount || e.type === 'in') {
        categoryTotals[catKey] += e.amount;
      }

      if (e.category === 'loan_out' && includeAmount) {
        loanGivenTotal += e.amount;
        const key = e.loanParty || 'Unknown';
        if (!givenMap.has(key)) {
          givenMap.set(key, { party: key, total: 0, entries: [] });
        }
        const item = givenMap.get(key);
        item.total += e.amount;
        item.entries.push(e);
      }
      if (e.category === 'loan_in' && includeAmount) {
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
        if (raw.type === 'out' && isPlannedSpend(raw)) return;
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
      { key: 'expense', label: 'Expense', color: 'var(--color-danger-500)', chartColor: '#f87171' },
      { key: 'income', label: 'Income', color: 'var(--color-success-500)', chartColor: '#34d399' },
      { key: 'loan_out', label: 'Loan Given', color: 'var(--color-warning-500)', chartColor: '#facc15' },
      { key: 'loan_in', label: 'Loan Taken', color: 'var(--color-primary-500)', chartColor: '#60a5fa' },
    ];
    const source = chartTab === 'week' ? periodSlices.week : periodSlices.month;
    const items = mapping
      .map((item) => ({ ...item, value: Number(source?.[item.key] || 0) }))
      .filter((item) => item.value > 0);
    const total = items.reduce((sum, item) => sum + item.value, 0);
    if (!total) {
      return { total: 0, items: [] };
    }
    const segments = items.map((item) => ({
      ...item,
      percent: item.value / total,
    }));
    return { total, items: segments };
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

  const barData = useMemo(() => {
    const labels = activeSeries.arr.map((bucket) =>
      chartTab === 'week'
        ? bucket.label
        : formatBdDate(new Date(bucket.date), { day: '2-digit', month: 'short' }),
    );
    const data = activeSeries.arr.map((bucket) => Number(bucket.out || 0));
    return {
      labels,
      datasets: [
        {
          label: 'Expense',
          data,
          backgroundColor: 'rgba(248, 113, 113, 0.65)',
          borderRadius: 6,
        },
      ],
    };
  }, [activeSeries, chartTab]);

  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `Expense: ${formatMoney(context.parsed.y || 0)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#9ca3af',
          maxRotation: 45,
          minRotation: 45,
          font: { size: 10 },
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.12)' },
        ticks: {
          color: '#9ca3af',
          callback: (value) => `৳${Number(value).toLocaleString()}`,
        },
      },
    },
  }), []);

  const pieData = useMemo(() => ({
    labels: pieView.items.map((item) => item.label),
    datasets: [
      {
        data: pieView.items.map((item) => item.value),
        backgroundColor: pieView.items.map((item) => item.chartColor),
        borderWidth: 1,
      },
    ],
  }), [pieView]);

  const pieOptions = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#9ca3af' },
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${formatMoney(context.parsed)}`,
        },
      },
    },
  }), []);

  const dailyBreakdown = useMemo(() => {
    return activeSeries.arr
      .map((bucket) => ({
        key: bucket.key,
        date: new Date(bucket.date),
        amount: Number(bucket.out || 0),
      }))
      .filter((item) => chartTab === 'week' || item.amount > 0)
      .map((item) => ({
        ...item,
        label: formatBdDate(item.date, { weekday: 'short', day: 'numeric', month: 'short' }),
      }));
  }, [activeSeries, chartTab]);

  const monthOptions = useMemo(() => {
    const set = new Set();
    entries.forEach((entry) => {
      const at = entry.at ? new Date(entry.at) : new Date();
      const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;
      set.add(key);
    });
    const ordered = Array.from(set).sort((a, b) => b.localeCompare(a));
    if (!ordered.length) {
      const current = new Date();
      ordered.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
    }
    return ordered;
  }, [entries]);

  useEffect(() => {
    const current = new Date();
    const currentKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    if (!monthOptions.includes(selectedMonth)) {
      setSelectedMonth(currentKey);
    }
  }, [monthOptions, selectedMonth]);

  const monthlyExpenses = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const targetYear = Number(yearStr);
    const targetMonth = Number(monthStr) - 1;
    return entries.filter((entry) => {
      if (entry.type !== 'out') return false;
      const at = entry.at ? new Date(entry.at) : new Date();
      return at.getFullYear() === targetYear && at.getMonth() === targetMonth;
    });
  }, [entries, selectedMonth]);

  const monthlyMustSpends = useMemo(
    () => monthlyExpenses.filter((entry) => entry.mustSpend),
    [monthlyExpenses],
  );

  const outstandingMustSpends = useMemo(
    () => monthlyMustSpends.filter((entry) => !entry.isCleared),
    [monthlyMustSpends],
  );

  const outstandingMustTotal = useMemo(
    () => outstandingMustSpends.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
    [outstandingMustSpends],
  );

  const orderedMustSpends = useMemo(() => {
    return [...monthlyMustSpends].sort((a, b) => {
      const aDate = new Date(a.dueAt || a.at || 0).getTime();
      const bDate = new Date(b.dueAt || b.at || 0).getTime();
      if (Number.isNaN(aDate) && Number.isNaN(bDate)) return 0;
      if (Number.isNaN(aDate)) return 1;
      if (Number.isNaN(bDate)) return -1;
      return aDate - bDate;
    });
  }, [monthlyMustSpends]);

  const toggleTodo = async (entry) => {
    const key = entry._id || entry.id;
    if (!key) return;
    const nextValue = !entry.isCleared;
    try {
      await updateSpend(entry.id || entry._id, { isCleared: nextValue });
      refresh();
      Swal.fire({
        icon: 'success',
        title: nextValue ? 'Marked as done' : 'Back to pending',
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (e) {
      console.warn('Failed to update spend', e);
    }
  };

  const removeMonthlyExpense = async (entry) => {
    const key = entry._id || entry.id;
    if (!key) return;
    if (!confirm('Remove this expense from the month?')) return;
    try {
      await deleteSpend(entry.id || entry._id);
      refresh();
      Swal.fire({ icon: 'success', title: 'Removed', timer: 1200, showConfirmButton: false });
    } catch (e) {
      console.warn('Failed to delete spend', e);
      setError(e.message || 'Failed to delete');
    }
  };

  const settleLoanGroup = async (loan) => {
    const entriesToClear = Array.isArray(loan?.entries) ? loan.entries : [];
    if (!entriesToClear.length) return;
    const confirmation = await Swal.fire({
      icon: 'warning',
      title: 'Mark loan as completed?',
      text: 'This will move the loan to completed history.',
      showCancelButton: true,
      confirmButtonText: 'Mark completed',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#15803d',
    });
    if (!confirmation.isConfirmed) return;
    try {
      await Promise.all(entriesToClear.map((entry) => {
        const id = entry.id || entry._id;
        if (!id) return Promise.resolve();
        return updateSpend(id, { isCleared: true });
      }));
      refresh();
      Swal.fire({ icon: 'success', title: 'Loan marked completed', timer: 1600, showConfirmButton: false });
    } catch (err) {
      console.warn('Failed to settle loan', err);
      setError(err.message || 'Failed to mark loan completed');
    }
  };

  const deleteHistoryEntry = async (entry) => {
    const key = entry._id || entry.id;
    if (!key) return;
    const keep = await Swal.fire({
      icon: 'warning',
      title: 'Delete this expense?',
      text: 'This action cannot be undone.',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    });
    if (!keep.isConfirmed) return;
    try {
      await deleteSpend(entry.id || entry._id);
      refresh();
      Swal.fire({ icon: 'success', title: 'Expense deleted', timer: 1400, showConfirmButton: false });
    } catch (e) {
      console.warn('Failed to delete spend', e);
      setError(e.message || 'Failed to delete');
    }
  };

  const onAddTodoExpense = async (e) => {
    e.preventDefault();
    setTodoError('');
    if (!todoAmount || Number(todoAmount) <= 0) {
      setTodoError('Enter a valid amount');
      return;
    }
    if (!todoReason.trim()) {
      setTodoError('Add a title for the must spend');
      return;
    }
    if (selectedMonth !== currentMonthKey) {
      setTodoError('Switch to the current month to add must spends');
      return;
    }
    if (todoWhen && todoWhen.slice(0, 7) !== currentMonthKey) {
      setTodoError('Pick a date inside the current month');
      return;
    }
    try {
      setTodoSaving(true);
      const dueIso = bdInputToIso(todoWhen || getBdInputString());
      await createSpend({
        type: 'out',
        amount: Number(todoAmount),
        place: '',
        method: '',
        reason: todoReason.trim(),
        at: dueIso,
        dueAt: dueIso,
        category: 'expense',
        loanParty: '',
        mustSpend: true,
        note: todoNote.trim(),
      });
      setTodoAmount('');
      setTodoReason('');
       setTodoNote('');
      setTodoWhen(getBdInputString());
      setShowTodoForm(false);
      refresh();
      Swal.fire({ icon: 'success', title: 'Must spend saved', timer: 1500, showConfirmButton: false });
    } catch (err) {
      setTodoError(err.message || 'Failed to save must spend');
    } finally {
      setTodoSaving(false);
    }
  };

  // Compute this month total expense only
  const currentMonthStart = useMemo(() => startOfMonth(now), [now]);
  const todayStart = useMemo(() => startOfDay(now), [now]);

  const thisMonthTotal = useMemo(() => {
    return entries.reduce((sum, e) => {
      const at = e.at ? new Date(e.at) : new Date();
      if (e.type === 'out' && at >= currentMonthStart) {
        if (isPlannedSpend(e)) return sum;
        return sum + (Number(e.amount) || 0);
      }
      return sum;
    }, 0);
  }, [entries, currentMonthStart]);

  const todayTotal = useMemo(() => {
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return entries.reduce((sum, e) => {
      const at = e.at ? new Date(e.at) : new Date();
      if (e.type === 'out' && at >= todayStart && at < tomorrow) {
        if (isPlannedSpend(e)) return sum;
        return sum + (Number(e.amount) || 0);
      }
      return sum;
    }, 0);
  }, [entries, todayStart]);

  return (
    <div className='container mx-auto px-3 py-6 max-w-3xl'>
      <div className='space-y-6'>
        <section className='space-y-4'>
          <h1 className='text-2xl font-semibold'>Spend Tracker</h1>
          <article className='card space-y-4 p-4 sm:p-5'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div>
                <div className='text-sm opacity-75'>This month's expense</div>
                <div className='text-3xl font-semibold tracking-tight text-danger-400'>{formatMoney(thisMonthTotal)}</div>
              </div>
              <div>
                <div className='text-sm opacity-75'>Today's expense</div>
                <div className='text-3xl font-semibold tracking-tight text-danger-400'>{formatMoney(todayTotal)}</div>
                <div className='mt-1 text-xs uppercase tracking-[0.18em] text-neutral-400'>{formatBdDate(now)}</div>
              </div>
            </div>
            <div className='flex flex-col items-start gap-1 text-sm text-neutral-400 sm:flex-row sm:items-center sm:justify-between'>
              <span>{formatBdDate(now, { month: 'long', year: 'numeric' })}</span>
              <span className='font-mono text-base text-neutral-300'>{formatBdTime(now)}</span>
            </div>
          </article>
          <details className='card p-4 sm:p-5'>
            <summary className='nav-link cursor-pointer text-base font-semibold'>More</summary>
            <div className='mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
              <div className='rounded-lg border border-neutral-200/50 bg-white/80 p-3 text-sm shadow-sm sm:p-4 dark:border-neutral-800/60 dark:bg-neutral-900/50'>
                <div className='text-neutral-500 dark:text-neutral-400'>Cash on hand</div>
                <div className='mt-1 text-xl font-semibold'>{formatMoney(summary.balance)}</div>
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
                <span className='label'>Spend category</span>
                <select
                  className='input'
                  value={placeOption}
                  onChange={(evt) => setPlaceOption(evt.target.value)}
                >
                  {spendCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {placeOption === 'other' && (
              <label className='flex flex-col gap-1'>
                <span className='label'>Custom category</span>
                <input
                  className='input'
                  placeholder='e.g. Medicine, tuition fee'
                  value={placeCustom}
                  onChange={(evt) => setPlaceCustom(evt.target.value)}
                />
              </label>
            )}

            <div className='grid gap-3 sm:grid-cols-2'>
              <label className='flex flex-col gap-1'>
                <span className='label'>Money source</span>
                <select
                  className='input'
                  value={fundSourceOption}
                  onChange={(evt) => {
                    const value = evt.target.value;
                    setFundSourceOption(value);
                    if (value !== 'other') setFundSourceCustom('');
                  }}
                >
                  {fundSourceOptionsList.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {fundSourceOption === 'other' && (
                  <input
                    className='input mt-2'
                    placeholder='Enter source name'
                    value={fundSourceCustom}
                    onChange={(event) => setFundSourceCustom(event.target.value)}
                  />
                )}
              </label>
              <label className='flex flex-col gap-1'>
                <span className='label'>Method</span>
                <select
                  className='input'
                  value={methodOption}
                  onChange={(event) => setMethodOption(event.target.value)}
                >
                  {paymentMethods.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {methodOption === 'other' && (
                  <input
                    className='input mt-2'
                    placeholder='Enter method name'
                    value={methodCustom}
                    onChange={(event) => setMethodCustom(event.target.value)}
                  />
                )}
              </label>
            </div>

            <label className='flex flex-col gap-1'>
              <span className='label'>Notes</span>
              <input
                className='input'
                placeholder='Groceries, electricity bill, etc.'
                value={reason}
                onChange={(evt) => setReason(evt.target.value)}
              />
            </label>

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

        <section className='card space-y-4 p-4 sm:p-6'>
          <header className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h2 className='text-lg font-semibold'>Must spend planner</h2>
              <p className='text-sm text-neutral-400'>Plan and tick off the essential spends for {formatBdDate(now, { month: 'long', year: 'numeric' })}.</p>
            </div>
            <div className='text-right text-sm text-neutral-400'>
              <div>Outstanding: <span className='font-mono text-danger-400'>{formatMoney(outstandingMustTotal)}</span></div>
              <div className='text-xs uppercase tracking-[0.18em] text-neutral-500'>Cleared {monthlyMustSpends.length - outstandingMustSpends.length} / {monthlyMustSpends.length}</div>
            </div>
          </header>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <button className='tt-button tt-button-outline' onClick={() => setShowTodoForm((v) => !v)}>
              {showTodoForm ? 'Close' : 'Add must spend'}
            </button>
            <span className='text-xs text-neutral-400'>Remaining {outstandingMustSpends.length} item{outstandingMustSpends.length === 1 ? '' : 's'}</span>
          </div>
          {showTodoForm && (
            <form className='rounded-lg border border-neutral-200/50 bg-white/80 p-3 text-sm shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/40' onSubmit={onAddTodoExpense}>
              <div className='grid gap-3 sm:grid-cols-3'>
                <label className='flex flex-col gap-1'>
                  <span className='text-xs uppercase tracking-[0.18em] text-neutral-500'>Amount</span>
                  <input
                    className='rounded border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'
                    type='number'
                    min='0'
                    step='0.01'
                    value={todoAmount}
                    onChange={(e) => setTodoAmount(e.target.value)}
                  />
                </label>
                <label className='flex flex-col gap-1 sm:col-span-2'>
                  <span className='text-xs uppercase tracking-[0.18em] text-neutral-500'>Title</span>
                  <input
                    className='rounded border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'
                    value={todoReason}
                    onChange={(e) => setTodoReason(e.target.value)}
                    placeholder='e.g., Rent, Tuition fee, Electricity'
                  />
                </label>
                <label className='flex flex-col gap-1 sm:col-span-3'>
                  <span className='text-xs uppercase tracking-[0.18em] text-neutral-500'>Reminder note (optional)</span>
                  <textarea
                    className='rounded border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'
                    rows={2}
                    value={todoNote}
                    onChange={(e) => setTodoNote(e.target.value)}
                    placeholder='Add a quick reminder or checklist'
                  />
                </label>
              </div>
              <div className='mt-3 flex flex-wrap items-end gap-3'>
                <label className='flex flex-col gap-1'>
                  <span className='text-xs uppercase tracking-[0.18em] text-neutral-500'>Due date</span>
                  <input
                    className='rounded border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'
                    type='datetime-local'
                    value={todoWhen}
                    onChange={(e) => setTodoWhen(e.target.value)}
                  />
                </label>
                <button className='tt-button tt-button-primary' type='submit' disabled={todoSaving}>
                  {todoSaving ? 'Saving…' : 'Save must spend'}
                </button>
              </div>
              {todoError && <p className='mt-2 text-sm text-danger-400'>{todoError}</p>}
            </form>
          )}
          {orderedMustSpends.length === 0 ? (
            <p className='text-sm text-neutral-400'>No must spends yet. Add your first one above.</p>
          ) : (
            <ul className='space-y-2'>
              {orderedMustSpends.map((entry) => {
                const key = entry._id || entry.id;
                const checked = Boolean(entry.isCleared);
                const dueDate = entry.dueAt ? new Date(entry.dueAt) : (entry.at ? new Date(entry.at) : null);
                const overdue = dueDate && !checked && dueDate < now;
                return (
                  <li key={key} className='flex flex-col gap-2 rounded-lg border border-neutral-200/40 bg-white/80 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-800/60 dark:bg-neutral-900/40 dark:text-neutral-200 sm:flex-row sm:items-center sm:justify-between'>
                    <label className='flex flex-1 cursor-pointer items-start gap-3'>
                      <input
                        type='checkbox'
                        className='mt-1 h-4 w-4 cursor-pointer'
                        checked={checked}
                        onChange={() => toggleTodo(entry)}
                      />
                      <div className='space-y-1'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                          <span className='font-semibold'>{entry.reason || 'Must spend'}</span>
                          <span className='font-mono text-base'>{formatMoney(entry.amount)}</span>
                        </div>
                        <div className='text-xs text-neutral-500 dark:text-neutral-400'>
                          {dueDate ? `Due ${formatBdDate(dueDate, { day: 'numeric', month: 'short' })} • ${formatBdTime(dueDate)}` : 'No due date set'}
                          {overdue && <span className='ml-2 font-medium text-danger-500'>Overdue</span>}
                        </div>
                        {entry.note && <div className='text-xs text-neutral-500 dark:text-neutral-400'>Reminder: {entry.note}</div>}
                      </div>
                    </label>
                    <div className='flex flex-wrap items-center gap-2'>
                      <button
                        type='button'
                        className='tt-button tt-button-outline text-xs'
                        onClick={() => toggleTodo(entry)}
                      >
                        {checked ? 'Mark pending' : 'Mark done'}
                      </button>
                      <button
                        type='button'
                        className='tt-button tt-button-outline text-xs'
                        onClick={() => removeMonthlyExpense(entry)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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
                      {loan.entries.length} entr{loan.entries.length === 1 ? 'y' : 'ies'} • Last: {loan.entries[0] && loan.entries[0].at ? formatBdDate(new Date(loan.entries[0].at)) : 'N/A'}
                    </div>
                    <button
                      type='button'
                      className='mt-2 tt-button tt-button-outline text-xs'
                      onClick={() => settleLoanGroup(loan)}
                    >
                      Mark completed
                    </button>
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
                      {loan.entries.length} entr{loan.entries.length === 1 ? 'y' : 'ies'} • Last: {loan.entries[0] && loan.entries[0].at ? formatBdDate(new Date(loan.entries[0].at)) : 'N/A'}
                    </div>
                    <button
                      type='button'
                      className='mt-2 tt-button tt-button-outline text-xs'
                      onClick={() => settleLoanGroup(loan)}
                    >
                      Mark completed
                    </button>
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

          <div className='card space-y-4 p-4'>
            {chartMode === 'histogram' ? (
              <>
                <div className='text-sm text-neutral-400'>Daily spend trend ({chartTab === 'week' ? 'last 7 days' : 'this month'})</div>
                <div className='h-64 w-full'>
                  <Bar data={barData} options={barOptions} />
                </div>
              </>
            ) : (
              <>
                <div className='text-sm text-neutral-400'>Spending mix ({chartTab === 'week' ? 'this week' : 'this month'})</div>
                {pieView.total > 0 ? (
                  <div className='flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-evenly'>
                    <div className='h-64 w-full max-w-xs'>
                      <Pie data={pieData} options={pieOptions} />
                    </div>
                    <ul className='w-full max-w-xs space-y-2 text-sm'>
                      {pieView.items.map((item) => (
                        <li key={item.key} className='flex items-center gap-3 rounded border border-neutral-800/40 px-3 py-2'>
                          <span className='inline-block h-3 w-3 rounded-full' style={{ background: item.chartColor }} />
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
              </>
            )}
          </div>

          <div className='card space-y-3 p-4'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <div className='text-sm font-semibold text-neutral-200'>Daily category breakdown</div>
                <p className='text-xs uppercase tracking-[0.18em] text-neutral-500'>{selectedInsightDay?.label}</p>
                {insightCategoryBreakdown.total > 0 && (
                  <p className='text-xs text-neutral-400'>Total expense: {formatMoney(insightCategoryBreakdown.total)}</p>
                )}
              </div>
              <label className='flex flex-col text-xs text-neutral-400 sm:text-right'>
                <span className='hidden text-neutral-500 sm:inline'>Select day</span>
                <select
                  className='input mt-0 sm:mt-1'
                  value={String(insightDayIndex)}
                  onChange={(event) => setInsightDayIndex(Number(event.target.value))}
                >
                  {insightDays.map((day, idx) => (
                    <option key={day.key} value={idx}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {insightCategoryPieData ? (
              <div className='flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-evenly'>
                <div className='h-64 w-full max-w-xs'>
                  <Pie data={insightCategoryPieData} options={insightCategoryPieOptions} />
                </div>
                <ul className='w-full max-w-xs space-y-2 text-sm'>
                  {insightCategoryBreakdown.categories.map((item, idx) => (
                    <li key={item.name} className='flex items-center gap-3 rounded border border-neutral-800/40 px-3 py-2'>
                      <span
                        className='inline-block h-3 w-3 rounded-full'
                        style={{ background: insightCategoryPieData.datasets[0].backgroundColor[idx] }}
                      />
                      <span className='flex-1'>{item.name}</span>
                      <span className='font-mono'>{formatMoney(item.value)}</span>
                      <span className='text-xs text-neutral-400'>
                        {Math.round((item.value / insightCategoryBreakdown.total) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className='text-sm text-neutral-400'>No expense recorded for this day.</p>
            )}
          </div>

          <div className='card p-4'>
            <h3 className='text-sm font-semibold text-neutral-200'>Daily breakdown</h3>
            <p className='text-xs uppercase tracking-[0.18em] text-neutral-500'>
              {chartTab === 'week' ? 'Last 7 days' : 'This month'}
            </p>
            <div className='mt-3 max-h-60 overflow-auto rounded border border-neutral-800/40'>
              <table className='w-full text-left text-sm text-neutral-200'>
                <thead className='bg-neutral-900/60 text-xs uppercase tracking-[0.12em] text-neutral-500'>
                  <tr>
                    <th className='px-3 py-2'>Date</th>
                    <th className='px-3 py-2 text-right'>Expense</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyBreakdown.length === 0 && (
                    <tr>
                      <td className='px-3 py-3 text-sm text-neutral-400' colSpan={2}>No expense recorded for this period.</td>
                    </tr>
                  )}
                  {dailyBreakdown.map((item) => (
                    <tr key={item.key} className='border-t border-neutral-800/40'>
                      <td className='px-3 py-2'>{item.label}</td>
                      <td className='px-3 py-2 text-right font-mono'>{formatMoney(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <details className='card space-y-4 p-4 sm:p-6'>
          <summary className='nav-link cursor-pointer text-base font-semibold'>Expense history</summary>
          <header className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <div>
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
                          {[
                            entry.place || '-',
                            entry.method || '',
                            entry.reason || '',
                            entry.loanParty ? `Loan with ${entry.loanParty}` : '',
                            entry.fundSource ? `Paid with ${formatFundSourceLabel(entry.fundSource)}` : '',
                          ].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                      <div className='flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3'>
                        <span className='text-xs text-neutral-500'>{formatBdTime(new Date(entry.at))}</span>
                        <button
                          type='button'
                          className='tt-button tt-button-outline text-xs'
                          onClick={() => deleteHistoryEntry(entry)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
};

export default Spend;
