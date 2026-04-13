import { useState, useEffect } from 'react';

const today = () => new Date().toISOString().split('T')[0];

export default function DateFilter({ value, onChange }) {
  // Auto-reset to today at midnight
  useEffect(() => {
    const msUntilMidnight = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      return midnight - now;
    };

    const timer = setTimeout(() => {
      onChange(today());
    }, msUntilMidnight());

    return () => clearTimeout(timer);
  }, [value]);

  const isToday = value === today();

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <input
          type="date"
          value={value}
          max={today()}
          onChange={e => onChange(e.target.value)}
          className="pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm transition"
        />
      </div>
      {!isToday && (
        <button onClick={() => onChange(today())}
          className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap">
          Back to Today
        </button>
      )}
      {isToday && (
        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-2.5 rounded-xl whitespace-nowrap">
          Today
        </span>
      )}
    </div>
  );
}
