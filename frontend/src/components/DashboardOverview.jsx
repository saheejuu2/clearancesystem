import { useState, useEffect } from 'react';
import api from '../services/api';

const fmt = (dt) => dt ? new Date(dt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

export default function DashboardOverview({ title = 'Dashboard', subtitle = 'Overview', onCardClick }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/get_stats.php')
      .then(r => setStats(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-center py-12 text-gray-300 text-sm">Loading...</p>;
  if (!stats)  return <p className="text-center py-12 text-gray-300 text-sm">No data available.</p>;

  const cards = [
    { label: 'Total Patients',   value: stats.total_patients,   color: 'bg-blue-50 text-blue-700',       tab: 'total',            icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: 'Awaiting Billing', value: stats.awaiting_billing, color: 'bg-amber-50 text-amber-700',     tab: 'awaiting_billing', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'In Clearance',     value: stats.in_progress,      color: 'bg-violet-50 text-violet-700',   tab: 'in_clearance',     icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { label: 'Missing Req.',     value: stats.pending_count,    color: 'bg-orange-50 text-orange-700',   tab: 'pending',          icon: 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' },
    { label: 'Discharged',       value: stats.discharged,       color: 'bg-emerald-50 text-emerald-700', tab: 'discharged',       icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">{title}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map(c => (
          <div key={c.label}
            onClick={() => onCardClick && onCardClick(c.tab)}
            className={`rounded-2xl p-5 ${c.color} flex flex-col gap-3 ${onCardClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}>
            <svg className="w-6 h-6 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.icon} />
            </svg>
            <div>
              <p className="text-3xl font-bold">{c.value}</p>
              <p className="text-xs font-semibold mt-0.5 opacity-70 uppercase tracking-wide">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent discharges */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-800">Recent Discharges</p>
            <p className="text-xs text-gray-400 mt-0.5">Last 5 discharged patients</p>
          </div>
          {stats.recent_discharges.length === 0 ? (
            <p className="text-center py-8 text-gray-300 text-sm">No discharges yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {['Patient', 'Ward', 'Discharged At', 'By'].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recent_discharges.map(p => (
                  <tr key={p.patient_no} className="hover:bg-gray-50/70">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-800 text-xs">{p.full_name}</p>
                      <p className="font-mono text-xs text-gray-400">{p.patient_no}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{p.ward}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{fmt(p.discharged_at)}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{p.discharged_by || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Cost center clearance breakdown */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-800">Cost Center Activity</p>
            <p className="text-xs text-gray-400 mt-0.5">Clearances per department</p>
          </div>
          {stats.cc_stats.length === 0 ? (
            <p className="text-center py-8 text-gray-300 text-sm">No clearance data yet.</p>
          ) : (
            <div className="px-5 py-4 flex flex-col gap-3">
              {stats.cc_stats.map(cc => {
                const pct = cc.total > 0 ? Math.round((cc.cleared / cc.total) * 100) : 0;
                return (
                  <div key={cc.cost_center}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700 truncate max-w-[60%]">{cc.cost_center}</span>
                      <span className="text-xs text-gray-400">{cc.cleared}/{cc.total}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: pct + '%' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
