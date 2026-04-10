import { useState, useEffect } from 'react';
import api from '../services/api';
import AuditTrail from '../components/AuditTrail';
import PhClock from '../components/PhClock';
import SearchBar from '../components/SearchBar';
import StaffManager from '../components/StaffManager';
import PatientInfoModal from '../components/PatientInfoModal';
import ClearanceReport from '../components/ClearanceReport';
import NotificationBell from '../components/NotificationBell';

export default function CostCenterDashboard({ user, onLogout }) {
  const [tab, setTab]           = useState('patients');
  const [auditKey, setAuditKey] = useState(0);
  const [patients, setPatients] = useState([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [actionId, setActionId] = useState(null);
  const [clearModal, setClearModal] = useState(null); // { patient }
  const [clearName, setClearName]   = useState('');
  const [clearRemarks, setClearRemarks] = useState('');
  const [viewPatient, setViewPatient] = useState(null);
  const [viewClearances, setViewClearances] = useState([]);
  const [notifReport, setNotifReport] = useState(null);
  const [clearedPatients, setClearedPatients] = useState([]);
  const [clearedLoading, setClearedLoading]   = useState(false);
  const [clearedSearch, setClearedSearch]     = useState('');

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/get_patients.php?role=${encodeURIComponent(user.costCenter)}`);
      setPatients(res.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const fetchCcStatus = async (patient_id) => {
    try {
      const res = await api.get(`/get_clearance_report.php?patient_id=${patient_id}`);
      if (res.data.success) {
        const mine = res.data.clearances.find(c => c.cost_center === user.costCenter);
        return mine;
      }
    } catch { /* silent */ }
    return null;
  };

  const [ccStatuses, setCcStatuses] = useState({});

  const fetchClearedPatients = async () => {
    setClearedLoading(true);
    try {
      const res = await api.get(`/get_cleared_patients.php?cost_center=${encodeURIComponent(user.costCenter)}`);
      if (res.data.success) setClearedPatients(res.data.cleared);
    } catch { /* silent */ }
    finally { setClearedLoading(false); }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    patients.forEach(async p => {
      const status = await fetchCcStatus(p.id);
      if (status) {
        setCcStatuses(prev => ({ ...prev, [p.id]: status }));
      }
    });
  }, [patients]);
  const clearPatient = async () => {
    if (!clearName.trim()) {
      alert('Please enter your name before confirming.');
      return;
    }
    const patient_id = clearModal.id;
    setActionId(patient_id);
    try {
      const res = await api.post('/update_clearance.php', {
        action: 'cost_center_clear',
        patient_id,
        cost_center: user.costCenter,
        actor: clearName.trim(),
        remarks: clearRemarks,
      });
      if (res.data.success) {
        setPatients(prev => prev.filter(p => p.id !== patient_id));
        fetchPatients();
        setCcStatuses(prev => ({ ...prev, [patient_id]: { status: 'cleared' } }));
        setClearModal(null);
        setClearName('');
        setClearRemarks('');
        setAuditKey(k => k + 1);
      } else {
        alert(res.data.message);
      }
    } finally { setActionId(null); }
  };

  const filtered = patients.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.patient_no.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <header className="bg-emerald-800 sticky top-0 z-10 shadow">
        <div className="w-full px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}GEAMH-LOGO.png`} alt="logo" className="w-7 h-7 object-contain" />
            <div className="leading-tight">
              <p className="text-[10px] text-emerald-300 uppercase tracking-widest">Hospital Clearance System</p>
              <p className="text-white font-semibold text-sm">{user.costCenter}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PhClock />
            <NotificationBell recipient={user.costCenter} onNotificationClick={n => setNotifReport({ id: n.patient_id })} />
          </div>
        </div>
      </header>

      {/* Sidebar + Main */}
      <div className="flex flex-1 min-h-0">
        <aside className="w-56 shrink-0 bg-white border-r border-gray-100 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Department</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">{user.costCenter}</p>
          </div>
          <nav className="flex flex-col gap-1 p-3 flex-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pb-1">Patients</p>
            <button onClick={() => setTab('patients')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left w-full ${tab === 'patients' ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Patients
            </button>
            <button onClick={() => { setTab('cleared'); fetchClearedPatients(); setClearedSearch(''); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left w-full ${tab === 'cleared' ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Cleared Patients
            </button>
            <button onClick={() => setTab('pending')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left w-full ${tab === 'pending' ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              Pending
            </button>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pt-3 pb-1">Records</p>
            <button onClick={() => { setTab('audit'); setAuditKey(k => k + 1); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left w-full ${tab === 'audit' ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Audit Trail
            </button>
          </nav>
          <div className="p-3 border-t border-gray-100">
            <button onClick={onLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors w-full">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto px-6 py-6">
        {tab === 'staff' && <StaffManager costCenter={user.costCenter} />}
        {tab === 'audit' && <AuditTrail key={auditKey} role={user.costCenter} />}
        {tab === 'pending' && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Pending Patients</h1>
              <p className="text-sm text-gray-400 mt-0.5">Patients sent back to <span className="font-semibold text-gray-600">{user.costCenter}</span> with missing requirements</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {['Patient ID','Name','Age','Ward','Admit Date','Reason','Action'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {patients.filter(p => ccStatuses[p.id]?.status === 'pending' && ccStatuses[p.id]?.remarks).length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">No pending patients sent back to your department.</td></tr>
                    ) : patients.filter(p => ccStatuses[p.id]?.status === 'pending' && ccStatuses[p.id]?.remarks).map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs text-gray-400">{p.patient_no}</td>
                        <td className="px-5 py-4 font-semibold text-gray-800">{p.full_name}</td>
                        <td className="px-5 py-4 text-gray-500">{p.age}</td>
                        <td className="px-5 py-4 text-gray-500">{p.ward}</td>
                        <td className="px-5 py-4 text-gray-500">{p.admit_date}</td>
                        <td className="px-5 py-4 text-orange-600 text-xs font-medium max-w-[180px] truncate" title={ccStatuses[p.id]?.remarks}>{ccStatuses[p.id]?.remarks}</td>
                        <td className="px-5 py-4">
                          <button onClick={() => { setClearModal(p); setClearName(''); setClearRemarks(''); }}
                            className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                            Clear Patient
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                {patients.filter(p => ccStatuses[p.id]?.status === 'pending' && ccStatuses[p.id]?.remarks).length} pending patient(s)
              </div>
            </div>
          </div>
        )}
        {tab === 'cleared' && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Cleared Patients</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                Patients your department has already cleared — this is <span className="font-semibold text-gray-600">not</span> the audit trail.
                The <span className="font-semibold text-gray-600">Audit Trail</span> logs every action taken by every user across the system,
                while this list shows only patients cleared specifically by <span className="font-semibold text-gray-600">{user.costCenter}</span>.
              </p>
            </div>
            <SearchBar value={clearedSearch} onChange={setClearedSearch} placeholder="Search by name or patient ID..." />
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {['Patient ID','Name','Age','Ward','Admit Date','Cleared By','Cleared At','Remarks',''].map(h => (
                        <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {clearedLoading ? (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-300 text-sm">Loading...</td></tr>
                    ) : clearedPatients.filter(p =>
                        p.full_name.toLowerCase().includes(clearedSearch.toLowerCase()) ||
                        p.patient_no.toLowerCase().includes(clearedSearch.toLowerCase())
                      ).length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-300 text-sm">No cleared patients yet.</td></tr>
                    ) : clearedPatients
                        .filter(p =>
                          p.full_name.toLowerCase().includes(clearedSearch.toLowerCase()) ||
                          p.patient_no.toLowerCase().includes(clearedSearch.toLowerCase())
                        )
                        .map(p => (
                          <tr key={p.patient_id + p.cleared_at} className="hover:bg-gray-50/70 transition-colors">
                            <td className="px-5 py-4 font-mono text-xs text-gray-400">{p.patient_no}</td>
                            <td className="px-5 py-4 font-semibold text-gray-800">{p.full_name}</td>
                            <td className="px-5 py-4 text-gray-500">{p.age}</td>
                            <td className="px-5 py-4 text-gray-500">{p.ward}</td>
                            <td className="px-5 py-4 text-gray-500">{p.admit_date}</td>
                            <td className="px-5 py-4 text-gray-700 font-medium">{p.cleared_by || '—'}</td>
                            <td className="px-5 py-4 text-gray-500 text-xs whitespace-nowrap">
                              {p.cleared_at
                                ? new Date(p.cleared_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
                                : '—'}
                            </td>
                            <td className="px-5 py-4 text-gray-400 text-xs max-w-[180px] truncate">{p.remarks || '—'}</td>
                            <td className="px-5 py-4">
                              <button
                                onClick={async () => {
                                  setViewPatient({ id: p.patient_id, ...p });
                                  try {
                                    const r = await api.get('/get_clearance_report.php?patient_id=' + p.patient_id);
                                    if (r.data.success) setViewClearances(r.data.clearances);
                                    else setViewClearances([]);
                                  } catch { setViewClearances([]); }
                                }}
                                className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                {clearedPatients.length} patient{clearedPatients.length !== 1 ? 's' : ''} cleared by {user.costCenter}
              </div>
            </div>
          </div>
        )}
        {tab === 'patients' && (
        <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{user.costCenter}Clearance</h1>
          <p className="text-sm text-gray-400 mt-0.5">Review and clear patients assigned to your department</p>
        </div>

        {/* Search */}
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name or patient ID" />

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  {['Patient ID','Name','Age','Ward','Admit Date','Balance Status','Action',''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">Loading</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">No patients pending clearance.</td></tr>
                ) : filtered.map(p => {
                  const myStatus = ccStatuses[p.id];
                  const isCleared = myStatus?.status === 'cleared';
                  return (
                    <>
                      <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs text-gray-400">{p.patient_no}</td>
                        <td className="px-5 py-4 font-semibold text-gray-800">{p.full_name}</td>
                        <td className="px-5 py-4 text-gray-500">{p.age}</td>
                        <td className="px-5 py-4 text-gray-500">{p.ward}</td>
                        <td className="px-5 py-4 text-gray-500">{p.admit_date}</td>
                        <td className="px-5 py-4">
                          {isCleared ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Cleared</span>
                          ) : myStatus?.remarks ? (
                            <div className="flex flex-col gap-1">
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-600 w-fit">Pending — Sent Back</span>
                              <span className="text-xs text-gray-400 max-w-[160px] truncate" title={myStatus.remarks}>{myStatus.remarks}</span>
                            </div>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-600">Pending Review</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {!isCleared && p.clearance_step === 'cost_center_clearing' ? (
                            <button
                              onClick={() => { setClearModal(p); setClearName(""); setClearRemarks(""); }}
                              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Clear Patient
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <button onClick={async () => {
                            setViewPatient(p);
                            try {
                              const r = await api.get('/get_clearance_report.php?patient_id=' + p.id);
                              if (r.data.success) setViewClearances(r.data.clearances);
                              else setViewClearances([]);
                            } catch { setViewClearances([]); }
                          }}
                            className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                            View
                          </button>
                        </td>
                      </tr>

                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
            Showing {filtered.length} patients pending clearance
          </div>
        </div>
        </div>
        )}
      </main>
      </div>
      {notifReport && <ClearanceReport patientId={notifReport.id} onClose={() => setNotifReport(null)} userRole="cost_center" userCostCenter={user.costCenter} onAction={(action, patient) => { setNotifReport(null); if (action === "clear") { setClearModal(patient); } }} />}

      {/* Clear Patient Modal */}
      {clearModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Clear Patient</h3>
            <p className="text-sm text-gray-500 mb-5">
              Confirm clearance for <span className="font-semibold text-gray-800">{clearModal.full_name}</span> ({clearModal.patient_no})
            </p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Your Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Enter your full name" value={clearName}
                  onChange={e => setClearName(e.target.value.replace(/[0-9]/g, ""))}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Remarks <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
                <textarea placeholder="e.g. no outstanding balance" value={clearRemarks}
                  onChange={e => setClearRemarks(e.target.value)}
                  rows={2} className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={clearPatient} disabled={actionId === clearModal.id}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {actionId === clearModal.id ? "Clearing..." : "Confirm Cleared"}
              </button>
              <button onClick={() => { setClearModal(null); setClearName(""); setClearRemarks(""); }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <PatientInfoModal patient={viewPatient} clearances={viewClearances} onClose={() => { setViewPatient(null); setViewClearances([]); }} />
    </div>
  );
}









