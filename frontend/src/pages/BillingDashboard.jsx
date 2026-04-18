import React, { useState, useEffect } from 'react';
import api from '../services/api';
import websocketService from '../services/websocket';
import ClearanceReport from '../components/ClearanceReport';
import AuditTrail from '../components/AuditTrail';
import PhClock from '../components/PhClock';
import SearchBar from '../components/SearchBar';
import DateFilter from '../components/DateFilter';
import NotificationBell from '../components/NotificationBell';
import NavBtn from '../components/NavBtn';
import DashboardOverview from '../components/DashboardOverview';
import AwaitingBillingToast from '../components/AwaitingBillingToast';
import usePagination from '../hooks/usePagination';
import useWebSocketPatients from '../hooks/useWebSocketPatients';
import Pagination from '../components/Pagination';
import ChatBox from '../components/ChatBox';


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
  const { paged, page, setPage, totalPages, total, start, pageSize } = usePagination(filtered);

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
              ) : paged.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs text-gray-400 whitespace-nowrap">{p.patient_no}</td>
                  <td className="px-5 py-4 font-semibold text-gray-800 whitespace-nowrap">{p.full_name}</td>
                  <td className="px-5 py-4 text-gray-500 whitespace-nowrap">{p.ward}</td>
                  <td className="px-5 py-4 text-gray-500 whitespace-nowrap text-xs">
                    {p.admit_date ? new Date(p.admit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                  </td>
                  <td className="px-5 py-4 text-gray-500 text-xs">
                    {p.discharged_at ? new Date(p.discharged_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
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
        <Pagination page={page} totalPages={totalPages} total={total} start={start} pageSize={pageSize} onPage={setPage} />
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

const BASE_COST_CENTERS = [
  'Pulmonary Department (MSA)',
  'Radiology',
  'Laboratory',
  'Bloodbank',
  'Pharmacy',
  'Benefits - Window 3A',
  'Billing - Window 2',
];

const SERVICE_COST_CENTERS = {
  OB:       [...BASE_COST_CENTERS, 'Operating Room/Delivery Room'],
  Surgery:  [...BASE_COST_CENTERS, 'Operating Room/Delivery Room'],
  Medicine: [...BASE_COST_CENTERS, 'Operating Room/Delivery Room', 'Hemodialysis Unit'],
  Pedia:    [...BASE_COST_CENTERS],
};

export default function BillingDashboard({ user, onLogout }) {
  const [tab, setTab]               = useState('patients');
  const [auditKey, setAuditKey]     = useState(0);
  const [patients, setPatients]     = useState([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(false);
  const [actionId, setActionId]     = useState(null);
  const [dischargeModal, setDischargeModal] = useState(null);
  const [dischargeSuccess, setDischargeSuccess] = useState(null);
  const [reportPatient, setReport] = useState(null);
  const [dischargeRemarks, setDischargeRemarks] = useState("");
  const [dischargeName, setDischargeName] = useState("");
  const [dischargePassword, setDischargePassword] = useState("");
  const [showDischargePass, setShowDischargePass] = useState(false);
  const [pendingPassword, setPendingPassword] = useState("");
  const [showPendingPass, setShowPendingPass] = useState(false);
  const [clearanceForm, setClearanceForm] = useState(null);
  const [pendingModal, setPendingModal] = useState(null);
  const [pendingSelectedCCs, setPendingSelectedCCs] = useState([]);
  const [pendingReason, setPendingReason] = useState('');
  const [pendingActor, setPendingActor]   = useState('');
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingCCs, setPendingCCs] = useState([]);
  const [followUpModal, setFollowUpModal] = useState(null);
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [followUpSelected, setFollowUpSelected] = useState([]);
  const [followUpNotes, setFollowUpNotes] = useState({});
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [toastEnabled, setToastEnabled] = useState(true);
  const [pendingFilter, setPendingFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [pendingRemarks, setPendingRemarks] = useState({}); // { [patient_id]: [{ cost_center, remarks }] }

  const openFollowUpModal = async (p) => {
    setFollowUpModal({ patient: p, clearances: [] });
    setFollowUpSelected([]);
    setFollowUpNotes({});
    try {
      const res = await api.get(`/get_clearance_report.php?patient_id=${p.id}`);
      if (res.data.success) {
        const pending = res.data.clearances.filter(c => c.status === 'pending');
        setFollowUpModal({ patient: p, clearances: res.data.clearances });
        setFollowUpSelected(pending.map(c => c.cost_center));
      }
    } catch { /* silent */ }
  };

  const toggleFollowUp = (cc) => {
    setFollowUpSelected(prev =>
      prev.includes(cc) ? prev.filter(c => c !== cc) : [...prev, cc]
    );
  };

  const submitFollowUp = async () => {
    if (followUpSelected.length === 0) { alert('Select at least one cost center.'); return; }
    setFollowUpLoading(true);
    try {
      await Promise.all(followUpSelected.map(cc => {
        const note = followUpNotes[cc]?.trim();
        const message = `Follow-up: Please clear ${followUpModal.patient.full_name} (${followUpModal.patient.patient_no}) at your earliest convenience.${note ? ` Note: ${note}` : ''}`;
        return api.post('/notifications.php?action=send', {
          recipient: cc,
          patient_id: followUpModal.patient.id,
          patient_no: followUpModal.patient.patient_no,
          patient_name: followUpModal.patient.full_name,
          message,
        }).catch(() => {});
      }));
      setFollowUpModal(null);
      setFollowUpSelected([]);
      setFollowUpNotes({});
    } finally { setFollowUpLoading(false); }
  };

  const openPendingModal = async (p) => {
    setPendingModal(p);
    setPendingSelectedCCs([]);
    setPendingReason('');
    setPendingActor('');
    setPendingCCs([]);
    try {
      const res = await api.get(`/get_clearance_report.php?patient_id=${p.id}`);
      if (res.data.success) {
        setPendingCCs(res.data.clearances.map(c => c.cost_center));
      }
    } catch { /* silent */ }
  };

  const togglePendingCC = (cc) => {
    setPendingSelectedCCs(prev =>
      prev.includes(cc) ? prev.filter(c => c !== cc) : [...prev, cc]
    );
  };

  const fetchPatients = async (date) => {
    setLoading(true);
    const d = date || filterDate;
    try { await api.get(`/sync_ihis_patients.php?date=${d}`); } catch { /* silent */ }
    try {
      const res = await api.get(`/get_patients.php?role=Billing&date=${d}`);
      setPatients(res.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchPatients();
    // Fetch notification settings for Billing
    api.get(`/notification_settings.php?cost_center=Billing`)
      .then(res => setToastEnabled(res.data.toast_enabled !== false))
      .catch(() => setToastEnabled(true));
  }, []);
  useWebSocketPatients('Billing', filterDate, (updatedPatients) => {
    setPatients(updatedPatients || []);
  }, true, [filterDate]);

  // Fetch sent-back remarks for pending tab
  useEffect(() => {
    if (tab !== 'pending') return;
    const sentBack = patients.filter(p => p.clearance_step === 'cost_center_clearing' && p.has_pending);
    if (sentBack.length === 0) return;
    sentBack.forEach(p => {
      if (pendingRemarks[p.id]) return; // already fetched
      api.get(`/get_clearance_report.php?patient_id=${p.id}`)
        .then(res => {
          if (res.data.success) {
            const reasons = res.data.clearances
              .filter(c => c.remarks && c.remarks.trim())
              .map(c => ({ cost_center: c.cost_center, remarks: c.remarks }));
            setPendingRemarks(prev => ({ ...prev, [p.id]: reasons }));
          }
        }).catch(() => {});
    });
  }, [tab, patients]);

  const openClearanceForm = (p) => {
    setClearanceForm({ patientId: p.id, patientName: p.full_name, service: "", isBaby: false, selected: [] });
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
      else { alert(res.data.message); setClearanceForm(null); }
    } catch { alert('An error occurred. Please try again.'); }
    finally { setActionId(null); }
  };

  const discharge = async () => {
    if (!dischargeName.trim()) { alert("Please enter your username before discharging."); return; }
    if (!dischargePassword.trim()) { alert("Please enter your password before discharging."); return; }
    try {
      const verify = await api.post('/login.php', { username: dischargeName.trim(), password: dischargePassword, cost_center: user.costCenter });
      if (!verify.data.success) { alert('Incorrect username or password.'); return; }
    } catch { alert('Could not verify credentials.'); return; }
    if (!dischargeRemarks.trim()) { alert("Please enter final remarks before discharging."); return; }
    const patient_id = dischargeModal.id;
    setActionId(patient_id);
    try {
      const res = await api.post("/update_clearance.php", { action: "discharge", patient_id, actor: dischargeName.trim(), remarks: dischargeRemarks });
      if (res.data.success) { setDischargeSuccess({ full_name: dischargeModal.full_name, patient_no: dischargeModal.patient_no }); setDischargeModal(null); setDischargeRemarks(""); setDischargeName(""); setDischargePassword(""); fetchPatients(); setAuditKey(k => k + 1); }
      else alert(res.data.message);
    } finally { setActionId(null); }
  };

  const submitPending = async () => {
    if (pendingSelectedCCs.length === 0) { alert('Please select at least one cost center.'); return; }
    if (!pendingActor.trim()) { alert('Please enter your username.'); return; }
    if (!pendingPassword.trim()) { alert('Please enter your password.'); return; }
    try {
      const verify = await api.post('/login.php', { username: pendingActor.trim(), password: pendingPassword, cost_center: user.costCenter });
      if (!verify.data.success) { alert('Incorrect username or password.'); return; }
    } catch { alert('Could not verify credentials.'); return; }
    setPendingLoading(true);
    try {
      const res = await api.post('/send_back_clearance.php', {
        patient_id: pendingModal.id,
        actor: pendingActor.trim(),
        cost_centers: pendingSelectedCCs,
        reason: pendingReason.trim() || 'Missing requirements',
      });
      if (res.data.success) {
        setPendingModal(null);
        setPendingSelectedCCs([]);
        setPendingReason('');
        setPendingActor('');
        setPendingPassword('');
        setPendingCCs([]);
        fetchPatients();
        setAuditKey(k => k + 1);
      } else {
        alert(res.data.message);
      }
    } finally { setPendingLoading(false); }
  };
  const filtered = patients.filter(p =>
    p.clearance_step === 'awaiting_billing' &&
    (!typeFilter || p.patient_type === typeFilter) &&
    (p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.patient_no.toLowerCase().includes(search.toLowerCase()))
  );
  const { paged: pagedBilling, page: billingPage, setPage: setBillingPage, totalPages: billingTotalPages, total: billingTotal, start: billingStart, pageSize: billingPageSize } = usePagination(filtered);

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
            <NotificationBell recipient={user.costCenter} onNotificationClick={async n => { if (n.id) await api.post("/notifications.php?action=read", { id: n.id }).catch(() => {}); setReport({ id: n.patient_id, notifId: n.id }); }} />
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-56 shrink-0 bg-white border-r border-gray-100 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Clearance & Discharge</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">Billing</p>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pb-1">Overview</p>
            <NavBtn tabKey="dashboard" label="Dashboard" active={tab} setTab={setTab} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pt-3 pb-1">Patients</p>
            <NavBtn tabKey="patients" label="Awaiting Billing" active={tab} setTab={setTab} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            <NavBtn tabKey="clearance" label="Clearance (Processing)" active={tab} setTab={setTab} badge={patients.filter(p => p.clearance_step === 'cost_center_clearing' && !(parseInt(p.total_cc) > 0 && parseInt(p.pending_count) === 0)).length} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            <NavBtn tabKey="for_discharge" label="For Discharge" active={tab} setTab={setTab} badge={patients.filter(p => p.clearance_step === 'cost_center_clearing' && parseInt(p.pending_count) === 0 && parseInt(p.total_cc) > 0).length} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            <NavBtn tabKey="pending" label="Missing Requirements" active={tab} setTab={setTab} badge={patients.filter(p => p.has_pending && p.clearance_step === 'cost_center_clearing').length} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <NavBtn tabKey="discharged" label="Discharged" active={tab} setTab={setTab} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pt-3 pb-1">Records</p>
            <NavBtn tabKey="audit" label="Audit Trail" active={tab} setTab={() => { setTab("audit"); setAuditKey(k => k + 1); }} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
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
        <main className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
        {tab === "dashboard" && <DashboardOverview title="Billing Dashboard" subtitle="Patient clearance overview" onCardClick={key => {
          const map = { awaiting_billing: 'patients', in_clearance: 'clearance', pending: 'pending', discharged: 'discharged' };
          if (map[key]) setTab(map[key]);
        }} />}

        {tab === "discharged" && <DischargedList />}

        {tab === "audit" && <AuditTrail key={auditKey} role={user.costCenter} />}

        {tab === 'clearance' && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Clearance (Processing)</h1>
              <p className="text-sm text-gray-400 mt-0.5">Patients referred by Billing currently undergoing cost center clearance</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1"><SearchBar value={search} onChange={setSearch} placeholder="Search by name or patient ID" /></div>
              <DateFilter value={filterDate} onChange={d => { setFilterDate(d); fetchPatients(d); }} />
            </div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {['Patient ID','Name','Ward','Admit Date','Type','Progress','Action'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">Loading</td></tr>
                    ) : patients.filter(p => p.clearance_step === 'cost_center_clearing' &&
                        !(parseInt(p.total_cc) > 0 && parseInt(p.pending_count) === 0) &&
                        (p.full_name.toLowerCase().includes(search.toLowerCase()) || p.patient_no.toLowerCase().includes(search.toLowerCase()))
                      ).length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">No patients currently in clearance processing.</td></tr>
                    ) : patients.filter(p => p.clearance_step === 'cost_center_clearing' &&
                        !(parseInt(p.total_cc) > 0 && parseInt(p.pending_count) === 0) &&
                        (p.full_name.toLowerCase().includes(search.toLowerCase()) || p.patient_no.toLowerCase().includes(search.toLowerCase()))
                      ).map(p => {
                        const allCleared = parseInt(p.total_cc) > 0 && parseInt(p.pending_count) === 0;
                        const isPending = p.has_pending;
                        return (
                          <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                            <td className="px-5 py-4 font-mono text-xs text-gray-400 whitespace-nowrap">{p.patient_no}</td>
                            <td className="px-5 py-4 font-semibold text-gray-800 whitespace-nowrap">{p.full_name}</td>
                            <td className="px-5 py-4 text-gray-500 whitespace-nowrap">{p.ward}</td>
                            <td className="px-5 py-4 text-gray-500 whitespace-nowrap text-xs">
                              {p.admit_date ? new Date(p.admit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                            </td>
                            <td className="px-5 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${p.patient_type === 'er' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}>
                                {p.patient_type === 'er' ? 'ER' : 'In-Patient'}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${isPending ? 'bg-orange-400' : 'bg-emerald-500'}`}
                                    style={{ width: p.total_cc > 0 ? `${((p.total_cc - p.pending_count) / p.total_cc) * 100}%` : '0%' }} />
                                </div>
                                <span className={`text-xs font-medium whitespace-nowrap ${isPending ? 'text-orange-500' : allCleared ? 'text-emerald-600' : 'text-gray-400'}`}>
                                  {p.total_cc - p.pending_count}/{p.total_cc}
                                  {isPending && ' ⚠'}
                                  {allCleared && ' ✓'}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isPending && (
                                  <button onClick={() => openFollowUpModal(p)}
                                    className="text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                    Follow Up
                                  </button>
                                )}
                                <button onClick={() => setReport(p)}
                                  className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                  Report
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                {patients.filter(p => p.clearance_step === 'cost_center_clearing').length} patient(s) in clearance processing
              </div>
            </div>
          </div>
        )}

        {tab === 'for_discharge' && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold text-gray-800">For Discharge</h1>
              <p className="text-sm text-gray-400 mt-0.5">Patients fully cleared by all cost centers and ready for discharge</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1"><SearchBar value={search} onChange={setSearch} placeholder="Search by name or patient ID" /></div>
              <DateFilter value={filterDate} onChange={d => { setFilterDate(d); fetchPatients(d); }} />
            </div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {['Patient ID','Name','Ward','Admit Date','Type','Action'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={6} className="text-center py-12 text-gray-300 text-sm">Loading</td></tr>
                    ) : patients.filter(p =>
                        p.clearance_step === 'cost_center_clearing' &&
                        parseInt(p.pending_count) === 0 &&
                        parseInt(p.total_cc) > 0 &&
                        (p.full_name.toLowerCase().includes(search.toLowerCase()) || p.patient_no.toLowerCase().includes(search.toLowerCase()))
                      ).length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-gray-300 text-sm">No patients ready for discharge.</td></tr>
                    ) : patients.filter(p =>
                        p.clearance_step === 'cost_center_clearing' &&
                        parseInt(p.pending_count) === 0 &&
                        parseInt(p.total_cc) > 0 &&
                        (p.full_name.toLowerCase().includes(search.toLowerCase()) || p.patient_no.toLowerCase().includes(search.toLowerCase()))
                      ).map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs text-gray-400 whitespace-nowrap">{p.patient_no}</td>
                        <td className="px-5 py-4 font-semibold text-gray-800 whitespace-nowrap">{p.full_name}</td>
                        <td className="px-5 py-4 text-gray-500 whitespace-nowrap">{p.ward}</td>
                        <td className="px-5 py-4 text-gray-500 whitespace-nowrap text-xs">
                          {p.admit_date ? new Date(p.admit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${p.patient_type === 'er' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}>
                            {p.patient_type === 'er' ? 'ER' : 'In-Patient'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => { setDischargeModal(p); setDischargeRemarks(''); setDischargeName(''); }}
                              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                              Discharge
                            </button>
                            <button onClick={() => openPendingModal(p)}
                              className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                              Send Back
                            </button>
                            <button onClick={() => setReport(p)}
                              className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                              Report
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                {patients.filter(p => p.clearance_step === 'cost_center_clearing' && parseInt(p.pending_count) === 0 && parseInt(p.total_cc) > 0).length} patient(s) ready for discharge
              </div>
            </div>
          </div>
        )}

        {tab === 'pending' && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Missing Requirements</h1>
              <p className="text-sm text-gray-400 mt-0.5">Patients sent back by billing with unresolved requirements</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1"><SearchBar value={search} onChange={setSearch} placeholder="Search by name or patient ID" /></div>
              <select value={pendingFilter} onChange={e => setPendingFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white shrink-0">
                <option value="all">All Categories</option>
                <option value="mismatched">Mismatched Amount</option>
                <option value="missing">Missing Requirements</option>
              </select>
            </div>

            {(() => {
              // All sent-back patients still in clearance
              const base = patients
                .filter(p =>
                  p.clearance_step === 'cost_center_clearing' &&
                  p.has_pending &&
                  (p.full_name.toLowerCase().includes(search.toLowerCase()) ||
                   p.patient_no.toLowerCase().includes(search.toLowerCase()))
                )
                // Sort: patients still waiting (pending_count > 0) first, then by name
                .sort((a, b) => {
                  const aPending = parseInt(a.pending_count) > 0 ? 0 : 1;
                  const bPending = parseInt(b.pending_count) > 0 ? 0 : 1;
                  if (aPending !== bPending) return aPending - bPending;
                  return a.full_name.localeCompare(b.full_name);
                });

              // Category logic based on remarks content:
              // "Mismatched Amount" = remarks contain amount/mismatch keywords
              // "Missing Requirements" = all other sent-back cases
              const getCategory = (p) => {
                const remarks = (pendingRemarks[p.id] || []).map(r => r.remarks.toLowerCase()).join(' ');
                return remarks.includes('mismatch') || remarks.includes('amount')
                  ? 'mismatched'
                  : 'missing';
              };

              const shown = pendingFilter === 'all' ? base
                : base.filter(p => getCategory(p) === pendingFilter);

              return (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-left">
                          {['Patient ID','Name','Ward','Admit Date','Category','Remarks','Progress','Action'].map(h => (
                            <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {shown.length === 0 ? (
                          <tr><td colSpan={8} className="text-center py-12 text-gray-300 text-sm">No patients found.</td></tr>
                        ) : shown.map(p => {
                          const cat = getCategory(p);
                          const remarks = pendingRemarks[p.id] || [];
                          return (
                            <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                              <td className="px-5 py-4 font-mono text-xs text-gray-400 whitespace-nowrap">{p.patient_no}</td>
                              <td className="px-5 py-4 font-semibold text-gray-800 whitespace-nowrap">{p.full_name}</td>
                              <td className="px-5 py-4 text-gray-500 whitespace-nowrap">{p.ward}</td>
                              <td className="px-5 py-4 text-gray-500 whitespace-nowrap text-xs">
                                {p.admit_date ? new Date(p.admit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                              </td>
                              <td className="px-5 py-4">
                                {cat === 'mismatched' ? (
                                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-600 whitespace-nowrap">Mismatched Amount</span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600 whitespace-nowrap">Missing Requirements</span>
                                )}
                              </td>
                              <td className="px-5 py-4 max-w-[200px]">
                                {remarks.length === 0 ? (
                                  <span className="text-xs text-gray-300">—</span>
                                ) : (
                                  <div className="flex flex-col gap-1">
                                    {remarks.map((r, i) => (
                                      <div key={i} className="text-xs text-gray-600">
                                        <span className="font-semibold text-gray-400">{r.cost_center}: </span>
                                        <span className="italic">{r.remarks}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-orange-400 rounded-full transition-all"
                                      style={{ width: p.total_cc > 0 ? `${((p.total_cc - p.pending_count) / p.total_cc) * 100}%` : '0%' }} />
                                  </div>
                                  <span className="text-xs text-orange-500 font-medium whitespace-nowrap">{p.total_cc - p.pending_count}/{p.total_cc}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => openFollowUpModal(p)}
                                    className="text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                    Follow Up
                                  </button>
                                  <button onClick={() => setReport(p)}
                                    className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                    Report
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                    {shown.length} patient(s) shown
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {tab === 'patients' && (
          <>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Awaiting Billing</h1>
              <p className="text-sm text-gray-400 mt-0.5">Patients marked as May Go Home, pending billing review</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1"><SearchBar value={search} onChange={setSearch} placeholder="Search by name or patient" /></div>
              <DateFilter value={filterDate} onChange={d => { setFilterDate(d); fetchPatients(d); }} />
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white shrink-0">
                <option value="">All Types</option>
                <option value="in-patient">In-Patient</option>
                <option value="er">ER</option>
              </select>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {['Patient ID', 'Name', 'Ward', 'Admit Date', 'Type', 'Status', 'Progress', 'Action'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={8} className="text-center py-12 text-gray-300 text-sm">Loading</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-gray-300 text-sm">No patients found.</td></tr>
                    ) : pagedBilling.map(p => {
                      const step = STEP_LABEL[p.clearance_step] || STEP_LABEL['no_request'];
                      const isPending = p.has_pending && p.clearance_step === 'cost_center_clearing';
                      return (
                        <>
                          <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                            <td className="px-4 py-3.5 font-mono text-xs text-gray-400 whitespace-nowrap">{p.patient_no}</td>
                            <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">{p.full_name}</td>
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
                              {p.total_cc > 0 ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all"
                                      style={{ width: `${((p.total_cc - p.pending_count) / p.total_cc) * 100}%` }} />
                                  </div>
                                  <span className="text-xs text-gray-400 whitespace-nowrap">{p.total_cc - p.pending_count}/{p.total_cc}</span>
                                </div>
                              ) : <span className="text-xs text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {p.clearance_step === 'awaiting_billing' && (
                                  <button onClick={() => openClearanceForm(p)} disabled={actionId === p.id}
                                    className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                    For Clearance
                                  </button>
                                )}
                                {p.clearance_step === 'cost_center_clearing' && parseInt(p.pending_count) === 0 && parseInt(p.total_cc) > 0 && (
                                  <>
                                    <button onClick={() => { setDischargeModal(p); setDischargeRemarks(""); setDischargeName(""); }}
                                      className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                      Discharge
                                    </button>
                                    <button onClick={() => openPendingModal(p)}
                                      className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                      Pending
                                    </button>
                                  </>
                                )}
                                {p.request_id && (
                                  <button onClick={() => setReport(p)}
                                    className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
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
              <Pagination page={billingPage} totalPages={billingTotalPages} total={billingTotal} start={billingStart} pageSize={billingPageSize} onPage={setBillingPage} />
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
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Employee ID <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Enter 4-digit employee ID" value={dischargeName}
                    onChange={e => setDischargeName(e.target.value.replace(/[^0-9]/g, '').substring(0, 4))}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type={showDischargePass ? 'text' : 'password'} placeholder="Your password"
                      value={dischargePassword} onChange={e => setDischargePassword(e.target.value)}
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    <button type="button" onClick={() => setShowDischargePass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                  </div>
                </div>
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
      {reportPatient && <ClearanceReport patientId={reportPatient.id} onClose={() => setReport(null)} userRole="Billing" onAction={(action, patient) => { setReport(null); if (action === "for_clearance") openClearanceForm(patient); else if (action === "discharge") { setDischargeModal(patient); } }} />}

      {/* Pending Modal */}
      {pendingModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Mark as Pending</h3>
            <p className="text-sm text-gray-500 mb-4">
              Select the cost center(s) to send <span className="font-semibold text-gray-800">{pendingModal.full_name}</span> ({pendingModal.patient_no}) back to.
            </p>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Employee ID <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Enter 4-digit employee ID" value={pendingActor}
                    onChange={e => setPendingActor(e.target.value.replace(/[^0-9]/g, '').substring(0, 4))}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type={showPendingPass ? 'text' : 'password'} placeholder="Your password"
                      value={pendingPassword} onChange={e => setPendingPassword(e.target.value)}
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    <button type="button" onClick={() => setShowPendingPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Cost Centers <span className="text-red-500">*</span>
                  {pendingSelectedCCs.length > 0 && (
                    <span className="ml-2 normal-case font-normal text-orange-500">{pendingSelectedCCs.length} selected</span>
                  )}
                </label>
                {pendingCCs.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Loading cost centers...</p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {pendingCCs.map(cc => (
                      <label key={cc} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${pendingSelectedCCs.includes(cc) ? 'bg-orange-50 border border-orange-200' : 'hover:bg-gray-50'}`}>
                        <input
                          type="checkbox"
                          checked={pendingSelectedCCs.includes(cc)}
                          onChange={() => togglePendingCC(cc)}
                          className="w-4 h-4 accent-orange-500 shrink-0"
                        />
                        <span className="text-sm text-gray-700">{cc}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Reason / Missing Requirement</label>
                <textarea placeholder="Describe the missing requirement (optional)" value={pendingReason}
                  onChange={e => setPendingReason(e.target.value)}
                  rows={2} className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={submitPending} disabled={pendingLoading || pendingSelectedCCs.length === 0}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {pendingLoading ? 'Sending...' : `Send Back${pendingSelectedCCs.length > 1 ? ` (${pendingSelectedCCs.length})` : ''}`}
              </button>
              <button onClick={() => { setPendingModal(null); setPendingSelectedCCs([]); setPendingReason(''); setPendingActor(''); setPendingPassword(''); setPendingCCs([]); }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {clearanceForm && (        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Send for Clearance</h3>
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-semibold text-gray-700">{clearanceForm.patientName}</span> — select the service to auto-load cost centers.
            </p>

            {/* Service dropdown */}
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Service</label>
              <select
                value={clearanceForm.service}
                onChange={e => {
                  const svc = e.target.value;
                  const base = svc ? [...SERVICE_COST_CENTERS[svc]] : [];
                  setClearanceForm(f => ({ ...f, service: svc, isBaby: false, selected: base }));
                }}
                className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
              >
                <option value="">-- Select Service --</option>
                <option value="OB">OB</option>
                <option value="Surgery">Surgery</option>
                <option value="Medicine">Medicine</option>
                <option value="Pedia">Pedia</option>
              </select>
            </div>

            {/* Pedia baby toggle */}
            {clearanceForm.service === 'Pedia' && (
              <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-amber-100 bg-amber-50 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearanceForm.isBaby}
                  onChange={e => {
                    const baby = e.target.checked;
                    const base = [...SERVICE_COST_CENTERS.Pedia];
                    if (baby) base.push('Newborn Screening', 'Newborn Hearing Test');
                    setClearanceForm(f => ({ ...f, isBaby: baby, selected: base }));
                  }}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span className="text-sm font-medium text-amber-800">Patient is a newborn (add Newborn Screening & Hearing Test)</span>
              </label>
            )}

            {/* Auto-populated cost center list */}
            {clearanceForm.service && (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Cost Centers ({clearanceForm.selected.length})
                </p>
                <div className="flex flex-col gap-1.5 mb-4 max-h-60 overflow-y-auto">
                  {clearanceForm.selected.map(cc => (
                    <div key={cc} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                      <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-700">{cc}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex gap-2 mt-2">
              <button
                onClick={sendForClearance}
                disabled={actionId === clearanceForm.patientId || clearanceForm.selected.length === 0}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
              >
                {actionId === clearanceForm.patientId ? "Sending..." : `Send to ${clearanceForm.selected.length} dept${clearanceForm.selected.length !== 1 ? "s" : ""}`}
              </button>
              <button
                onClick={() => setClearanceForm(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Follow Up Modal */}
      {followUpModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-gray-900">Send Follow-Up Reminder</h3>
              <button onClick={() => { setFollowUpModal(null); setFollowUpSelected([]); setFollowUpNotes({}); }}
                className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Select cost centers to remind for <span className="font-semibold text-gray-800">{followUpModal.patient.full_name}</span> ({followUpModal.patient.patient_no}).
            </p>
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2 mb-4">
              {followUpModal.clearances.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">Loading...</p>
              ) : followUpModal.clearances.map(c => (
                <div key={c.cost_center} className="flex flex-col">
                  <label
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      c.status === 'cleared'
                        ? 'opacity-40 cursor-not-allowed bg-gray-50'
                        : followUpSelected.includes(c.cost_center)
                          ? 'bg-violet-50 border border-violet-200 cursor-pointer'
                          : 'hover:bg-gray-50 cursor-pointer'
                    }`}>
                    <input
                      type="checkbox"
                      disabled={c.status === 'cleared'}
                      checked={followUpSelected.includes(c.cost_center)}
                      onChange={() => toggleFollowUp(c.cost_center)}
                      className="w-4 h-4 accent-violet-600 shrink-0"
                    />
                    <span className="flex-1 text-sm text-gray-700">{c.cost_center}</span>
                    {c.status === 'cleared' ? (
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap">Cleared</span>
                    ) : (
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">Pending</span>
                    )}
                  </label>
                  {followUpSelected.includes(c.cost_center) && (
                    <input
                      type="text"
                      placeholder="Add a note (optional)"
                      value={followUpNotes[c.cost_center] || ''}
                      onChange={e => setFollowUpNotes(prev => ({ ...prev, [c.cost_center]: e.target.value }))}
                      className="mx-3 mb-1.5 px-3 py-1.5 text-xs border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={submitFollowUp} disabled={followUpLoading || followUpSelected.length === 0}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {followUpLoading ? 'Sending...' : `Send Reminder${followUpSelected.length > 1 ? ` (${followUpSelected.length})` : ''}`}
              </button>
              <button onClick={() => { setFollowUpModal(null); setFollowUpSelected([]); setFollowUpNotes({}); }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <AwaitingBillingToast patients={patients} enabled={toastEnabled} onPatientClick={(patient) => {
        // Ensure patient has id property for openClearanceForm
        const patientData = {
          ...patient,
          id: patient.id || patient.patient_id,
          full_name: patient.full_name || patient.patient_name,
        };
        openClearanceForm(patientData);
      }} />
      <ChatBox sender={user.costCenter} />
    </div>
  );
}
