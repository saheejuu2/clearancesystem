import { useState, useEffect } from 'react';
import api from '../services/api';
import PhClock from '../components/PhClock';
import SearchBar from '../components/SearchBar';
import DateFilter from '../components/DateFilter';
import StaffManager from '../components/StaffManager';
import PatientInfoModal from '../components/PatientInfoModal';
import ClearanceReport from '../components/ClearanceReport';
import NotificationBell from '../components/NotificationBell';
import PendingPatientToast from '../components/PendingPatientToast';
import useWebSocketPatients from '../hooks/useWebSocketPatients';
import usePatientInfo from '../hooks/usePatientInfo';
import CostCenterChatBox from '../components/CostCenterChatBox';
import AlertModal from '../components/AlertModal';

export default function CostCenterDashboard({ user, onLogout }) {
  const [tab, setTab]           = useState(() => sessionStorage.getItem('cc_tab') || 'patients');
  const setTabPersist = (t) => { sessionStorage.setItem('cc_tab', t); setTab(t); };
  const [auditKey, setAuditKey] = useState(0);
  const [patients, setPatients] = useState([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [actionId, setActionId] = useState(null);
  const [clearModal, setClearModal] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);
  const showAlert = (msg) => setAlertMsg(msg);
  const [clearName, setClearName]       = useState('');
  const [clearRemarks, setClearRemarks] = useState('');
  const [clearPrice, setClearPrice]     = useState('');
  const [clearPassword, setClearPassword] = useState('');
  const [clearPriceError, setClearPriceError] = useState('');
  const [showClearPass, setShowClearPass] = useState(false);

  // MAB Professional Fees - array-based so multiple doctors per specialty
  const MAB_FEE_ROWS = ['OB-GYN', 'Surgery', 'Anesth', 'Pedia', 'Medicine', 'CP Clearance', 'Asst'];
  const emptyProfFees = () => MAB_FEE_ROWS.map(r => ({ specialty: r, md: '', amount: '', paid: false }));
  const [mabModal, setMabModal] = useState(null);
  const [mabFees, setMabFees]   = useState(emptyProfFees());
  const [mabName, setMabName]     = useState('');
  const [mabPass, setMabPass]     = useState('');
  const [mabPassErr, setMabPassErr] = useState('');
  const [showMabPass, setShowMabPass] = useState(false);
  const [mabCancelConfirm, setMabCancelConfirm] = useState(false);
  const [mabDrafts, setMabDrafts] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('mab_drafts') || '{}'); }
    catch { return {}; }
  });
  const { viewPatient, viewClearances, openPatientInfo, closePatientInfo } = usePatientInfo();
  const [notifReport, setNotifReport] = useState(null);
  const [clearedPatients, setClearedPatients] = useState([]);
  const [clearedLoading, setClearedLoading]   = useState(false);
  const [clearedSearch, setClearedSearch]     = useState('');
  const [pendingPatients, setPendingPatients] = useState([]);
  const [pendingLoading, setPendingLoading]   = useState(false);

  const [remarksModal, setRemarksModal] = useState(null);
  const [toastEnabled, setToastEnabled] = useState(true);
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [typeFilter, setTypeFilter] = useState('');
  const [soaAmount, setSoaAmount] = useState(null);
  const [soaLoading, setSoaLoading] = useState(false);
  const [soaCache, setSoaCache] = useState({});       // { [patient_no]: amount }
  const [soaBreakdowns, setSoaBreakdowns] = useState({}); // { [patient_no]: [{desc, amount}] }
  const [soaBreakdown, setSoaBreakdown] = useState([]);   // current modal breakdown

  const fetchPatients = async (date) => {
    setLoading(true);
    const d = date || filterDate;
    if (d !== 'all') {
      try { await api.get(`/sync_ihis_patients.php?date=${d}`); } catch { /* silent */ }
    }
    try {
      const dateParam = d === 'all' ? 'all_dates=1' : `date=${d}`;
      const res = await api.get(`/get_patients.php?role=${encodeURIComponent(user.costCenter)}&${dateParam}`);
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
    fetchPendingBalance();
    api.get(`/notification_settings.php?cost_center=${encodeURIComponent(user.costCenter)}`)
      .then(res => setToastEnabled(res.data.toast_enabled !== false))
      .catch(() => {});
    api.get(`/get_patients.php?role=${encodeURIComponent(user.costCenter)}&pending_only=1`)
      .then(res => setPendingPatients(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  useWebSocketPatients(user.costCenter, filterDate, (updatedPatients) => {
    setPatients(updatedPatients || []);
  }, true, [user.costCenter, filterDate]);

  // Batch fetch SOA amounts whenever patient list updates
  useEffect(() => {
    if (!patients.length) return;
    const nos = patients.map(p => p.patient_no).filter(Boolean);
    api.post('/get_soa_batch.php', { patient_nos: nos, cost_center: user.costCenter })
      .then(res => {
        if (res.data.success) {
          setSoaCache(res.data.amounts || {});
          setSoaBreakdowns(res.data.breakdowns || {});
        }
      })
      .catch(() => {});
  }, [patients]);

  useEffect(() => {
    if (!patients.length) return;
    Promise.all(patients.map(p => fetchCcStatus(p.id).then(status => ({ id: p.id, status }))))
      .then(results => {
        const next = {};
        results.forEach(({ id, status }) => { if (status) next[id] = status; });
        setCcStatuses(prev => ({ ...prev, ...next }));
      });
  }, [patients]);
  const SOA_PRICE = soaAmount;
  const priceMatches = clearPrice !== '' && soaAmount !== null && parseFloat(clearPrice) === soaAmount;
  const priceEntered = clearPrice.trim() !== '';

  const openClearModal = (p) => {
    if (user.costCenter === 'MAB') {
      setMabModal(p);
      const draft = mabDrafts[p.id];
      setMabFees(draft ? draft : emptyProfFees());
      setMabName(''); setMabPass(''); setMabPassErr(''); setShowMabPass(false); setMabCancelConfirm(false);
      return;
    }
    setClearModal(p);
    setClearName(''); setClearRemarks(''); setClearPrice('');
    setClearPassword(''); setClearPriceError(''); setShowClearPass(false);
    setSoaBreakdown([]);
    if (soaCache[p.patient_no] !== undefined) {
      setSoaAmount(soaCache[p.patient_no]);
      setSoaBreakdown(soaBreakdowns[p.patient_no] || []);
      setSoaLoading(false);
    } else {
      setSoaAmount(null);
      setSoaLoading(true);
      api.get(`/get_soa_amount.php?patient_no=${encodeURIComponent(p.patient_no)}&cost_center=${encodeURIComponent(user.costCenter)}`)
        .then(res => {
          if (res.data.success) {
            setSoaAmount(res.data.amount ?? null);
            setSoaBreakdown(res.data.breakdown || []);
          }
        })
        .catch(() => setSoaAmount(null))
        .finally(() => setSoaLoading(false));
    }
  };

  const clearPatient = async () => {
    setClearPriceError('');
    if (!clearName.trim()) { showAlert('Please enter your name before confirming.'); return; }
    if (!clearPrice.trim()) { showAlert('Please enter the SOA amount.'); return; }
    if (!clearPassword.trim()) { showAlert('Please enter your password to confirm.'); return; }

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
          soa_amount: soaAmount ?? 0,
        });
        if (res.data.success) {
          fetchPatients();
          fetchPendingBalance();
          setAuditKey(k => k + 1);
          resetModal();
        } else { showAlert(res.data.message); }
      } else {
        // Normal clear
        const res = await api.post('/update_clearance.php', {
          action: 'cost_center_clear',
          patient_id,
          cost_center: user.costCenter,
          actor: clearName.trim(),
          remarks: clearRemarks,
          soa_amount: soaAmount ?? 0,
        });
        if (res.data.success) {
          setPatients(prev => prev.filter(p => p.id !== patient_id));
          fetchPatients();
          fetchPendingPatients();
          setCcStatuses(prev => ({ ...prev, [patient_id]: { status: 'cleared' } }));
          setAuditKey(k => k + 1);
          resetModal();
        } else { showAlert(res.data.message); }
      }
    } finally { setActionId(null); }
  };

  const filtered = patients.filter(p =>
    (!typeFilter || p.patient_type === typeFilter) &&
    (p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.patient_no.toLowerCase().includes(search.toLowerCase()))
  );

  const submitMabClear = async () => {
    setMabPassErr('');
    if (!mabName.trim()) { showAlert('Please enter your Employee ID.'); return; }
    if (!mabPass.trim()) { showAlert('Please enter your password.'); return; }
    try {
      const verify = await api.post('/login.php', { username: user.username, password: mabPass, cost_center: user.costCenter });
      if (!verify.data.success) { setMabPassErr('Incorrect password.'); return; }
    } catch { setMabPassErr('Could not verify password.'); return; }

    const totalAmount = mabFees.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    const remarksLines = mabFees
      .filter(r => r.md || r.amount)
      .map(r => `${r.specialty}: ${r.md || '-'} ?${r.amount || '0'} [${r.paid ? 'Paid' : 'Unpaid'}]`)
      .join(' | ');

    setActionId(mabModal.id);
    try {
      const res = await api.post('/update_clearance.php', {
        action:     'cost_center_clear',
        patient_id: mabModal.id,
        cost_center: 'MAB',
        actor:      mabName.trim(),
        remarks:    remarksLines,
        soa_amount: totalAmount,
      });
      if (res.data.success) {
        setPatients(prev => prev.filter(p => p.id !== mabModal.id));
        fetchPatients();
        setMabModal(null);
        setAuditKey(k => k + 1);
      } else { showAlert(res.data.message); }
    } finally { setActionId(null); }
  };

  const mabHasData = () => mabFees.some(r => (r.md || '').trim() !== '' || (r.amount || '') !== '');

  const saveMabDraft = () => {
    const drafts = { ...mabDrafts, [mabModal.id]: mabFees };
    setMabDrafts(drafts);
    sessionStorage.setItem('mab_drafts', JSON.stringify(drafts));
    setMabModal(null);
    setMabCancelConfirm(false);
  };

  const discardMab = () => {
    const drafts = { ...mabDrafts };
    delete drafts[mabModal.id];
    setMabDrafts(drafts);
    sessionStorage.setItem('mab_drafts', JSON.stringify(drafts));
    setMabModal(null);
    setMabCancelConfirm(false);
  };

  const handleMabCancel = () => {
    try {
      if (mabHasData()) { setMabCancelConfirm(true); }
      else { discardMab(); }
    } catch { discardMab(); }
  };

  const clearedFiltered = clearedPatients.filter(p =>
    p.full_name.toLowerCase().includes(clearedSearch.toLowerCase()) ||
    p.patient_no.toLowerCase().includes(clearedSearch.toLowerCase())
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
            <button onClick={() => setTabPersist('patients')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left w-full ${tab === 'patients' ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="flex-1">Patients</span>
            </button>
            <button onClick={() => { setTabPersist('cleared'); fetchClearedPatients(); setClearedSearch(''); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left w-full ${tab === 'cleared' ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Cleared Patients
            </button>
            <button onClick={() => { setTabPersist('pending'); fetchPendingPatients(); }}              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left w-full ${tab === 'pending' ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
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
            <button onClick={() => { setTabPersist('pending_balance'); fetchPendingBalance(); }}
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
                      {['Hospital No.','Name of Patient','Age','Ward','Admit Date','Reason from Billing','Action'].map(h => (
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
                        <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap max-w-[200px]">{p.full_name}</td>
                        <td className="px-4 py-3.5 text-gray-500 text-center">{p.age}</td>
                        <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">{p.ward_name || (p.ward && p.ward.length <= 20 ? p.ward : '-')}</td>
                        <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                          {p.admit_date ? new Date(p.admit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-orange-600 text-xs font-medium max-w-[200px] truncate" title={p.cc_remarks}>
                          {p.cc_remarks || <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <button onClick={() => openClearModal(p)}
                            className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                            {user.costCenter === 'MAB' ? 'Professional Fee' : 'Clear'}
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
              <p className="text-sm text-gray-400 mt-0.5">Patients with SOA amount mismatch - review before clearing</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {['Hospital No.','Name of Patient','Age','Ward','Admit Date','Flagged By','Remarks','Action'].map(h => (                        <th key={h} className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
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
                        <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap max-w-[200px]">{p.full_name}</td>
                        <td className="px-4 py-3.5 text-gray-500 text-center">{p.age}</td>
                        <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">{p.ward_name || (p.ward && p.ward.length <= 20 ? p.ward : '-')}</td>
                        <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                          {p.admit_date ? new Date(p.admit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-gray-700 font-medium whitespace-nowrap">{p.flagged_by || '-'}</td>
                        <td className="px-4 py-3.5">
                          {p.balance_remarks
                            ? <button onClick={() => setRemarksModal({ patient: p, remarks: p.balance_remarks })}
                                className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                                View
                              </button>
                            : <span className="text-xs text-gray-300">-</span>
                          }
                        </td>
                        <td className="px-4 py-3.5">
                          <button onClick={() => openClearModal(p)}
                            className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                            {user.costCenter === 'MAB' ? 'Professional Fee' : 'Clear'}
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
                Patients your department has already cleared - this is <span className="font-semibold text-gray-600">not</span> the audit trail.
                The <span className="font-semibold text-gray-600">Audit Trail</span> logs every action taken by every user across the system,
                while this list shows only patients cleared specifically by <span className="font-semibold text-gray-600">{user.costCenter}</span>.
              </p>
            </div>
            <SearchBar value={clearedSearch} onChange={setClearedSearch} placeholder="Search by name or hospital no." />
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {['Hospital No.','Name of Patient','Age','Ward','Admit Date','Cleared By','Cleared At','Remarks',''].map(h => (
                        <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {clearedLoading ? (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-300 text-sm">Loading...</td></tr>
                    ) : clearedFiltered.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-300 text-sm">No cleared patients yet.</td></tr>
                    ) : clearedFiltered.map(p => (
                          <tr key={p.patient_id + p.cleared_at} className="hover:bg-gray-50/70 transition-colors">
                            <td className="px-5 py-4 font-mono text-xs text-gray-400 whitespace-nowrap">{p.patient_no}</td>
                            <td className="px-5 py-4 font-semibold text-gray-800 whitespace-nowrap">{p.full_name}</td>
                            <td className="px-5 py-4 text-gray-500">{p.age}</td>
                            <td className="px-5 py-4 text-gray-500 whitespace-nowrap">{p.ward_name || (p.ward && p.ward.length <= 20 ? p.ward : '-')}</td>
                            <td className="px-5 py-4 text-gray-500 whitespace-nowrap text-xs">
                              {p.admit_date ? new Date(p.admit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                            </td>
                            <td className="px-5 py-4 text-gray-700 font-medium">{p.cleared_by || '-'}</td>
                            <td className="px-5 py-4 text-gray-500 text-xs whitespace-nowrap">
                              {p.cleared_at
                                ? new Date(p.cleared_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
                                : '-'}
                            </td>
                            <td className="px-5 py-4 text-gray-400 text-xs max-w-[180px] truncate">{p.remarks || '-'}</td>
                            <td className="px-5 py-4">
                              <button
                                onClick={() => openPatientInfo({ id: p.patient_id, ...p })}
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
            </div>
          </div>
        )}
        {tab === 'patients' && (
        <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{user.costCenter} - Clearance</h1>
          <p className="text-sm text-gray-400 mt-0.5">Review and clear patients assigned to your department</p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="flex-1"><SearchBar value={search} onChange={setSearch} placeholder="Search by name or hospital no." /></div>
          {filterDate !== 'all' && (
                  <DateFilter value={filterDate} onChange={d => { setFilterDate(d); fetchPatients(d); }} />
                )}
                <button
                  onClick={() => {
                    const next = filterDate === 'all' ? new Date().toISOString().split('T')[0] : 'all';
                    setFilterDate(next);
                    fetchPatients(next);
                  }}
                  className={`text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap ${filterDate === 'all' ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  All Dates
                </button>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white shrink-0">
            <option value="">All Types</option>
            <option value="in-patient">In-Patient</option>
            <option value="er">ER</option>
            <option value="opd">OPD</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  {['Hospital No.','Name of Patient','Service','Accomodation','Admit Date','Type','Status','Actions'].map(h => (
                    <th key={h} className={`px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap${(h === 'Service' || h === 'Accomodation') && typeFilter === 'er' ? ' hidden' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-300 text-sm">Loading</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-300 text-sm">No patients pending clearance.</td></tr>
                ) : filtered.map(p => {
                  const myStatus = ccStatuses[p.id];
                  const isCleared = myStatus?.status === 'cleared';
                  const isPendingBalance = myStatus?.status === 'pending_balance';
                  const isSentBack = !isCleared && !isPendingBalance && myStatus?.remarks;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/70 transition-colors cursor-pointer" onClick={() => openPatientInfo(p)}>
                      <td className="px-4 py-3.5 font-mono text-xs text-gray-400 whitespace-nowrap">{p.patient_no}</td>
                      <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap max-w-[200px]">{p.full_name}</td>
                      {typeFilter !== 'er' && <td className="px-4 py-3.5 text-gray-500 text-center whitespace-nowrap">{p.service_type || '-'}</td>}
                      {typeFilter !== 'er' && <td className="px-4 py-3.5 text-gray-500 text-center whitespace-nowrap">{p.accom_type || '-'}</td>}
                      <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                        {p.admit_date ? new Date(p.admit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${p.patient_type === 'er' ? 'bg-red-100 text-red-600' : p.patient_type === 'opd' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {p.patient_type === 'er' ? 'ER' : p.patient_type === 'opd' ? 'OPD' : 'In-Patient'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {isCleared ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 whitespace-nowrap">Cleared</span>
                        ) : isPendingBalance ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600 whitespace-nowrap">Pending Balance</span>
                            {myStatus?.remarks && (
                              <button onClick={e => { e.stopPropagation(); setRemarksModal({ patient: p, remarks: myStatus.remarks }); }}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap">
                                View Remarks
                              </button>
                            )}
                          </div>
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
                            <button onClick={e => { e.stopPropagation(); openClearModal(p); }}
                              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                              {user.costCenter === 'MAB' ? 'Professional Fee' : 'Clear'}
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
      {notifReport && <ClearanceReport patientId={notifReport.id} onClose={() => setNotifReport(null)} userRole="cost_center" userCostCenter={user.costCenter} onAction={(action, patient) => { setNotifReport(null); if (action === "clear") { setClearModal(patient); } }} />}

      <PendingPatientToast patients={patients.filter(p => {
        // Only show patients that are actually in cost_center_clearing state and not yet cleared by this CC
        return p.clearance_step === 'cost_center_clearing' && (!ccStatuses[p.id] || ccStatuses[p.id].status !== 'cleared');
      })} enabled={toastEnabled} onPatientClick={(patient) => {
        openClearModal({ ...patient, id: patient.id || patient.patient_id });
      }} />

      {/* MAB Professional Fees Modal */}
      {mabModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 max-h-[92vh] overflow-y-auto">
            <h3 className="text-base font-bold text-gray-900 mb-0.5">Professional Fees
              {mabModal && mabDrafts[mabModal.id] && (
                <span className="ml-2 text-[10px] font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full align-middle">Draft restored</span>
              )}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {mabModal.full_name} - <span className="font-mono text-xs">{mabModal.patient_no}</span>
            </p>
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-5">
              <div className="grid grid-cols-[130px_1fr_130px_90px_52px_44px] bg-gray-50 border-b border-gray-200">
                <div className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Specialty</div>
                <div className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Name of M.D.</div>
                <div className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Amount</div>
                <div className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Status</div>
                <div className="px-2 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide text-center">Paid</div>
                <div className="px-2 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide text-center">+</div>
              </div>
              {mabFees.map((row, idx) => (
                <div key={idx} className={`grid grid-cols-[130px_1fr_130px_90px_52px_44px] border-b border-gray-100 last:border-0 ${row.paid ? 'bg-emerald-50/40' : ''}`}>
                  <div className="px-4 py-3 text-sm font-semibold text-gray-700 flex items-center">
                    {idx === 0 || mabFees[idx - 1].specialty !== row.specialty
                      ? row.specialty
                      : <span className="text-gray-300 text-xs pl-1">?</span>
                    }
                  </div>
                  <div className="px-2 py-2 border-l border-gray-100">
                    <input type="text" placeholder="Name of M.D."
                      value={row.md}
                      onChange={e => setMabFees(f => f.map((r, i) => i === idx ? { ...r, md: e.target.value } : r))}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  </div>
                  <div className="px-2 py-2 border-l border-gray-100">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">?</span>
                      <input type="number" placeholder="0.00"
                        value={row.amount}
                        onChange={e => setMabFees(f => f.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r))}
                        className="w-full pl-6 pr-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    </div>
                  </div>
                  <div className="px-3 py-3 border-l border-gray-100 flex items-center">
                    {row.paid
                      ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full whitespace-nowrap">Paid</span>
                      : <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full whitespace-nowrap">Unpaid</span>
                    }
                  </div>
                  <div className="border-l border-gray-100 flex items-center justify-center">
                    <input type="checkbox" checked={row.paid}
                      onChange={e => setMabFees(f => f.map((r, i) => i === idx ? { ...r, paid: e.target.checked } : r))}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer" />
                  </div>
                  <div className="border-l border-gray-100 flex items-center justify-center gap-1 px-1">
                    <button type="button"
                      onClick={() => setMabFees(f => [
                        ...f.slice(0, idx + 1),
                        { specialty: row.specialty, md: '', amount: '', paid: false },
                        ...f.slice(idx + 1),
                      ])}
                      className="w-6 h-6 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold text-sm flex items-center justify-center transition-colors"
                      title="Add another doctor">+</button>
                    {mabFees.filter(r => r.specialty === row.specialty).length > 1 && (
                      <button type="button"
                        onClick={() => setMabFees(f => f.filter((_, i) => i !== idx))}
                        className="w-6 h-6 rounded-md bg-red-50 hover:bg-red-100 text-red-400 font-bold text-sm flex items-center justify-center transition-colors"
                        title="Remove row">-</button>
                    )}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-[130px_1fr_130px_90px_52px_44px] bg-emerald-50 border-t border-emerald-100">
                <div className="px-4 py-3 text-sm font-bold text-emerald-800 col-span-2">Total</div>
                <div className="px-4 py-3 text-sm font-bold text-emerald-800 border-l border-emerald-100">
                  ?{mabFees.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
                <div className="col-span-3" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Employee ID <span className="text-red-500">*</span></label>
                <input type="text" placeholder="4-digit ID" value={mabName}
                  onChange={e => setMabName(e.target.value.replace(/[^0-9]/g, '').substring(0, 4))}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input type={showMabPass ? 'text' : 'password'} placeholder="Your password"
                    value={mabPass} onChange={e => { setMabPass(e.target.value); setMabPassErr(''); }}
                    className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  <button type="button" onClick={() => setShowMabPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </div>
                {mabPassErr && <p className="text-xs text-red-500">{mabPassErr}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={submitMabClear} disabled={actionId === mabModal.id}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {actionId === mabModal.id ? 'Processing...' : 'Confirm & Clear'}
              </button>
              <button onClick={handleMabCancel}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAB Cancel Confirmation */}
      {mabCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Unsaved Data</h3>
            <p className="text-sm text-gray-500 mb-6">You have entered professional fee data. What would you like to do?</p>
            <div className="flex flex-col gap-2">
              <button onClick={saveMabDraft}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm rounded-xl transition-colors">
                Save as Draft
              </button>
              <button onClick={discardMab}
                className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-sm rounded-xl transition-colors">
                Discard & Close
              </button>
              <button onClick={() => setMabCancelConfirm(false)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-xl transition-colors">
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* {user.costCenter === 'MAB' ? 'Professional Fee' : 'Clear'} Modal */}
      {clearModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">{user.costCenter === 'MAB' ? 'Professional Fee' : 'Clear'}</h3>
            <p className="text-sm text-gray-500 mb-4">
              Confirm clearance for <span className="font-semibold text-gray-800">{clearModal.full_name}</span> ({clearModal.patient_no})
            </p>

            {/* SOA Price */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">SOA Amount</p>
                {soaLoading ? (
                  <p className="text-sm text-gray-400 mt-0.5">Fetching...</p>
                ) : soaAmount !== null ? (
                  <p className="text-xl font-bold text-emerald-800 mt-0.5">?{soaAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                ) : (
                  <p className="text-sm text-gray-400 mt-0.5">Not available</p>
                )}
                {soaBreakdown.length > 0 && (
                  <div className="mt-1.5 flex flex-col gap-0.5">
                    {soaBreakdown.map((b, i) => (
                      <p key={i} className="text-xs text-emerald-600">
                        {b.desc}: ?{b.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <svg className="w-8 h-8 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Employee ID <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Enter 4-digit employee ID" value={clearName}
                    onChange={e => setClearName(e.target.value.replace(/[^0-9]/g, '').substring(0, 4))}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type={showClearPass ? 'text' : 'password'} placeholder="Your password"
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

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Confirm SOA Amount <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">?</span>
                  <input type="number" placeholder="Enter amount to confirm" value={clearPrice}
                    onChange={e => { setClearPrice(e.target.value.replace(/[^0-9.]/g, '')); setClearPriceError(''); }}
                    className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                {clearPriceError && !clearPriceError.includes('password') && (
                  <p className="text-xs text-red-500">{clearPriceError}</p>
                )}
                {priceEntered && !priceMatches && !clearPriceError && (
                  <p className="text-xs text-red-500">Amount does not match SOA. Submitting will flag this patient as Pending Balance.</p>
                )}
                {priceEntered && priceMatches && (
                  <p className="text-xs text-emerald-600">? Amount matches SOA.</p>
                )}
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
      <PatientInfoModal patient={viewPatient} clearances={viewClearances} onClose={closePatientInfo} />

      {remarksModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Balance Remarks</h3>
                <p className="text-xs text-gray-400 mt-0.5">{remarksModal.patient.full_name} - {remarksModal.patient.patient_no}</p>
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
      <AlertModal message={alertMsg} onClose={() => setAlertMsg(null)} type="error" />
      <CostCenterChatBox sender={user.costCenter} />
    </div>
  );
}





