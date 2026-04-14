import { useState, useEffect } from 'react';
import api from '../services/api';
import AuditTrail from '../components/AuditTrail';
import PhClock from '../components/PhClock';
import SearchBar from '../components/SearchBar';
import DateFilter from '../components/DateFilter';
import StaffManager from '../components/StaffManager';
import PatientInfoModal from '../components/PatientInfoModal';
import ClearanceReport from '../components/ClearanceReport';
import NotificationBell from '../components/NotificationBell';
import usePagination from '../hooks/usePagination';
import useWebSocketPatients from '../hooks/useWebSocketPatients';
import Pagination from '../components/Pagination';

const STEP_LABEL = {
  no_request:           { label: 'Admitted',     style: 'bg-gray-100 text-gray-500'       },
  awaiting_nurse:       { label: 'Admitted',     style: 'bg-gray-100 text-gray-500'       },
  awaiting_billing:     { label: 'May Go Home',  style: 'bg-blue-100 text-blue-600'       },
  cost_center_clearing: { label: 'Clearance', style: 'bg-amber-100 text-amber-600'     },
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
  const [viewPatient, setViewPatient] = useState(null);
  const [viewClearances, setViewClearances] = useState([]);
  const [notifReport, setNotifReport] = useState(null);

  // Admission form
  const [admitForm, setAdmitForm] = useState(null);
  const [admitSaving, setAdmitSaving] = useState(false);
  const [admitSuccess, setAdmitSuccess] = useState(null); // { full_name, patient_no }
  const [mayGoHomeSuccess, setMayGoHomeSuccess] = useState(null); // { full_name, patient_no }

  // Clearance progress tracker
  const [trackPatient, setTrackPatient] = useState(null);
  const [trackClearances, setTrackClearances] = useState([]);
  const [trackLoading, setTrackLoading] = useState(false);

  // Search filters
  const [wardFilter, setWardFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchPatients = async (date) => {
    setLoading(true);
    const d = date || filterDate;
    try {
      const [listRes, allRes] = await Promise.all([
        api.get(`/get_patients.php?role=Nurse&date=${d}`),
        api.get(`/get_patients.php?role=Billing&date=${d}`),
      ]);
      setPatients(listRes.data);
      setAllPatients(allRes.data.filter(p =>
        ['awaiting_billing', 'cost_center_clearing'].includes(p.clearance_step)
      ));
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPatients(); }, []);
  useWebSocketPatients('Nurse', filterDate, (updatedPatients) => {
    setPatients(updatedPatients);
    // Also fetch billing patients for the allPatients list
    api.get(`/get_patients.php?role=Billing&date=${filterDate}`)
      .then(res => setAllPatients(res.data.filter(p =>
        ['awaiting_billing', 'cost_center_clearing'].includes(p.clearance_step)
      )))
      .catch(() => {});
  }, true, [filterDate]);
  const openForm = (patient) => {
    setConfirmForm({ patientId: patient.id, full_name: patient.full_name, patient_no: patient.patient_no, nurseName: '', remarks: '' });
  };

  const submitMayGoHome = async () => {
    if (!confirmForm.nurseName.trim()) {
      alert('Please enter your name before confirming.');
      return;
    }
    const { patientId, full_name, patient_no } = confirmForm;
    const actor = confirmForm.nurseName.trim();
    const remarks = confirmForm.remarks.trim();
    // Close modal and optimistically update immediately
    setConfirmForm(null);
    setPatients(prev => prev.map(p =>
      p.id === patientId ? { ...p, clearance_step: 'awaiting_billing' } : p
    ));
    setActionId(patientId);
    try {
      const res = await api.post('/update_clearance.php', {
        action:     'may_go_home',
        patient_id: patientId,
        actor,
        remarks,
      });
      if (res.data.success || res.data.message === 'Already marked as may go home.') {
        setMayGoHomeSuccess({ full_name, patient_no });
        fetchPatients();
        setAuditKey(k => k + 1);
      } else {
        alert(res.data.message);
        fetchPatients();
      }
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

  const submitAdmit = async () => {
    if (!admitForm.patient_no || !admitForm.full_name || !admitForm.age || !admitForm.ward) {
      alert('All fields are required.');
      return;
    }
    setAdmitSaving(true);
    try {
      const res = await api.post('/add_patient.php', admitForm);
      if (res.data.success) {
        setAdmitSuccess({ full_name: admitForm.full_name, patient_no: admitForm.patient_no });
        setAdmitForm(null);
        fetchPatients();
      } else alert(res.data.message);
    } finally { setAdmitSaving(false); }
  };

  const openTracker = async (p) => {
    setTrackPatient(p);
    setTrackLoading(true);
    try {
      const r = await api.get(`/get_clearance_report.php?patient_id=${p.id}`);
      setTrackClearances(r.data.success ? r.data.clearances : []);
    } catch { setTrackClearances([]); }
    finally { setTrackLoading(false); }
  };

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || p.full_name.toLowerCase().includes(q) || p.patient_no.toLowerCase().includes(q);
    const matchWard = !wardFilter || p.ward === wardFilter;
    const matchStatus = !statusFilter
      ? true
      : statusFilter === 'pending'
        ? p.has_pending && p.clearance_step === 'cost_center_clearing'
        : p.clearance_step === statusFilter;
    const matchFrom = !dateFrom || p.admit_date >= dateFrom;
    const matchTo = !dateTo || p.admit_date <= dateTo;
    return matchQ && matchWard && matchStatus && matchFrom && matchTo;
  });
  const { paged: pagedPatients, page: nursePage, setPage: setNursePage, totalPages: nurseTotalPages, total: nurseTotal, start: nurseStart, pageSize: nursePageSize } = usePagination(filtered);

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

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 bg-white border-r border-gray-100 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Patient Management</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">Nurse Station</p>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pb-1">Patients</p>
            <button onClick={() => { setTab("patients"); setStatusFilter(""); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left w-full ${tab === "patients" && !statusFilter ? "bg-emerald-700 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              All Patients
            </button>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pt-3 pb-1">Filter by Status</p>
            {[
              { value: "no_request",          label: "Admitted",     dot: "bg-gray-400",  count: patients.filter(p => p.clearance_step === 'no_request' || p.clearance_step === 'awaiting_nurse').length },
              { value: "awaiting_billing",     label: "May Go Home",  dot: "bg-blue-500",  count: patients.filter(p => p.clearance_step === 'awaiting_billing').length },
              { value: "cost_center_clearing", label: "Clearance", dot: "bg-amber-500", count: patients.filter(p => p.clearance_step === 'cost_center_clearing').length },
            ].map(s => (
              <button key={s.value}
                onClick={() => { setTab("patients"); setStatusFilter(statusFilter === s.value ? "" : s.value); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left w-full ${statusFilter === s.value ? "bg-emerald-700 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusFilter === s.value ? "bg-white" : s.dot}`} />
                <span className="flex-1">{s.label}</span>
                {s.count > 0 && (
                  <span className={`ml-auto text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${statusFilter === s.value ? 'bg-white/30 text-white' : 'bg-orange-500 text-white'}`}>
                    {s.count > 99 ? '99+' : s.count}
                  </span>
                )}
              </button>
            ))}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pt-3 pb-1">Records</p>
            <button onClick={() => { setTab("audit"); setStatusFilter(""); fetchPatients(); setAuditKey(k => k + 1); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left w-full ${tab === "audit" ? "bg-emerald-700 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Audit Trail
            </button>
          </nav>
          <div className="p-3 border-t border-gray-100 mt-auto">
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
        {tab === 'audit' && <AuditTrail key={auditKey} role={user.costCenter} patients={allPatients} cancelForm={cancelForm} setCancelForm={setCancelForm} submitCancel={submitCancel} cancelling={cancelling} />}
        {tab === 'patients' && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Patient List</h1>
              <p className="text-sm text-gray-400 mt-0.5">Click "May Go Home" to initiate discharge clearance</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <SearchBar value={search} onChange={setSearch} placeholder="Search by name or patient ID" />
              <div className="flex items-center gap-2 shrink-0">
                <DateFilter value={filterDate} onChange={d => { setFilterDate(d); fetchPatients(d); }} />
                <button onClick={() => setAdmitForm({ patient_no: '', full_name: '', age: '', ward: '', admit_date: new Date().toISOString().split('T')[0], patient_type: 'in-patient' })}
                  className="flex items-center gap-1.5 text-sm font-semibold bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Admit Patient
                </button>
              </div>
            </div>
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select value={wardFilter} onChange={e => setWardFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                <option value="">All Wards</option>
                {['OB', 'Medical', 'Surgery', 'Pediatrics'].map(w => <option key={w}>{w}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                <option value="">Status</option>
                <option value="no_request">Admitted</option>
                <option value="awaiting_billing">May Go Home</option>
                <option value="cost_center_clearing">Clearance</option>
                <option value="pending">Pending</option>
              </select>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" placeholder="From" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" placeholder="To" />
              {(wardFilter || statusFilter || dateFrom || dateTo) && (
                <button onClick={() => { setWardFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600 font-medium px-2">Clear filters</button>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {['Patient ID','Name','Age','Ward','Admit Date','Type','Status','Actions'].map(h => (
                        <th key={h} className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={8} className="text-center py-12 text-gray-300 text-sm">Loading</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-gray-300 text-sm">No patients found.</td></tr>
                    ) : pagedPatients.map(p => {
                      const step   = STEP_LABEL[p.clearance_step] || STEP_LABEL['no_request'];
                      const canAct = p.clearance_step === 'no_request' || p.clearance_step === 'awaiting_nurse';
                      const isPending = p.has_pending && p.clearance_step === 'cost_center_clearing';
                      return (
                        <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-4 py-3.5 font-mono text-xs text-gray-400 whitespace-nowrap">{p.patient_no}</td>
                          <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">{p.full_name}</td>
                          <td className="px-4 py-3.5 text-gray-500 text-center">{p.age}</td>
                          <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">{p.ward}</td>
                          <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                            {p.admit_date ? new Date(p.admit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${p.patient_type === 'er' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}>
                              {p.patient_type === 'er' ? 'ER' : 'In-Patient'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            {isPending ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-600 whitespace-nowrap">Pending</span>
                            ) : (
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${step.style}`}>{step.label}</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {canAct && (
                                <button onClick={() => openForm(p)}
                                  className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                  May Go Home
                                </button>
                              )}
                              <button onClick={async () => {
                                setViewPatient(p);
                                try {
                                  const r = await api.get('/get_clearance_report.php?patient_id=' + p.id);
                                  if (r.data.success) setViewClearances(r.data.clearances);
                                  else setViewClearances([]);
                                } catch { setViewClearances([]); }
                              }}
                                className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                View
                              </button>
                              {p.clearance_step === 'cost_center_clearing' && (
                                <button onClick={() => openTracker(p)}
                                  className="text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                  Track
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Pagination page={nursePage} totalPages={nurseTotalPages} total={nurseTotal} start={nurseStart} pageSize={nursePageSize} onPage={setNursePage} />
            </div>
          </div>
        )}
      </main>
      </div>

      {notifReport && <ClearanceReport patientId={notifReport.id} onClose={() => setNotifReport(null)} userRole="Nurse" onAction={(action, patient) => { setNotifReport(null); if (action === "may_go_home") openForm(patient); else if (action === "cancel") setCancelForm({ patientId: patient.id, patientName: patient.full_name, nurseName: "", remarks: "" }); }} />}
      <PatientInfoModal patient={viewPatient} clearances={viewClearances} onClose={() => { setViewPatient(null); setViewClearances([]); }} />

      {/* May Go Home Confirm Modal */}
      {confirmForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Confirm May Go Home</h3>
            <p className="text-sm text-gray-500 mb-5">Enter your name to confirm this patient is ready for discharge clearance.</p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Your Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Enter your full name"
                  value={confirmForm.nurseName}
                  onChange={e => setConfirmForm(f => ({ ...f, nurseName: e.target.value.replace(/[0-9]/g, '') }))}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Remarks <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
                <textarea placeholder="e.g. patient is stable" rows={2}
                  value={confirmForm.remarks}
                  onChange={e => setConfirmForm(f => ({ ...f, remarks: e.target.value }))}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={submitMayGoHome} disabled={actionId === confirmForm.patientId}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {actionId === confirmForm.patientId ? 'Confirming...' : 'Confirm May Go Home'}
              </button>
              <button onClick={() => setConfirmForm(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admit Patient Modal */}
      {admitForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-5">Admit New Patient</h3>
            <div className="grid grid-cols-2 gap-4">
              {[['patient_no','Patient No.','text'],['full_name','Full Name','text'],['age','Age','number'],['admit_date','Admit Date','date']].map(([k,l,t]) => (
                <div key={k} className={`flex flex-col gap-1.5 ${k === 'full_name' ? 'col-span-2' : ''}`}>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{l} <span className="text-red-500">*</span></label>
                  <input type={t} value={admitForm[k]}
                    onChange={e => {
                      let val = e.target.value;
                      if (k === 'full_name') val = val.replace(/[^a-zA-Z\s.,-]/g, '');
                      if (k === 'age') val = val.replace(/[^0-9]/g, '');
                      setAdmitForm(f => ({ ...f, [k]: val }));
                    }}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
              ))}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Ward <span className="text-red-500">*</span></label>
                <select value={admitForm.ward} onChange={e => setAdmitForm(f => ({ ...f, ward: e.target.value }))}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                  <option value="">Select ward…</option>
                  {['OB', 'Medical', 'Surgery', 'Pediatrics'].map(w => <option key={w}>{w}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Patient Type <span className="text-red-500">*</span></label>
                <div className="flex gap-3">
                  {['in-patient','er'].map(t => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="patient_type" value={t} checked={admitForm.patient_type === t}
                        onChange={() => setAdmitForm(f => ({ ...f, patient_type: t }))} className="accent-emerald-600" />
                      <span className="text-sm text-gray-700">{t === 'er' ? 'ER' : 'In-Patient'}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={submitAdmit} disabled={admitSaving}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {admitSaving ? 'Admitting...' : 'Admit Patient'}
              </button>
              <button onClick={() => setAdmitForm(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admit Success Modal */}
      {admitSuccess && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Patient Admitted</h3>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-semibold text-gray-800">{admitSuccess.full_name}</span>
            </p>
            <p className="text-xs text-gray-400 mb-6">{admitSuccess.patient_no} has been successfully admitted.</p>
            <button onClick={() => setAdmitSuccess(null)}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm rounded-lg transition-colors">
              Done
            </button>
          </div>
        </div>
      )}

      {/* May Go Home Success Modal */}
      {mayGoHomeSuccess && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">May Go Home</h3>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-semibold text-gray-800">{mayGoHomeSuccess.full_name}</span>
            </p>
            <p className="text-xs text-gray-400 mb-6">{mayGoHomeSuccess.patient_no} has been sent for billing review.</p>
            <button onClick={() => setMayGoHomeSuccess(null)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg transition-colors">
              Done
            </button>
          </div>
        </div>
      )}

      {/* Clearance Progress Tracker */}
      {trackPatient && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Clearance Progress</h3>
                <p className="text-sm text-gray-500">{trackPatient.full_name} - {trackPatient.patient_no}</p>
              </div>
              <button onClick={() => setTrackPatient(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {trackLoading ? (
              <p className="text-center py-8 text-gray-300 text-sm">Loading...</p>
            ) : (
              <>
                <div className="flex flex-col gap-2 mb-4">
                  {trackClearances.map(c => (
                    <div key={c.cost_center} className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${c.status === 'cleared' ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                      <span className="text-sm text-gray-700 font-medium">{c.cost_center}</span>
                      {c.status === 'cleared' ? (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-xs font-semibold text-emerald-600">Cleared</span>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-amber-500">Pending</span>
                      )}
                    </div>
                  ))}
                </div>
                {trackClearances.length > 0 && (() => {
                  const cleared = trackClearances.filter(c => c.status === 'cleared').length;
                  const total = trackClearances.length;
                  const pending = total - cleared;
                  const estMins = pending * 15;
                  return (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Progress</span>
                        <span className="text-xs font-semibold text-gray-700">{cleared}/{total} cleared</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(cleared/total)*100}%` }} />
                      </div>
                      {pending > 0 && (
                        <p className="text-xs text-gray-400">Est. {estMins} min remaining ({pending} dept{pending !== 1 ? 's' : ''} pending)</p>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

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
                  onChange={e => setCancelForm(f => ({ ...f, nurseName: e.target.value.replace(/[0-9]/g, '') }))}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Reason <span className="text-gray-400">(optional)</span>
                </label>
                <textarea placeholder="Reason for cancellation"
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
                {cancelling ? 'Cancelling' : 'Confirm Cancellation'}
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









