import React, { useState, useEffect } from 'react';
import api from '../services/api';
import ClearanceReport from '../components/ClearanceReport';
import AuditTrail from '../components/AuditTrail';
import PhClock from '../components/PhClock';
import SearchBar from '../components/SearchBar';
import NotificationBell from '../components/NotificationBell';
import DashboardOverview from '../components/DashboardOverview';


function DischargedList() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [report, setReport]     = useState(null);

  useEffect(() => {
    api.get('/get_patients.php?role=Billing')
      .then(res => setPatients((res.data || []).filter(p => p.clearance_step === 'discharged')))
      .finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.patient_no.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Discharged Patients</h1>
        <p className="text-sm text-gray-400 mt-0.5">All patients that have been discharged</p>
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder="Search by name or patient ID..." />
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                {['Patient ID','Name','Ward','Admit Date','Discharged At',''].map(h => (
                  <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-300 text-sm">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-300 text-sm">No discharged patients.</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs text-gray-400">{p.patient_no}</td>
                  <td className="px-5 py-4 font-semibold text-gray-800">{p.full_name}</td>
                  <td className="px-5 py-4 text-gray-500">{p.ward}</td>
                  <td className="px-5 py-4 text-gray-500">{p.admit_date}</td>
                  <td className="px-5 py-4 text-gray-500 text-xs">
                    {p.discharged_at ? new Date(p.discharged_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : 'Ã¢â‚¬â€'}
                  </td>
                  <td className="px-5 py-4">
                    {p.request_id && (
                      <button onClick={() => setReport(p)}
                        className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                        Report
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
          {filtered.length} patient{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>
      {report && <ClearanceReport patientId={report.id} onClose={() => setReport(null)} />}
    </div>
  );
}

const STEP_LABEL = {
  no_request:           { label: 'Admitted',     style: 'bg-gray-100 text-gray-500'       },
  awaiting_nurse:       { label: 'Admitted',     style: 'bg-gray-100 text-gray-500'       },
  awaiting_billing:     { label: 'May Go Home',  style: 'bg-blue-100 text-blue-600'       },
  cost_center_clearing: { label: 'In Clearance', style: 'bg-amber-100 text-amber-600'     },
  discharged:           { label: 'Discharged',   style: 'bg-emerald-100 text-emerald-700' },
};

const ALL_COST_CENTERS = [
  'Operating Room/Delivery Room',
  'Pulmonary Department (MSA)',
  'Hemodialysis Unit',
  'Newborn Screening',
  'Newborn Hearing Test',
  'Radiology',
  'Laboratory',
  'Bloodbank',
  'Pharmacy',
  'Benefits - Window 3A',
  'Benefits - Window 3B',
  'Benefits - Window 6',
];

export default function BillingDashboard({ user, onLogout }) {
  const [tab, setTab]               = useState('patients');
  const [auditKey, setAuditKey]     = useState(0);
  const [patients, setPatients]     = useState([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(false);
  const [actionId, setActionId]     = useState(null);
  const [dischargeModal, setDischargeModal] = useState(null);
  const [dischargeSuccess, setDischargeSuccess] = useState(null); // { full_name, patient_no }
  const [dischargeRemarks, setDischargeRemarks] = useState("");
  const [dischargeName, setDischargeName] = useState("");
  const [ccProgress, setCcProgress] = useState({});
  const [reportPatient, setReport]  = useState(null);
  const [clearanceForm, setClearanceForm] = useState(null);
  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await api.get('/get_patients.php?role=Billing');
      setPatients(res.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const fetchProgress = async (patient_id) => {
    try {
      const res = await api.get(`/get_clearance_report.php?patient_id=${patient_id}`);
      if (res.data.success) {
        const cleared = res.data.clearances.filter(c => c.status === 'cleared').length;
        const total   = res.data.clearances.length;
        setCcProgress(prev => ({ ...prev, [patient_id]: { cleared, total } }));
      }
    } catch { /* silent */ }
  };

  useEffect(() => { fetchPatients(); }, []);

  useEffect(() => {
    patients.forEach(p => {
      if (p.clearance_step === 'cost_center_clearing') fetchProgress(p.id);
    });
  }, [patients]);

  const openClearanceForm = (p) => {
    setClearanceForm({ patientId: p.id, selected: [...ALL_COST_CENTERS] });
  };

  const sendForClearance = async () => {
    if (!clearanceForm || clearanceForm.selected.length === 0) {
      alert('Select at least one cost center.');
      return;
    }
    setActionId(clearanceForm.patientId);
    try {
      const res = await api.post('/update_clearance.php', {
        action: 'for_clearance',
        patient_id: clearanceForm.patientId,
        actor: user.costCenter,
        cost_centers: clearanceForm.selected,
      });
      if (res.data.success) { setClearanceForm(null); fetchPatients(); }
      else alert(res.data.message);
    } finally { setActionId(null); }
  };

  const discharge = async () => {
    if (!dischargeName.trim()) { alert("Please enter your name before discharging."); return; }
    if (!dischargeRemarks.trim()) { alert("Please enter final remarks before discharging."); return; }
    const patient_id = dischargeModal.id;
    setActionId(patient_id);
    try {
      const res = await api.post("/update_clearance.php", { action: "discharge", patient_id, actor: dischargeName.trim(), remarks: dischargeRemarks });
      if (res.data.success) { setDischargeSuccess({ full_name: dischargeModal.full_name, patient_no: dischargeModal.patient_no }); setDischargeModal(null); setDischargeRemarks(""); setDischargeName(""); fetchPatients(); setAuditKey(k => k + 1); }
      else alert(res.data.message);
    } finally { setActionId(null); }
  };
  const filtered = patients.filter(p =>
    p.clearance_step !== 'discharged' &&
    (p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.patient_no.toLowerCase().includes(search.toLowerCase()))
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
            <NotificationBell recipient={user.costCenter} onNotificationClick={async n => { if (n.id) await api.post("/notifications.php?action=read", { id: n.id }).catch(() => {}); setReport({ id: n.patient_id, notifId: n.id }); }} />
            <button onClick={onLogout} className="text-sm text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all">Logout</button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 shrink-0 bg-white border-r border-gray-100 flex flex-col">
          <nav className="flex flex-col gap-1 p-3">
            {[
              { key: "dashboard", label: "Dashboard",   d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
              { key: "patients",   label: "Patients",    d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
              { key: "discharged", label: "Discharged",  d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
              { key: "audit",      label: "Audit Trail", d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
            ].map(({ key, label, d }) => (
              <button key={key} onClick={() => { setTab(key); if (key === "audit") setAuditKey(k => k + 1); }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left w-full ${tab === key ? "bg-emerald-700 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}>
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
                </svg>
                {label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
        {tab === "dashboard" && <DashboardOverview title="Billing Dashboard" subtitle="Patient clearance overview" />}

        {tab === "audit" && <AuditTrail key={auditKey} role={user.costCenter} />}

        {tab === 'patients' && (
          <>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Billing Dashboard</h1>
              <p className="text-sm text-gray-400 mt-0.5">Manage patient clearance and discharge</p>
            </div>

            <SearchBar value={search} onChange={setSearch} placeholder="Search by name or patient" />

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {['Patient ID', 'Name', 'Ward', 'Admit Date', 'Status', 'Progress', 'Action'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">Loading</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">No patients found.</td></tr>
                    ) : filtered.map(p => {
                      const step = STEP_LABEL[p.clearance_step] || STEP_LABEL['no_request'];
                      const prog = ccProgress[p.id];
                      return (
                        <>
                          <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                            <td className="px-5 py-4 font-mono text-xs text-gray-400">{p.patient_no}</td>
                            <td className="px-5 py-4 font-semibold text-gray-800">{p.full_name}</td>
                            <td className="px-5 py-4 text-gray-500">{p.ward}</td>
                            <td className="px-5 py-4 text-gray-500">{p.admit_date}</td>
                            <td className="px-5 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${step.style}`}>{step.label}</span>
                            </td>
                            <td className="px-5 py-4">
                              {prog ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(prog.cleared / prog.total) * 100}%` }} />
                                  </div>
                                  <span className="text-xs text-gray-400">{prog.cleared}/{prog.total}</span>
                                </div>
                              ) : <span className="text-xs text-gray-300"></span>}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                {p.clearance_step === 'awaiting_billing' && (
                                  <button onClick={() => openClearanceForm(p)} disabled={actionId === p.id}
                                    className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                    For Clearance
                                  </button>
                                )}
                                {p.clearance_step === 'cost_center_clearing' && prog?.cleared === prog?.total && prog?.total > 0 && (
                                  <button onClick={() => { setDischargeModal(p); setDischargeRemarks(""); setDischargeName(""); }}
                                    className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                    Discharge
                                  </button>
                                )}
                                {p.request_id && (
                                  <button onClick={() => setReport(p)}
                                    className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                                    Report
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

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
          </>
        )}
        </main>
      </div>

      {/* Discharge Modal */}
      {dischargeModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Discharge Patient</h3>
            <p className="text-sm text-gray-500 mb-5">
              Confirm discharge for <span className="font-semibold text-gray-800">{dischargeModal.full_name}</span> ({dischargeModal.patient_no})
            </p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Your Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Enter your full name" value={dischargeName}
                  onChange={e => setDischargeName(e.target.value.replace(/[0-9]/g, ""))}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Final Remarks <span className="text-red-500">*</span></label>
                <textarea placeholder="Enter final remarks" value={dischargeRemarks}
                  onChange={e => setDischargeRemarks(e.target.value)}
                  rows={2} className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={discharge} disabled={actionId === dischargeModal.id}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {actionId === dischargeModal.id ? "Discharging..." : "Confirm Discharge"}
              </button>
              <button onClick={() => { setDischargeModal(null); setDischargeRemarks(""); setDischargeName(""); }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discharge Success Modal */}
      {dischargeSuccess && (
        <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Patient Discharged</h3>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-semibold text-gray-800">{dischargeSuccess.full_name}</span>
            </p>
            <p className="text-xs text-gray-400 mb-6">{dischargeSuccess.patient_no} has been successfully discharged.</p>
            <button onClick={() => setDischargeSuccess(null)}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm rounded-lg transition-colors">
              Done
            </button>
          </div>
        </div>
      )}
      {reportPatient && <ClearanceReport patientId={reportPatient.id} onClose={() => setReport(null)} />}

      {clearanceForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Send for Clearance</h3>
            <p className="text-sm text-gray-500 mb-4">Select the cost centers this patient needs to clear:</p>
            <div className="flex flex-col gap-1.5 mb-4 max-h-72 overflow-y-auto">
              {ALL_COST_CENTERS.map(cc => (
                <label key={cc} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input type="checkbox"
                    checked={clearanceForm.selected.includes(cc)}
                    onChange={e => setClearanceForm(f => ({
                      ...f,
                      selected: e.target.checked ? [...f.selected, cc] : f.selected.filter(s => s !== cc)
                    }))}
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <span className="text-sm text-gray-700">{cc}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setClearanceForm(f => ({ ...f, selected: [...ALL_COST_CENTERS] }))}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Select All</button>
              <button onClick={() => setClearanceForm(f => ({ ...f, selected: [] }))}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium">Clear All</button>
            </div>
            <div className="flex gap-2">
              <button onClick={sendForClearance} disabled={actionId === clearanceForm.patientId || clearanceForm.selected.length === 0}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {actionId === clearanceForm.patientId ? 'Sendingâ€¦' : `Send to ${clearanceForm.selected.length} dept${clearanceForm.selected.length !== 1 ? 's' : ''}`}
              </button>
              <button onClick={() => setClearanceForm(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





