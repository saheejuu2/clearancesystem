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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-emerald-800 sticky top-0 z-10 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
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
            <button onClick={onLogout} className="text-sm text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1">
          {[['patients','Patients'],['audit','Audit Trail']].map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); if (key === 'audit') setAuditKey(k => k + 1); }}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {tab === 'staff' && <StaffManager costCenter={user.costCenter} />}
        {tab === 'audit' && <AuditTrail key={auditKey} role={user.costCenter} />}
        {tab === 'patients' && (
        <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{user.costCenter} Clearance</h1>
          <p className="text-sm text-gray-400 mt-0.5">Review and clear patients assigned to your department</p>
        </div>

        {/* Search */}
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name or patient ID…" />

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
                  <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">Loading…</td></tr>
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
      {notifReport && <ClearanceReport patientId={notifReport.id} onClose={() => setNotifReport(null)} />}

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









