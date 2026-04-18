import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

const todayStr = () => new Date().toISOString().split('T')[0];

function parseLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function DateFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? parseLocal(value) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [pendingDates, setPendingDates] = useState([]);
  const ref = useRef(null);

  // Auto-reset to today at midnight
  useEffect(() => {
    const msUntilMidnight = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      return midnight - now;
    };
    const timer = setTimeout(() => onChange(todayStr()), msUntilMidnight());
    return () => clearTimeout(timer);
  }, [value]);

  // Fetch pending dates for the viewed month
  useEffect(() => {
    const monthStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}`;
    api.get(`/get_pending_dates.php?month=${monthStr}`)
      .then(r => setPendingDates(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, [viewMonth.year, viewMonth.month]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isToday = value === todayStr();

  const prevMonth = () => setViewMonth(v => {
    const d = new Date(v.year, v.month - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const nextMonth = () => setViewMonth(v => {
    const d = new Date(v.year, v.month + 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const buildDays = () => {
    const { year, month } = viewMonth;
    const first = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  };

  const selectDay = (day) => {
    if (!day) return;
    const { year, month } = viewMonth;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const today = new Date(); today.setHours(0,0,0,0);
    const picked = new Date(year, month, day);
    if (picked > today) return; // no future dates
    onChange(dateStr);
    setOpen(false);
  };

  const monthLabel = new Date(viewMonth.year, viewMonth.month, 1)
    .toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });

  const todayDate = new Date(); todayDate.setHours(0,0,0,0);

  return (
    <div className="relative flex items-center gap-2" ref={ref}>
      {/* Trigger button */}
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 pl-3 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm transition whitespace-nowrap">
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {value ? parseLocal(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pick date'}
      </button>

      {!isToday && (
        <button onClick={() => { onChange(todayStr()); const t = new Date(); setViewMonth({ year: t.getFullYear(), month: t.getMonth() }); }}
          className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap">
          Back to Today
        </button>
      )}
      {isToday && (
        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-2.5 rounded-xl whitespace-nowrap">Today</span>
      )}

      {/* Calendar dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 w-72">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-700">{monthLabel}</span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-y-1">
            {buildDays().map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const { year, month } = viewMonth;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = dateStr === value;
              const isTodayDay = dateStr === todayStr();
              const isFuture = new Date(year, month, day) > todayDate;
              const hasPending = pendingDates.includes(dateStr);

              return (
                <button key={day} onClick={() => selectDay(day)} disabled={isFuture}
                  className={`relative flex flex-col items-center justify-center h-9 w-full rounded-lg text-sm font-medium transition-colors
                    ${isFuture ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-emerald-50 cursor-pointer'}
                    ${isSelected ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}
                    ${isTodayDay && !isSelected ? 'ring-2 ring-emerald-400 text-emerald-700' : ''}
                    ${!isSelected && !isTodayDay && !isFuture ? 'text-gray-700' : ''}
                  `}>
                  {day}
                  {hasPending && !isSelected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-500" />
                  )}
                  {hasPending && isSelected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/80" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
