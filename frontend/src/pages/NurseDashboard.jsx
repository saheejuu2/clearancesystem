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
import useWebSocketPatients from '../hooks/useWebSocketPatients';
import usePatientInfo from '../hooks/usePatientInfo';
import ChatBox from '../components/ChatBox';
import AlertModal from '../components/AlertModal';

const STEP_LABEL = {
  no_request:           { label: 'Admitted',        style: 'bg-gray-100 text-gray-500'       },
  awaiting_nurse:       { label: 'Admitted',        style: 'bg-gray-100 text-gray-500'       },
  awaiting_coder:       { label: 'For Coding',      style: 'bg-indigo-100 text-indigo-600'   },
  awaiting_billing:     { label: 'May Go Home',     style: 'bg-blue-100 text-blue-600'       },
  cost_center_clearing: { label: 'Clearance',       style: 'bg-amber-100 text-amber-600'     },
  discharged:           { label: 'Discharged',      style: 'bg-emerald-100 text-emerald-700' },
};

export default function NurseDashboard({ user, onLogout }) {
  const [tab, setTab]           = useState(() => sessionStorage.getItem('nurse_tab') || 'patients');
  const [alertMsg, setAlertMsg] = useState(null);
  const showAlert = (msg) => setAlertMsg(msg);
  const setTabPersist = (t) => { sessionStorage.setItem('nurse_tab', t); setTab(t); };
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
  const [reclearanceForm, setReclearanceForm] = useState(null);
  const [reclearancing, setReclearancing] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cancelPassword, setCancelPassword]   = useState('');
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [showCancelPass, setShowCancelPass]   = useState(false);
  const { viewPatient, viewClearances, openPatientInfo, closePatientInfo } = usePatientInfo();
  const [notifReport, setNotifReport] = useState(null);

  const [admitSuccess, setAdmitSuccess] = useState(null);
  const [mayGoHomeSuccess, setMayGoHomeSuccess] = useState(null);
  const [trackPatient, setTrackPatient] = useState(null);
  const [trackClearances, setTrackClearances] = useState([]);
  const [trackLoading, setTrackLoading] = useState(false);

  const [wardFilter, setWardFilter] = useState(() => sessionStorage.getItem('nurse_wardFilter') || '');
  const [statusFilter, setStatusFilter] = useState(() => sessionStorage.getItem('nurse_statusFilter') || '');
  const [typeFilter, setTypeFilter] = useState(() => sessionStorage.getItem('nurse_typeFilter') ?? (user?.costCenter === 'ER Nurse' ? 'er' : 'in-patient'));
  const [filterDate, setFilterDate] = useState(() => sessionStorage.getItem('nurse_filterDate') || new Date().toISOString().split('T')[0]);

  const setWardFilterPersist   = (v) => { sessionStorage.setItem('nurse_wardFilter', v);   setWardFilter(v); };
  const setStatusFilterPersist = (v) => { sessionStorage.setItem('nurse_statusFilter', v); setStatusFilter(v); };
  const setTypeFilterPersist   = (v) => { sessionStorage.setItem('nurse_typeFilter', v);   setTypeFilter(v); };
  const setFilterDatePersist   = (v) => { sessionStorage.setItem('nurse_filterDate', v);   setFilterDate(v); };

  const fetchPatients = async (date) => {
    setLoading(true);
    const d = date || filterDate;
    if (d !== 'all') {
      try { await api.get(`/sync_ihis_patients.php?date=${d}`); } catch { /* silent */ }
      try { await api.get(`/fix_ward_enccode.php?date=${d}`); } catch { /* silent */ }
    }
    try {
      const dateParam = d === 'all' ? 'all_dates=1' : `date=${d}`;
      const [listRes, allRes] = await Promise.all([
        api.get(`/get_patients.php?role=${encodeURIComponent(user.costCenter)}&${dateParam}`),
        api.get(`/get_patients.php?role=Billing&${dateParam}`),
      ]);
      setPatients(listRes.data);
      setAllPatients(allRes.data.filter(p =>
        ['awaiting_billing', 'cost_center_clearing'].includes(p.clearance_step)
      ));
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPatients(); }, []);
  useWebSocketPatients(user.costCenter, filterDate, (updatedPatients) => {
    setPatients(updatedPatients);
    // Also fetch billing patients for the allPatients list
    api.get(`/get_patients.php?role=Billing&date=${filterDate}`)
      .then(res => setAllPatients(res.data.filter(p =>
        ['awaiting_billing', 'cost_center_clearing'].includes(p.clearance_step)
      )))
      .catch(() => {});
  }, true, [filterDate]);
  const openForm = (patient) => {
    setConfirmForm({ patientId: patient.id, full_name: patient.full_name, patient_no: patient.patient_no, nurseName: '', remarks: '', disposition: '' });
  };

  const submitMayGoHome = async () => {
    if (!confirmForm.disposition) { showAlert('Please select a disposition.'); return; }
    if (!confirmForm.nurseName.trim()) { showAlert('Please enter your username.'); return; }
    if (!confirmPassword.trim()) { showAlert('Please enter your password.'); return; }
    try {
      const verify = await api.post('/login.php', { username: confirmForm.nurseName.trim(), password: confirmPassword, cost_center: user.costCenter });
      if (!verify.data.success) { showAlert('Incorrect username or password.'); return; }
    } catch { showAlert('Could not verify credentials.'); return; }
    const { patientId, full_name, patient_no } = confirmForm;
    const actor = confirmForm.nurseName.trim();
    const remarks = [confirmForm.disposition, confirmForm.remarks.trim()].filter(Boolean).join(' � ');
    setConfirmForm(null);
    setConfirmPassword('');
    setPatients(prev => prev.map(p =>
      p.id === patientId ? { ...p, clearance_step: 'awaiting_billing' } : p
    ));
    setActionId(patientId);
    try {
      const res = await api.post('/update_clearance.php', { action: 'may_go_home', patient_id: patientId, actor, remarks });
      if (res.data.success || res.data.message === 'Already marked as may go home.') {
        setMayGoHomeSuccess({ full_name, patient_no });
        fetchPatients();
        setAuditKey(k => k + 1);
      } else { showAlert(res.data.message); fetchPatients(); }
    } finally { setActionId(null); }
  };

  const submitCancel = async () => {
    if (!cancelForm.nurseName.trim()) { showAlert('Please enter your username.'); return; }
    if (!cancelPassword.trim()) { showAlert('Please enter your password.'); return; }
    try {
      const verify = await api.post('/login.php', { username: cancelForm.nurseName.trim(), password: cancelPassword, cost_center: user.costCenter });
      if (!verify.data.success) { showAlert('Incorrect username or password.'); return; }
    } catch { showAlert('Could not verify credentials.'); return; }
    setCancelling(true);
    try {
      const res = await api.post('/update_clearance.php', {
        action:     'cancel_discharge',
        patient_id: cancelForm.patientId,
        actor:      cancelForm.nurseName.trim(),
        remarks:    cancelForm.remarks.trim() || 'Discharge cancelled by nurse',
      });
      if (res.data.success) { setCancelForm(null); setCancelPassword(''); fetchPatients(); setAuditKey(k => k + 1); }
      else showAlert(res.data.message);
    } finally { setCancelling(false); }
  };

  const submitReclearance = async () => {
    if (!reclearanceForm.nurseName.trim()) { showAlert('Please enter your employee ID.'); return; }
    if (!reclearanceForm.password.trim()) { showAlert('Please enter your password.'); return; }
    try {
      const verify = await api.post('/login.php', { username: reclearanceForm.nurseName.trim(), password: reclearanceForm.password, cost_center: user.costCenter });
      if (!verify.data.success) { showAlert('Incorrect username or password.'); return; }
    } catch { showAlert('Could not verify credentials.'); return; }
    setReclearancing(true);
    try {
      const res = await api.post('/update_clearance.php', {
        action:     'reclearance',
        patient_id: reclearanceForm.patientId,
        actor:      reclearanceForm.nurseName.trim(),
        remarks:    reclearanceForm.remarks.trim() || 'Reclearance initiated by nurse',
      });
      if (res.data.success) { setReclearanceForm(null); fetchPatients(); setAuditKey(k => k + 1); }
      else showAlert(res.data.message);
    } finally { setReclearancing(false); }
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
    const matchWard = !wardFilter || (p.service_type || '').toUpperCase().includes(wardFilter.toUpperCase());
    const matchType = !typeFilter || p.patient_type === typeFilter;
    const matchStatus = !statusFilter
      ? true
      : statusFilter === 'pending'
        ? p.has_pending && p.clearance_step === 'cost_center_clearing'
        : p.clearance_step === statusFilter;
    return matchQ && matchWard && matchType && matchStatus;
  });


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
            <button onClick={() => { setTabPersist("patients"); setStatusFilterPersist(""); setTypeFilterPersist(""); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left w-full ${tab === "patients" && !typeFilter ? "bg-emerald-700 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              All Patients
            </button>

            {user.costCenter !== 'ER Nurse' && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pt-3 pb-1">Filter by Type</p>
                {[
                  { value: 'in-patient', label: 'Admitted', dot: 'bg-blue-400',  count: patients.filter(p => p.patient_type === 'in-patient').length },
                  { value: 'er',         label: 'ER',       dot: 'bg-red-400',   count: patients.filter(p => p.patient_type === 'er').length },
                ].map(t => (
                  <button key={t.value}
                    onClick={() => { setTabPersist("patients"); setTypeFilterPersist(typeFilter === t.value ? "" : t.value); }}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left w-full ${typeFilter === t.value ? "bg-emerald-700 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${typeFilter === t.value ? "bg-white" : t.dot}`} />
                    <span className="flex-1">{t.label}</span>
                    {t.count > 0 && (
                      <span className={`ml-auto text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${typeFilter === t.value ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-600'}`}>
                        {t.count > 99 ? '99+' : t.count}
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}

            {user.costCenter === 'ER Nurse' && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pt-3 pb-1">Filter by Type</p>
                <button
                  onClick={() => { setTabPersist("patients"); setTypeFilterPersist('er'); }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left w-full ${typeFilter === 'er' ? "bg-emerald-700 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${typeFilter === 'er' ? "bg-white" : "bg-red-400"}`} />
                  <span className="flex-1">ER</span>
                  {patients.filter(p => p.patient_type === 'er').length > 0 && (
                    <span className={`ml-auto text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${typeFilter === 'er' ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {patients.filter(p => p.patient_type === 'er').length > 99 ? '99+' : patients.filter(p => p.patient_type === 'er').length}
                    </span>
                  )}
                </button>
              </>
            )}
        
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

        {tab === 'patients' && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Patient List</h1>
              <p className="text-sm text-gray-400 mt-0.5">Patients synced from IHIS � Click "May Go Home" to initiate discharge clearance</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <SearchBar value={search} onChange={setSearch} placeholder="Search by name or hospital no." />
              <div className="flex items-center gap-2 shrink-0">
                {filterDate !== 'all' && (
                  <DateFilter value={filterDate} onChange={d => { setFilterDatePersist(d); fetchPatients(d); }} />
                )}
                <button
                  onClick={() => {
                    const next = filterDate === 'all' ? new Date().toISOString().split('T')[0] : 'all';
                    setFilterDatePersist(next);
                    fetchPatients(next);
                  }}
                  className={`text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap ${filterDate === 'all' ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  All Dates
                </button>
              </div>
            </div>
            {/* Filters */}
            {user.costCenter !== 'ER Nurse' && (
            <div className="flex flex-wrap gap-3">
              <select value={wardFilter} onChange={e => setWardFilterPersist(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                <option value="">All Wards</option>
                {[
                  { label: 'OB / Gynecology', value: 'OB' },
                  { label: 'Medical',          value: 'MEDICAL' },
                  { label: 'Surgery',          value: 'SURGICAL' },
                  { label: 'Pediatrics',       value: 'PEDIATRICS' },
                ].map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilterPersist(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                <option value="">All Status</option>
                <option value="awaiting_billing">May Go Home</option>
                <option value="cost_center_clearing">Clearance</option>
                <option value="pending">Pending</option>
              </select>

              {(wardFilter || statusFilter || typeFilter) && (
                <button onClick={() => { setWardFilterPersist(''); setStatusFilterPersist(''); setTypeFilterPersist(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600 font-medium px-2">Clear filters</button>
              )}
            </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {['Hospital No.','Name of Patient ','Service','Accomodation','Admit Date','Type','Status','Actions'].map(h => (
                        <th key={h} className={`px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap${(h === 'Service' || h === 'Accomodation') && typeFilter === 'er' ? ' hidden' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={8} className="text-center py-12 text-gray-300 text-sm">Loading</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-gray-300 text-sm">No patients found.</td></tr>
                    ) : filtered.map(p => {
                      const step   = STEP_LABEL[p.clearance_step] || STEP_LABEL['no_request'];
                      const canAct = p.clearance_step === 'no_request' || p.clearance_step === 'awaiting_nurse';
                      const isPending = p.has_pending && p.clearance_step === 'cost_center_clearing';
                      return (
                        <tr key={p.id} onClick={() => openPatientInfo(p)} className="hover:bg-gray-50/70 transition-colors cursor-pointer">
                          <td className="px-4 py-3.5 font-mono text-xs text-gray-400 whitespace-nowrap">{p.patient_no}</td>
                          <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap max-w-[200px]">{p.full_name}</td>
                          {typeFilter !== 'er' && <td className="px-4 py-3.5 text-gray-500 text-center whitespace-nowrap">{p.service_type || '�'}</td>}
                          {typeFilter !== 'er' && <td className="px-4 py-3.5 text-gray-500 text-center whitespace-nowrap">{p.accom_type || '�'}</td>}
                          <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                            {p.admit_date ? new Date(p.admit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '�'}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${p.patient_type === 'er' ? 'bg-red-100 text-red-600' : p.patient_type === 'opd' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                              {p.patient_type === 'er' ? 'ER' : p.patient_type === 'opd' ? 'OPD' : 'In-Patient'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            {p.patient_type === 'er' ? null : isPending ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-600 whitespace-nowrap">Pending</span>
                            ) : (
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${step.style}`}>{step.label}</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {canAct && (
                                <button onClick={e => { e.stopPropagation(); openForm(p); }}
                                  className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                  May Go Home
                                </button>
                              )}
                              {p.clearance_step === 'cost_center_clearing' && (
                                <button onClick={e => { e.stopPropagation(); openTracker(p); }}
                                  className="text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                  Track
                                </button>
                              )}
                              {p.clearance_step === 'discharged' && (
                                <button onClick={e => { e.stopPropagation(); setReclearanceForm({ patientId: p.id, patientName: p.full_name, nurseName: '', password: '', remarks: '' }); }}
                                  className="text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                  Reclearance
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


            </div>
          </div>
        )}
      </main>
      </div>

      {notifReport && <ClearanceReport patientId={notifReport.id} onClose={() => setNotifReport(null)} userRole="Nurse" onAction={(action, patient) => { setNotifReport(null); if (action === "may_go_home") openForm(patient); else if (action === "cancel") setCancelForm({ patientId: patient.id, patientName: patient.full_name, nurseName: "", remarks: "" }); }} />}
      <PatientInfoModal patient={viewPatient} clearances={viewClearances} onClose={closePatientInfo} />

      {/* May Go Home Confirm Modal */}
      {confirmForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Confirm May Go Home</h3>
            <p className="text-sm text-gray-500 mb-5">Enter your name to confirm this patient is ready for discharge clearance.</p>
            <div className="flex flex-col gap-4">
              {/* Credentials */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Employee ID <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Enter 4-digit employee ID"
                    value={confirmForm.nurseName}
                    onChange={e => setConfirmForm(f => ({ ...f, nurseName: e.target.value.replace(/[^0-9]/g, '').substring(0, 4) }))}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type={showConfirmPass ? 'text' : 'password'} placeholder="Your password"
                      value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    <button type="button" onClick={() => setShowConfirmPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                  </div>
                </div>
              </div>
              {/* Disposition */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Disposition <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {['Discharge', 'Expired', 'HAMA', 'THOC'].map(d => (
                    <label key={d} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${confirmForm.disposition === d ? 'bg-blue-50 border-blue-400' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="disposition" value={d}
                        checked={confirmForm.disposition === d}
                        onChange={() => setConfirmForm(f => ({ ...f, disposition: d }))}
                        className="accent-blue-600 shrink-0" />
                      <span className="text-sm font-medium text-gray-700">{d === 'HAMA' ? 'HAMA (Home Against Medical Advice)' : d === 'THOC' ? 'THOC (Transferred to Home Care)' : d}</span>
                    </label>
                  ))}
                </div>
              </div>
              {/* Remarks */}
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
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input type="text" placeholder="Enter 4-digit employee ID"
                    value={cancelForm.nurseName}
                    onChange={e => setCancelForm(f => ({ ...f, nurseName: e.target.value.replace(/[^0-9]/g, '').substring(0, 4) }))}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type={showCancelPass ? 'text' : 'password'} placeholder="Your password"
                      value={cancelPassword} onChange={e => setCancelPassword(e.target.value)}
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                    <button type="button" onClick={() => setShowCancelPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                  </div>
                </div>
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
      {/* Reclearance Modal */}
      {reclearanceForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Initiate Reclearance</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will reset the clearance process for{' '}
              <span className="font-semibold text-gray-800">{reclearanceForm.patientName}</span> and send them back to billing for a new clearance cycle.
            </p>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Employee ID <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="4-digit employee ID"
                    value={reclearanceForm.nurseName}
                    onChange={e => setReclearanceForm(f => ({ ...f, nurseName: e.target.value.replace(/[^0-9]/g, '').substring(0, 4) }))}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Password <span className="text-red-500">*</span></label>
                  <input type="password" placeholder="Your password"
                    value={reclearanceForm.password}
                    onChange={e => setReclearanceForm(f => ({ ...f, password: e.target.value }))}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Reason <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
                <textarea placeholder="e.g. patient readmitted for same condition"
                  rows={2}
                  value={reclearanceForm.remarks}
                  onChange={e => setReclearanceForm(f => ({ ...f, remarks: e.target.value }))}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={submitReclearance} disabled={reclearancing}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {reclearancing ? 'Processing...' : 'Confirm Reclearance'}
              </button>
              <button onClick={() => setReclearanceForm(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal message={alertMsg} onClose={() => setAlertMsg(null)} type="error" />
      <ChatBox sender={user.costCenter} />

    </div>
  );
}









