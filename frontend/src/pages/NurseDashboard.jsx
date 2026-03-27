import { useState, useEffect } from 'react';
import api from '../services/api';
import AuditTrail from '../components/AuditTrail';

const STEP_LABEL = {
  no_request:           { label: 'Admitted',    style: 'bg-gray-100 text-gray-500'       },
  awaiting_nurse:       { label: 'Admitted',    style: 'bg-gray-100 text-gray-500'       },
  awaiting_billing:     { label: 'May Go Home', style: 'bg-blue-100 text-blue-600'       },
  cost_center_clearing: { label: 'In Clearance',style: 'bg-amber-100 text-amber-600'     },
  discharged:           { label: 'Discharged',  style: 'bg-emerald-100 text-emerald-700' },
};

export default function NurseDashboard({ user, onLogout }) {
  const [tab, setTab]         = useState('patients');
  const [patients, setPatients] = useState([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState(null);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await api.get('/get_patients.php?role=Nurse');
      setPatients(res.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPatients(); }, []);

  const markMayGoHome = async (patient_id) => {
    setActionId(patient_id);
    try {
      const res = await api.post('/update_clearance.php', { action: 'may_go_home', patient_id, actor: user.costCenter });
      if (res.data.success) fetchPatients();
      else alert(res.data.message);
    } finally { setActionId(null); }
  };

  const filtered = patients.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.patient_no.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-emerald-800 sticky top-0 z-10 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/GEAMH LOGO.png" alt="logo" className="w-7 h-7 object-contain" />
            <div className="leading-tight">
              <p className="text-[10px] text-emerald-300 uppercase tracking-widest">Hospital Clearance System</p>
              <p className="text-white font-semibold text-sm">{user.costCenter}</p>
            </div>
          </div>
          <button onClick={onLogout} className="text-sm text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all">Logout</button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1">
          {[['patients','Patients'],['audit','Audit Trail']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {tab === 'audit' ? <AuditTrail role={user.costCenter} /> : (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Patient List</h1>
              <p className="text-sm text-gray-400 mt-0.5">Click "May Go Home" to initiate discharge clearance</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                </svg>
                <input type="text" placeholder="Search by name or patient ID…" value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition" />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {['Patient ID','Name','Age','Ward','Admit Date','Status','Action'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">Loading…</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">No patients found.</td></tr>
                    ) : filtered.map(p => {
                      const step = STEP_LABEL[p.clearance_step] || STEP_LABEL['no_request'];
                      const canAct = p.clearance_step === 'no_request' || p.clearance_step === 'awaiting_nurse';
                      return (
                        <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-5 py-4 font-mono text-xs text-gray-400">{p.patient_no}</td>
                          <td className="px-5 py-4 font-semibold text-gray-800">{p.full_name}</td>
                          <td className="px-5 py-4 text-gray-500">{p.age}</td>
                          <td className="px-5 py-4 text-gray-500">{p.ward}</td>
                          <td className="px-5 py-4 text-gray-500">{p.admit_date}</td>
                          <td className="px-5 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${step.style}`}>{step.label}</span>
                          </td>
                          <td className="px-5 py-4">
                            {canAct ? (
                              <button onClick={() => markMayGoHome(p.id)} disabled={actionId === p.id}
                                className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors">
                                {actionId === p.id ? 'Saving…' : 'May Go Home'}
                              </button>
                            ) : <span className="text-xs text-gray-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-gray-100">
                {filtered.map(p => {
                  const step = STEP_LABEL[p.clearance_step] || STEP_LABEL['no_request'];
                  const canAct = p.clearance_step === 'no_request' || p.clearance_step === 'awaiting_nurse';
                  return (
                    <div key={p.id} className="p-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-800">{p.full_name}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.patient_no}</p>
                        <p className="text-xs text-gray-500 mt-1">{p.ward} · Age {p.age} · {p.admit_date}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${step.style}`}>{step.label}</span>
                        {canAct && (
                          <button onClick={() => markMayGoHome(p.id)} disabled={actionId === p.id}
                            className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors">
                            {actionId === p.id ? 'Saving…' : 'May Go Home'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                Showing {filtered.length} of {patients.length} patients
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
