import { useState, useEffect } from 'react';
import api from '../services/api';
import AuditTrail from '../components/AuditTrail';
import PhClock from '../components/PhClock';
import SearchBar from '../components/SearchBar';
import StaffManager from '../components/StaffManager';
import PatientInfoModal from '../components/PatientInfoModal';
import ClearanceReport from '../components/ClearanceReport';
import NotificationBell from '../components/NotificationBell';
import PendingPatientToast from '../components/PendingPatientToast';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';

export default function CostCenterDashboard({ user, onLogout }) {
  const [tab, setTab]           = useState('patients');
  const [auditKey, setAuditKey] = useState(0);
  const [patients, setPatients] = useState([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [actionId, setActionId] = useState(null);
  const [clearModal, setClearModal] = useState(null); // { patient }
  const [clearName, setClearName]       = useState('');
  const [clearRemarks, setClearRemarks] = useState('');
  const [clearPrice, setClearPrice]     = useState('');
  const [clearPassword, setClearPassword] = useState('');
  const [clearPriceError, setClearPriceError] = useState('');
  const [showClearPass, setShowClearPass] = useState(false);
  const [viewPatient, setViewPatient] = useState(null);
  const [viewClearances, setViewClearances] = useState([]);
  const [notifReport, setNotifReport] = useState(null);
  const [clearedPatients, setClearedPatients] = useState([]);
  const [clearedLoading, setClearedLoading]   = useState(false);
  const [clearedSearch, setClearedSearch]     = useState('');
  const [pendingPatients, setPendingPatients] = useState([]);
  const [pendingLoading, setPendingLoading]   = useState(false);

  const [remarksModal, setRemarksModal] = useState(null);
  const [toastEnabled, setToastEnabled] = useState(true);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/get_patients.php?role=${encodeURIComponent(user.costCenter)}`);
      setPatients(res.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const [pendingBalancePatients, setPendingBalancePatients] = useState([]);
  const [pendingBalanceLoading, setPendingBalanceLoading]   = useState(false);

  const fetchPendingBalance = async () => {
    setPendingBalanceLoading(true);
    try {
      const res = await api.get(`/pending_balance.php?cost_center=${encodeURIComponent(user.costCenter)}`);
      setPendingBalancePatients(Array.isArray(res.data) ? res.data : []);
    } catch { /* silent */ }
    finally { setPendingBalanceLoading(false); }
  };

  const fetchPendingPatients = async () => {
    setPendingLoading(true);
    try {
      const res = await api.get(`/get_patients.php?role=${encodeURIComponent(user.costCenter)}&pending_only=1`);
      setPendingPatients(res.data);
    } catch { /* silent */ }
    finally { setPendingLoading(false); }
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
    api.get(`/notification_settings.php?cost_center=${encodeURIComponent(user.costCenter)}`)
      .then(res => setToastEnabled(res.data.toast_enabled !== false))
      .catch(() => {});
    // Pre-fetch pending count for badge (only sent-back patients)
    api.get(`/get_patients.php?role=${encodeURIComponent(user.costCenter)}&pending_only=1`)
      .then(res => setPendingPatients(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    patients.forEach(async p => {
      const status = await fetchCcStatus(p.id);
      if (status) {
        setCcStatuses(prev => ({ ...prev, [p.id]: status }));
      }
    });
  }, [patients]);
  const SOA_PRICE = 10000;
  const priceMatches = clearPrice !== '' && parseFloat(clearPrice) === SOA_PRICE;
  const priceEntered = clearPrice.trim() !== '';

  const clearPatient = async () => {
    setClearPriceError('');
    if (!clearName.trim()) { alert('Please enter your name before confirming.'); return; }
    if (!clearPrice.trim()) { alert('Please enter the SOA amount.'); return; }
    if (!clearPassword.trim()) { alert('Please enter your password to confirm.'); return; }

    // Verify password
    try {
      const verify = await api.post('/login.php', { username: user.username, password: clearPassword, cost_center: user.costCenter });
      if (!verify.data.success) { setClearPriceError('Incorrect password.'); return; }
    } catch { setClearPriceError('Could not verify password.'); return; }

    const patient_id = clearModal.id;
    setActionId(patient_id);

    const resetModal = () => {
      setClearModal(null); setClearName(''); setClearRemarks('');
      setClearPrice(''); setClearPassword(''); setClearPriceError(''); setShowClearPass(false);
    };

    try {
      if (!priceMatches) {
        // Flag as pending balance
        const res = await api.post('/pending_balance.php', {
          patient_id,
          cost_center: user.costCenter,
          actor: clearName.trim(),
          entered_amount: clearPrice,
          soa_amount: SOA_PRICE,
        });
        if (res.data.success) {
          fetchPatients();
          fetchPendingBalance();
          setAuditKey(k => k + 1);
          resetModal();
        } else { alert(res.data.message); }
      } else {
        // Normal clear
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
          fetchPendingPatients();
          setCcStatuses(prev => ({ ...prev, [patient_id]: { status: 'cleared' } }));
          setAuditKey(k => k + 1);
          resetModal();
        } else { alert(res.data.message); }
      }
    } finally { setActionId(null); }
  };

  const filtered = patients.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.patient_no.toLowerCase().includes(search.toLowerCase())
  );
  const { paged: pagedCC, page: ccPage, setPage: setCcPage, totalPages: ccTotalPages, total: ccTotal, start: ccStart, pageSize: ccPageSize } = usePagination(filtered);

  const clearedFiltered = clearedPatients.filter(p =>
    p.full_name.toLowerCase().includes(clearedSearch.toLowerCase()) ||
    p.patient_no.toLowerCase().includes(clearedSearch.toLowerCase())
  );
  const { paged: pagedCleared, page: clearedPage, setPage: setClearedPage, totalPages: clearedTotalPages, total: clearedTotal, start: clearedStart, pageSize: clearedPageSize } = usePagination(clearedFiltered);

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
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="flex-1">Patients</span>
            </button>
            <button onClick={() => { setTab('cleared'); fetchClearedPatients(); setClearedSearch(''); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left w-full ${tab === 'cleared' ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Cleared Patients
            </button>
            <button onClick={() => { setTab('pending'); fetchPendingPatients(); }}              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left w-full ${tab === 'pending' ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span className="flex-1">Missing Requirements</span>
              {pendingPatients.length > 0 && (
                <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {pendingPatients.length > 99 ? '99+' : pendingPatients.length}
                </span>
              )}
            </button>
            <button onClick={() => { setTab('pending_balance'); fetchPendingBalance(); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left w-full ${tab === 'pending_balance' ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="flex-1">Pending Balance</span>
              {pendingBalancePatients.length > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {pendingBalancePatients.length > 99 ? '99+' : pendingBalancePatients.length}
                </span>
              )}
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
              <h1 className="text-xl font-bold text-gray-800">Missing Requirements</h1>
              <p className="text-sm text-gray-400 mt-0.5">Patients sent back to <span className="font-semibold text-gray-600">{user.costCenter}</span> with missing requirements</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {['Patient ID','Name','Age','Ward','Admit Date','Reason from Billing','Action'].map(h => (
                        <th key={h} className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pendingLoading ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">Loading...</td></tr>
                    ) : pendingPatients.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">No pending patients sent back to your department.</td></tr>
                    ) : pendingPatients.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-3.5 font-mono text-xs text-gray-400 whitespace-nowrap">{p.patient_no}</td>
                        <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">{p.full_name}</td>
                        <td className="px-4 py-3.5 text-gray-500 text-center">{p.age}</td>
                        <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">{p.ward}</td>
                        <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                          {p.admit_date ? new Date(p.admit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-orange-600 text-xs font-medium max-w-[200px] truncate" title={p.cc_remarks}>
                          {p.cc_remarks || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <button onClick={() => { setClearModal(p); setClearName(''); setClearRemarks(''); setClearPrice(''); setClearPassword(''); setClearPriceError(''); setShowClearPass(false); }}
                            className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                            Clear Patient
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                {pendingPatients.length} pending patient(s)
              </div>
            </div>
          </div>
        )}
        {tab === 'pending_balance' && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Pending Balance</h1>
              <p className="text-sm text-gray-400 mt-0.5">Patients with SOA amount mismatch — review before clearing</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {['Patient ID','Name','Age','Ward','Admit Date','Flagged By','Remarks','Action'].map(h => (                        <th key={h} className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pendingBalanceLoading ? (
                      <tr><td colSpan={8} className="text-center py-12 text-gray-300 text-sm">Loading...</td></tr>
                    ) : pendingBalancePatients.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-gray-300 text-sm">No pending balance patients.</td></tr>
                    ) : pendingBalancePatients.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-3.5 font-mono text-xs text-gray-400 whitespace-nowrap">{p.patient_no}</td>
                        <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">{p.full_name}</td>
                        <td className="px-4 py-3.5 text-gray-500 text-center">{p.age}</td>
                        <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">{p.ward}</td>
                        <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                          {p.admit_date ? new Date(p.admit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-gray-700 font-medium whitespace-nowrap">{p.flagged_by || '—'}</td>
                        <td className="px-4 py-3.5">
                          {p.balance_remarks
                            ? <button onClick={() => setRemarksModal({ patient: p, remarks: p.balance_remarks })}
                                className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                                View
                              </button>
                            : <span className="text-xs text-gray-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-3.5">
                          <button onClick={() => { setClearModal(p); setClearName(''); setClearRemarks(''); setClearPrice(''); setClearPassword(''); setClearPriceError(''); setShowClearPass(false); }}
                            className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                            Review & Clear
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                {pendingBalancePatients.length} patient(s) with pending balance
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
                    ) : clearedFiltered.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-300 text-sm">No cleared patients yet.</td></tr>
                    ) : pagedCleared.map(p => (
                          <tr key={p.patient_id + p.cleared_at} className="hover:bg-gray-50/70 transition-colors">
                            <td className="px-5 py-4 font-mono text-xs text-gray-400 whitespace-nowrap">{p.patient_no}</td>
                            <td className="px-5 py-4 font-semibold text-gray-800 whitespace-nowrap">{p.full_name}</td>
                            <td className="px-5 py-4 text-gray-500">{p.age}</td>
                            <td className="px-5 py-4 text-gray-500 whitespace-nowrap">{p.ward}</td>
                            <td className="px-5 py-4 text-gray-500 whitespace-nowrap text-xs">
                              {p.admit_date ? new Date(p.admit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                            </td>
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
              <Pagination page={clearedPage} totalPages={clearedTotalPages} total={clearedTotal} start={clearedStart} pageSize={clearedPageSize} onPage={setClearedPage} />
            </div>
          </div>
        )}
        {tab === 'patients' && (
        <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{user.costCenter} — Clearance</h1>
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
                  {['Patient ID','Name','Age','Ward','Admit Date','Type','Status','Actions'].map(h => (
                    <th key={h} className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-300 text-sm">Loading</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-300 text-sm">No patients pending clearance.</td></tr>
                ) : pagedCC.map(p => {
                  const myStatus = ccStatuses[p.id];
                  const isCleared = myStatus?.status === 'cleared';
                  const isSentBack = !isCleared && myStatus?.remarks;
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
                        {isCleared ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 whitespace-nowrap">Cleared</span>
                        ) : isSentBack ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-600 w-fit whitespace-nowrap">Sent Back</span>
                            <span className="text-xs text-gray-400 max-w-[140px] truncate" title={myStatus.remarks}>{myStatus.remarks}</span>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-600 whitespace-nowrap">Pending Review</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {!isCleared && p.clearance_step === 'cost_center_clearing' && (
                            <button onClick={() => { setClearModal(p); setClearName(""); setClearRemarks(""); setClearPrice(""); setClearPassword(""); setClearPriceError(""); setShowClearPass(false); }}
                              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                              Clear
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
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={ccPage} totalPages={ccTotalPages} total={ccTotal} start={ccStart} pageSize={ccPageSize} onPage={setCcPage} />
        </div>
        </div>
        )}
      </main>
      </div>
      {notifReport && <ClearanceReport patientId={notifReport.id} onClose={() => setNotifReport(null)} userRole="cost_center" userCostCenter={user.costCenter} onAction={(action, patient) => { setNotifReport(null); if (action === "clear") { setClearModal(patient); } }} />}

      <PendingPatientToast patients={patients.filter(p => {
        const s = ccStatuses[p.id];
        return !s || s.status !== 'cleared';
      })} enabled={toastEnabled} />
      {/* Clear Patient Modal */}
      {clearModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Clear Patient</h3>
            <p className="text-sm text-gray-500 mb-4">
              Confirm clearance for <span className="font-semibold text-gray-800">{clearModal.full_name}</span> ({clearModal.patient_no})
            </p>

            {/* SOA Price */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">SOA Amount</p>
                <p className="text-xl font-bold text-emerald-800 mt-0.5">₱{SOA_PRICE.toLocaleString()}.00</p>
              </div>
              <svg className="w-8 h-8 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Your Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Enter your full name" value={clearName}
                  onChange={e => setClearName(e.target.value.replace(/[0-9]/g, ""))}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Confirm SOA Amount <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">₱</span>
                  <input type="number" placeholder="Enter amount to confirm" value={clearPrice}
                    onChange={e => { setClearPrice(e.target.value); setClearPriceError(''); }}
                    className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                {clearPriceError && !clearPriceError.includes('password') && (
                  <p className="text-xs text-red-500">{clearPriceError}</p>
                )}
                {priceEntered && !priceMatches && !clearPriceError && (
                  <p className="text-xs text-red-500">Amount does not match SOA. Submitting will flag this patient as Pending Balance.</p>
                )}
                {priceEntered && priceMatches && (
                  <p className="text-xs text-emerald-600">✓ Amount matches SOA.</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Remarks <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
                <textarea placeholder="e.g. no outstanding balance" value={clearRemarks}
                  onChange={e => setClearRemarks(e.target.value)}
                  rows={2} className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input type={showClearPass ? 'text' : 'password'} placeholder="Enter your password to confirm"
                    value={clearPassword} onChange={e => { setClearPassword(e.target.value); setClearPriceError(''); }}
                    className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  <button type="button" onClick={() => setShowClearPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showClearPass
                      ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    }
                  </button>
                </div>
                {clearPriceError && clearPriceError.includes('password') && (
                  <p className="text-xs text-red-500">{clearPriceError}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={clearPatient} disabled={actionId === clearModal.id}
                className={`flex-1 py-2.5 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors ${priceEntered && !priceMatches ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-700 hover:bg-emerald-600'}`}>
                {actionId === clearModal.id
                  ? 'Processing...'
                  : priceEntered && !priceMatches
                    ? 'Flag Pending Balance'
                    : 'Confirm Cleared'}
              </button>
              <button onClick={() => { setClearModal(null); setClearName(""); setClearRemarks(""); setClearPrice(""); setClearPassword(""); setClearPriceError(""); setShowClearPass(false); }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <PatientInfoModal patient={viewPatient} clearances={viewClearances} onClose={() => { setViewPatient(null); setViewClearances([]); }} />

      {remarksModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Balance Remarks</h3>
                <p className="text-xs text-gray-400 mt-0.5">{remarksModal.patient.full_name} · {remarksModal.patient.patient_no}</p>
              </div>
              <button onClick={() => setRemarksModal(null)} className="text-gray-300 hover:text-gray-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-sm text-red-700 leading-relaxed">{remarksModal.remarks}</p>
            </div>
            <button onClick={() => setRemarksModal(null)}
              className="w-full mt-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}









