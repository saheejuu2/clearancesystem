import { useState, useEffect } from 'react';
import api from '../services/api';

const ACTION_STYLE = (action) => {
  if (action.includes('Discharged'))    return 'bg-emerald-100 text-emerald-700';
  if (action.includes('Cleared'))       return 'bg-green-100 text-green-700';
  if (action.includes('May Go Home'))   return 'bg-blue-100 text-blue-600';
  if (action.includes('Clearance'))     return 'bg-amber-100 text-amber-600';
  return 'bg-gray-100 text-gray-500';
};

const fmt = (dt) =>
  dt ? new Date(dt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function AuditTrail({ role }) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    api.get(`/get_audit_logs.php?role=${encodeURIComponent(role)}`)
      .then(res => setLogs(res.data))
      .finally(() => setLoading(false));
  }, [role]);

  const filtered = logs.filter(l =>
    l.patient_name.toLowerCase().includes(search.toLowerCase()) ||
    l.patient_no.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Audit Trail</h1>
          <p className="text-sm text-gray-400 mt-0.5">All clearance actions performed</p>
        </div>
        <button onClick={() => {
          setLoading(true);
          api.get(`/get_audit_logs.php?role=${encodeURIComponent(role)}`)
            .then(res => setLogs(res.data))
            .finally(() => setLoading(false));
        }} className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by patient name, ID, or action…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Log table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                {['Date & Time', 'Patient ID', 'Patient Name', 'Ward', 'Action', 'Performed By', 'Remarks'].map(h => (
                  <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">No audit records found.</td></tr>
              ) : filtered.map(log => (
                <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{fmt(log.created_at)}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-400">{log.patient_no}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-800 whitespace-nowrap">{log.patient_name}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">{log.ward || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${ACTION_STYLE(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{log.performed_by}</td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs max-w-xs truncate">{log.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
