import { useState, useEffect } from 'react';
import api from '../services/api';

const fmt = (dt) =>
  dt ? new Date(dt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

const actionStyle = (action) => {
  if (!action) return 'bg-gray-100 text-gray-500';
  if (action.includes('Cancelled'))   return 'bg-red-100 text-red-600';
  if (action.includes('Discharged'))  return 'bg-emerald-100 text-emerald-700';
  if (action.includes('Cleared'))     return 'bg-green-100 text-green-700';
  if (action.includes('May Go Home')) return 'bg-blue-100 text-blue-600';
  if (action.includes('Clearance'))   return 'bg-amber-100 text-amber-600';
  return 'bg-gray-100 text-gray-500';
};

export default function AuditTrail({ role }) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  const fetchLogs = () => {
    setLoading(true);
    const param = role && role !== 'admin' ? ('?role=' + encodeURIComponent(role)) : '';
    api.get('/get_audit_logs.php' + param)
      .then(res => setLogs(Array.isArray(res.data) ? res.data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLogs(); }, [role]);

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    return !q ||
      (l.patient_name && l.patient_name.toLowerCase().includes(q)) ||
      (l.patient_no && l.patient_no.toLowerCase().includes(q)) ||
      (l.action && l.action.toLowerCase().includes(q)) ||
      (l.performed_by && l.performed_by.toLowerCase().includes(q));
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Audit Trail</h1>
          <p className="text-sm text-gray-400 mt-0.5">All recorded actions</p>
        </div>
        <button onClick={fetchLogs} className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
          Refresh
        </button>
      </div>
      <input type="text" placeholder="Search by patient, action, or performed by..." value={search} onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                {['Date & Time','Patient ID','Patient Name','Ward','Action','Performed By','Remarks'].map(h => (
                  <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">No audit records found.</td></tr>
              ) : filtered.map(log => (
                <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-5 py-3.5 text-xs text-gray-400 whitespace-nowrap">{fmt(log.created_at)}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-400">{log.patient_no || '-'}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-800">{log.patient_name || '-'}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">{log.ward || '-'}</td>
                  <td className="px-5 py-3.5">
                    <span className={"text-xs font-semibold px-2.5 py-1 rounded-full " + actionStyle(log.action)}>
                      {log.action || '-'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{log.performed_by || '-'}</td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs max-w-xs truncate">{log.remarks || '-'}</td>
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
