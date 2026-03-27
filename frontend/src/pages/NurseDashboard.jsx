import { useState, useEffect } from 'react';
import api from '../services/api';
import AuditTrail from '../components/AuditTrail';
import PhClock from '../components/PhClock';
import SearchBar from '../components/SearchBar';

const STEP_LABEL = {
  no_request:           { label: 'Admitted',     style: 'bg-gray-100 text-gray-500'       },
  awaiting_nurse:       { label: 'Admitted',     style: 'bg-gray-100 text-gray-500'       },
  awaiting_billing:     { label: 'May Go Home',  style: 'bg-blue-100 text-blue-600'       },
  cost_center_clearing: { label: 'In Clearance', style: 'bg-amber-100 text-amber-600'     },
  discharged:           { label: 'Discharged',   style: 'bg-emerald-100 text-emerald-700' },
};

export default function NurseDashboard({ user, onLogout }) {
  const [tab, setTab]           = useState('patients');
  const [auditKey, setAuditKey] = useState(0);
  const [patients, setPatients] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [actionId, setActionId] = useState(null);

  // inline confirm form state: { patientId, nurseName, remarks }
  const [confirmForm, setConfirmForm] = useState(null);
  const [cancelForm, setCancelForm]   = useState(null);
  const [cancelling, setCancelling]   = useState(false);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const [listRes, allRes] = await Promise.all([
        api.get('/get_patients.php?role=Nurse'),
        api.get('/get_patients.php?role=Billing'), // get all in-progress for cancel
      ]);
      setPatients(listRes.data);
      setAllPatients(allRes.data.filter(p =>
        ['awaiting_billing', 'cost_center_clearing'].includes(p.clearance_step)
      ));
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPatients(); }, []);

  const openForm = (patient_id) => {
    setConfirmForm({ patientId: patient_id, nurseName: '', remarks: '' });
  };

  const submitMayGoHome = async () => {
    if (!confirmForm.nurseName.trim()) {
      alert('Please enter your name before confirming.');
      return;
    }
    setActionId(confirmForm.patientId);
    try {
      const res = await api.post('/update_clearance.php', {
        action:     'may_go_home',
        patient_id: confirmForm.patientId,
        actor:      confirmForm.nurseName.trim(),
        remarks:    confirmForm.remarks.trim(),
      });
      if (res.data.success) { setConfirmForm(null); fetchPatients(); setAuditKey(k => k + 1); }
      else alert(res.data.message);
    } finally { setActionId(null); }
  };

  const submitCancel = async () => {
    if (!cancelForm.nurseName.trim()) { alert('Please enter your name before cancelling.'); return; }
    setCancelling(true);
    try {
      const res = await api.post('/update_clearance.php', {
        action:     'cancel_discharge',
        patient_id: cancelForm.patientId,
        actor:      cancelForm.nurseName.trim(),
        remarks:    cancelForm.remarks.trim() || 'Discharge cancelled by nurse',
      });
      if (res.data.success) { setCancelForm(null); fetchPatients(); setAuditKey(k => k + 1); }
      else alert(res.data.message);
    } finally { setCancelling(false); }
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
          <div className="flex items-center gap-3">
            <PhClock />
            <button onClick={onLogout} className="text-sm text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all">Logout</button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1">
          {[['patients','Patients'],['audit','Audit Trail']].map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); if (key === 'audit') { fetchPatients(); setAuditKey(k => k + 1); } }}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {tab === 'audit' ? <AuditTrail key={auditKey} role={user.costCenter} patients={allPatients} cancelForm={cancelForm} setCancelForm={setCancelForm} submitCancel={submitCancel} cancelling={cancelling} /> : (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Patient List</h1>
              <p className="text-sm text-gray-400 mt-0.5">Click "May Go Home" to initiate discharge clearance</p>
            </div>

            <SearchBar value={search} onChange={setSearch} placeholder="Search by name or patient ID…" />

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {['Patient ID','Name','Age','Ward','Admit Date','Status','Action'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">Loading…</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">No patients found.</td></tr>
                    ) : filtered.map(p => {
                      const step   = STEP_LABEL[p.clearance_step] || STEP_LABEL['no_request'];
                      const canAct = p.clearance_step === 'no_request' || p.clearance_step === 'awaiting_nurse';
                      const isOpen = confirmForm?.patientId === p.id;
                      return (
                        <>
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
                                <button onClick={() => openForm(p.id)}
                                  className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                                  May Go Home
                                </button>
                              ) : <span className="text-xs text-gray-300">—</span>}
                            </td>
                          </tr>

                          {/* Inline confirmation form */}
                          {isOpen && (
                            <tr key={`form-${p.id}`} className="bg-blue-50">
                              <td colSpan={7} className="px-5 py-4">
                                <p className="text-xs font-semibold text-blue-700 mb-3 uppercase tracking-wide">
                                  Confirm: {p.full_name} — May Go Home
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                                  <div className="flex flex-col gap-1 flex-1">
                                    <label className="text-xs font-semibold text-gray-600">Nurse Name <span className="text-red-500">*</span></label>
                                    <input
                                      type="text"
                                      placeholder="Enter your full name"
                                      value={confirmForm.nurseName}
                                      onChange={e => setConfirmForm(f => ({ ...f, nurseName: e.target.value }))}
                                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1 flex-1">
                                    <label className="text-xs font-semibold text-gray-600">Remarks <span className="text-gray-400">(optional)</span></label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Physician ordered discharge"
                                      value={confirmForm.remarks}
                                      onChange={e => setConfirmForm(f => ({ ...f, remarks: e.target.value }))}
                                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                  </div>
                                  <div className="flex gap-2 shrink-0">
                                    <button onClick={submitMayGoHome} disabled={actionId === p.id}
                                      className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
                                      {actionId === p.id ? 'Saving…' : 'Confirm'}
                                    </button>
                                    <button onClick={() => setConfirmForm(null)}
                                      className="text-sm text-gray-500 hover:text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-lg transition-colors">
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                Showing {filtered.length} of {patients.length} patients
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Cancel discharge confirmation modal */}
      {cancelForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Cancel Discharge Process</h3>
            <p className="text-sm text-gray-500 mb-5">
              You are about to cancel the discharge process for{' '}
              <span className="font-semibold text-gray-800">{cancelForm.patientName}</span>.
              All clearance progress will be removed and the patient will restart from the beginning.
            </p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <input type="text" placeholder="Enter your full name"
                  value={cancelForm.nurseName}
                  onChange={e => setCancelForm(f => ({ ...f, nurseName: e.target.value }))}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Reason <span className="text-gray-400">(optional)</span>
                </label>
                <textarea placeholder="Reason for cancellation…"
                  value={cancelForm.remarks}
                  onChange={e => setCancelForm(f => ({ ...f, remarks: e.target.value }))}
                  rows={2}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={submitCancel} disabled={cancelling}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {cancelling ? 'Cancelling…' : 'Confirm Cancellation'}
              </button>
              <button onClick={() => setCancelForm(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
