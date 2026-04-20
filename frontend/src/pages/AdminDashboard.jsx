import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import websocketService from '../services/websocket';
import PhClock from '../components/PhClock';
import AuditTrail from '../components/AuditTrail';
import NotificationBell from '../components/NotificationBell';
import NavBtn from '../components/NavBtn';
import DashboardOverview from '../components/DashboardOverview';
import SearchBar from '../components/SearchBar';
import DateFilter from '../components/DateFilter';
import usePagination from '../hooks/usePagination';
import useWebSocketPatients from '../hooks/useWebSocketPatients';
import Pagination from '../components/Pagination';
import AdminChatBox from '../components/AdminChatBox';

const STEP_LABELS = {
  no_request:           { label: 'Admitted',         style: 'bg-gray-100 text-gray-500'       },
  awaiting_nurse:       { label: 'Admitted',         style: 'bg-gray-100 text-gray-500'       },
  awaiting_billing:     { label: 'Awaiting Billing', style: 'bg-amber-100 text-amber-600'     },
  cost_center_clearing: { label: 'Clearance (Processing)',     style: 'bg-violet-100 text-violet-600'   },
  discharged:           { label: 'Discharged',       style: 'bg-emerald-100 text-emerald-700' },
};

const TAB_CONFIG = {
  total:           { title: 'Total Patients',    subtitle: 'All patients in the system',                   filter: p => true },
  admitted:        { title: 'Admitted',          subtitle: 'Patients not yet in discharge process',        filter: p => p.clearance_step === 'no_request' || p.clearance_step === 'awaiting_nurse' },
  awaiting_billing:{ title: 'Awaiting Billing',  subtitle: 'Nurse approved waiting for billing',         filter: p => p.clearance_step === 'awaiting_billing' },
  in_clearance:    { title: 'Clearance (Processing)', subtitle: 'Currently being cleared by cost centers', filter: p => p.clearance_step === 'cost_center_clearing' && !(parseInt(p.pending_count) === 0 && parseInt(p.total_cc) > 0) },
  pending:         { title: 'Missing Requirements', subtitle: 'Patients with missing requirements sent back',  filter: p => p.has_pending && p.clearance_step === 'cost_center_clearing' },  cleared:         { title: 'Cleared Patients',  subtitle: 'All cost centers have cleared these patients',  filter: p => p.clearance_step === 'cost_center_clearing' && parseInt(p.pending_count) === 0 && parseInt(p.total_cc) > 0 },
  discharged:      { title: 'Discharged',        subtitle: 'Successfully discharged patients',             filter: p => p.clearance_step === 'discharged' },
};

function AdminPatientList({ tab, onPatientsLoaded }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('');  const [trackPatient, setTrackPatient]     = useState(null);
  const [trackClearances, setTrackClearances] = useState([]);
  const [trackLoading, setTrackLoading]     = useState(false);
  const [clearModal, setClearModal]         = useState(null);
  const [clearSelected, setClearSelected]   = useState([]);
  const [clearRemarks, setClearRemarks]     = useState('');
  const [clearing, setClearing]             = useState(false);
  // Nurse actions
  const [mayGoHomeModal, setMayGoHomeModal] = useState(null);
  const [mghName, setMghName]               = useState('');
  const [mghRemarks, setMghRemarks]         = useState('');
  const [mghSaving, setMghSaving]           = useState(false);
  // Billing actions
  const [forClearanceModal, setForClearanceModal] = useState(null); // { patient, selected[] }
  const [dischargeModal, setDischargeModal] = useState(null);
  const [dischargeName, setDischargeName]   = useState('');
  const [dischargePassword, setDischargePassword] = useState('');
  const [showDischargePass, setShowDischargePass] = useState(false);
  const [dischargeRemarks, setDischargeRemarks] = useState('');
  const [dischargeSaving, setDischargeSaving] = useState(false);
  const [pendingModal, setPendingModal]     = useState(null);
  const [pendingCCs, setPendingCCs]         = useState([]);
  const [pendingSelected, setPendingSelected] = useState([]);
  const [pendingReason, setPendingReason]   = useState('');
  const [pendingActor, setPendingActor]     = useState('');
  const [pendingPassword, setPendingPassword] = useState('');
  const [showPendingPass, setShowPendingPass] = useState(false);
  const [pendingSaving, setPendingSaving]   = useState(false);
  const [selectMode, setSelectMode]         = useState(false);
  const [selected, setSelectedIds]          = useState(new Set());
  const [deleteConfirm, setDeleteConfirm]   = useState(false);
  const [deleting, setDeleting]             = useState(false);
  const [filterDate, setFilterDate]         = useState(() => new Date().toISOString().split('T')[0]);
  // Return to admitted
  const [returnModal, setReturnModal]       = useState(null);
  const [returnName, setReturnName]         = useState('');
  const [returnRemarks, setReturnRemarks]   = useState('');
  const [returnSaving, setReturnSaving]     = useState(false);
  const cfg = TAB_CONFIG[tab];

  const SERVICE_CC = {
    OB:       ['Pulmonary Department (MSA)','Radiology','Laboratory','Bloodbank','Pharmacy','Endoscopy','Colonoscopy','Physical Therapy','Benefits - Window 3A','Billing - Window 2','Operating Room/Delivery Room'],
    Surgery:  ['Pulmonary Department (MSA)','Radiology','Laboratory','Bloodbank','Pharmacy','Endoscopy','Colonoscopy','Physical Therapy','Benefits - Window 3A','Billing - Window 2','Operating Room/Delivery Room'],
    Medicine: ['Pulmonary Department (MSA)','Radiology','Laboratory','Bloodbank','Pharmacy','Endoscopy','Colonoscopy','Physical Therapy','Benefits - Window 3A','Billing - Window 2','Operating Room/Delivery Room','Hemodialysis Unit'],
    Pedia:    ['Pulmonary Department (MSA)','Radiology','Laboratory','Bloodbank','Pharmacy','Endoscopy','Colonoscopy','Physical Therapy','Benefits - Window 3A','Billing - Window 2'],
  };

  const refetch = (date) => {
    setLoading(true);
    const d = date || filterDate;
    api.get(`/get_patients.php?role=Admin&date=${d}`)
      .then(res => { const p = res.data || []; setPatients(p); onPatientsLoaded && onPatientsLoaded(p); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { refetch(); }, [tab]);
  useWebSocketPatients('Admin', filterDate, (updatedPatients) => {
    const p = updatedPatients || [];
    setPatients(p);
    onPatientsLoaded && onPatientsLoaded(p);
  }, true, [tab, filterDate]);

  const openTracker = async (p) => {
    setTrackPatient(p); setTrackLoading(true);
    try {
      const r = await api.get(`/get_clearance_report.php?patient_id=${p.id}`);
      setTrackClearances(r.data.success ? r.data.clearances : []);
    } catch { setTrackClearances([]); }
    finally { setTrackLoading(false); }
  };

  const openClearModal = async (p) => {
    setClearModal({ patient: p, clearances: [] }); setClearSelected([]); setClearRemarks('');
    try {
      const r = await api.get(`/get_clearance_report.php?patient_id=${p.id}`);
      if (r.data.success) setClearModal({ patient: p, clearances: r.data.clearances.filter(c => c.status === 'pending') });
    } catch { /* silent */ }
  };
  const submitClear = async () => {
    if (!clearSelected.length) { alert('Select at least one cost center.'); return; }
    setClearing(true);
    try {
      for (const cc of clearSelected) {
        await api.post('/update_clearance.php', { action: 'cost_center_clear', patient_id: clearModal.patient.id, cost_center: cc, actor: 'Admin', remarks: clearRemarks.trim() });
      }
      setClearModal(null); refetch();
    } catch { alert('An error occurred.'); }
    finally { setClearing(false); }
  };

  const submitMayGoHome = async () => {
    setMghSaving(true);
    try {
      const res = await api.post('/update_clearance.php', { action: 'may_go_home', patient_id: mayGoHomeModal.id, actor: 'Admin', remarks: mghRemarks.trim() });
      if (res.data.success) { setMayGoHomeModal(null); setMghRemarks(''); refetch(); } else alert(res.data.message);
    } finally { setMghSaving(false); }
  };

  const submitReturn = async (returnType) => {
    setReturnSaving(true);
    try {
      const action = returnType === 'clearance' ? 'return_to_clearance' : 'cancel_discharge';
      const defaultRemarks = returnType === 'clearance' ? 'Returned to clearance by Admin' : 'Returned to admitted by Admin';
      const res = await api.post('/update_clearance.php', {
        action,
        patient_id: returnModal.id,
        actor: 'Admin',
        remarks: returnRemarks.trim() || defaultRemarks,
      });
      if (res.data.success) { setReturnModal(null); setReturnRemarks(''); refetch(); }
      else alert(res.data.message);
    } finally { setReturnSaving(false); }
  };

  const openForClearance = (p) => setForClearanceModal({ patient: p, service: '', selected: [] });
  const sendForClearance = async () => {
    if (!forClearanceModal.selected.length) { alert('Select at least one cost center.'); return; }
    try {
      const res = await api.post('/update_clearance.php', { action: 'for_clearance', patient_id: forClearanceModal.patient.id, actor: 'Admin', cost_centers: forClearanceModal.selected });
      if (res.data.success) { setForClearanceModal(null); refetch(); } else { alert(res.data.message); setForClearanceModal(null); }
    } catch { alert('An error occurred. Please try again.'); setForClearanceModal(null); }
  };

  const submitDischarge = async () => {
    if (!dischargeRemarks.trim()) { alert('Enter final remarks.'); return; }
    setDischargeSaving(true);
    try {
      const res = await api.post('/update_clearance.php', { action: 'discharge', patient_id: dischargeModal.id, actor: 'Admin', remarks: dischargeRemarks });
      if (res.data.success) { setDischargeModal(null); setDischargeRemarks(''); refetch(); } else alert(res.data.message);
    } finally { setDischargeSaving(false); }
  };

  const openPendingModal = async (p) => {
    setPendingModal(p); setPendingCCs([]); setPendingSelected([]); setPendingReason(''); setPendingActor('');
    try {
      const r = await api.get(`/get_clearance_report.php?patient_id=${p.id}`);
      if (r.data.success) setPendingCCs(r.data.clearances.map(c => c.cost_center));
    } catch { /* silent */ }
  };
  const submitPending = async () => {
    if (!pendingSelected.length) { alert('Select at least one cost center.'); return; }
    setPendingSaving(true);
    try {
      const res = await api.post('/send_back_clearance.php', { patient_id: pendingModal.id, actor: 'Admin', cost_centers: pendingSelected, reason: pendingReason.trim() || 'Missing requirements' });
      if (res.data.success) { setPendingModal(null); refetch(); } else alert(res.data.message);
    } finally { setPendingSaving(false); }
  };

  const filtered = patients
    .filter(cfg.filter)
    .filter(p => (!typeFilter || p.patient_type === typeFilter))
    .filter(p => p.full_name.toLowerCase().includes(search.toLowerCase()) || p.patient_no.toLowerCase().includes(search.toLowerCase()));
  const { paged, page, setPage, totalPages, total, start, pageSize } = usePagination(filtered);

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await api.post('/delete_patients.php', { ids: [...selected] });
      if (res.data.success) {
        setDeleteConfirm(false);
        setSelectMode(false);
        setSelectedIds(new Set());
        refetch();
      } else alert(res.data.message);
    } finally { setDeleting(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{cfg.title}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{cfg.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <DateFilter value={filterDate} onChange={d => { setFilterDate(d); refetch(d); }} />
          {!selectMode ? (
          <button onClick={() => { setSelectMode(true); setSelectedIds(new Set()); }}
            className="flex items-center gap-1.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{selected.size} selected</span>
            <button onClick={() => setDeleteConfirm(true)} disabled={selected.size === 0}
              className="text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-40 px-4 py-2 rounded-xl transition-colors">
              Delete Selected
            </button>
            <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
              className="text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-xl transition-colors">
              Cancel
            </button>
          </div>
        )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1"><SearchBar value={search} onChange={setSearch} placeholder="Search by name or hospital no." /></div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white shrink-0">
          <option value="">All Types</option>
          <option value="in-patient">In-Patient</option>
          <option value="er">ER</option>
          <option value="opd">OPD</option>
        </select>
      </div>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                {selectMode && (
                  <th className="px-4 py-3.5">
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-400" />
                  </th>
                )}
                {['Hospital No.','Name of Patient','Age','Ward','Admit Date','Type','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={selectMode ? 9 : 8} className="text-center py-12 text-gray-300 text-sm">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={selectMode ? 9 : 8} className="text-center py-12 text-gray-300 text-sm">No patients found.</td></tr>
              ) : paged.map(p => {
                const step = STEP_LABELS[p.clearance_step] || STEP_LABELS['no_request'];
                const isPending = p.has_pending && p.clearance_step === 'cost_center_clearing';
                return (
                  <tr key={p.id}
                    onClick={() => selectMode && toggleSelect(p.id)}
                    className={`transition-colors ${selectMode ? 'cursor-pointer select-none' : ''} ${selectMode && selected.has(p.id) ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-gray-50/70'}`}>
                    {selectMode && (
                      <td className="px-4 py-3.5">
                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)}
                          className="rounded border-gray-300 text-red-500 focus:ring-red-400" />
                      </td>
                    )}
                    <td className="px-4 py-3.5 font-mono text-xs text-gray-400 whitespace-nowrap">{p.patient_no}</td>
                    <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">{p.full_name}</td>
                    <td className="px-4 py-3.5 text-gray-500 text-center">{p.age}</td>
                    <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">{p.ward}</td>
                    <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                      {p.admit_date ? new Date(p.admit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '�'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${p.patient_type === 'er' ? 'bg-red-100 text-red-600' : p.patient_type === 'opd' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {p.patient_type === 'er' ? 'ER' : p.patient_type === 'opd' ? 'OPD' : 'In-Patient'}
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
                        {(p.clearance_step === 'no_request' || p.clearance_step === 'awaiting_nurse') && (
                          <button onClick={() => { setMayGoHomeModal(p); setMghName(''); setMghRemarks(''); }}
                            className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                            May Go Home
                          </button>
                        )}
                        {p.clearance_step === 'awaiting_billing' && (
                          <button onClick={() => openForClearance(p)}
                            className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                            For Clearance
                          </button>
                        )}
                        {/* Return button — available for any step past may_go_home */}
                        {(p.clearance_step === 'awaiting_billing' || p.clearance_step === 'cost_center_clearing') && (
                          <button onClick={() => { setReturnModal(p); setReturnName(''); setReturnRemarks(''); }}
                            className="text-xs font-semibold bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                            Return
                          </button>
                        )}
                        {p.clearance_step === 'cost_center_clearing' && (
                          <>
                            <button onClick={() => openClearModal(p)}
                              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                              Clear
                            </button>
                            {parseInt(p.pending_count) === 0 && parseInt(p.total_cc) > 0 && (
                              <>
                                <button onClick={() => { setDischargeModal(p); setDischargeName(''); setDischargeRemarks(''); }}
                                  className="text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                  Discharge
                                </button>
                                <button onClick={() => openPendingModal(p)}
                                  className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                  Pending
                                </button>
                              </>
                            )}
                            <button onClick={() => openTracker(p)}
                              className="text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                              Track
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} start={start} pageSize={pageSize} onPage={setPage} />
      </div>

      {/* Clearance Progress Tracker Modal */}
      {trackPatient && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Clearance Progress</h3>
                <p className="text-sm text-gray-500">{trackPatient.full_name} {trackPatient.patient_no}</p>
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
                  const total   = trackClearances.length;
                  return (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Progress</span>
                        <span className="text-xs font-semibold text-gray-700">{cleared}/{total} cleared</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(cleared/total)*100}%` }} />
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* Clear Patient Modal */}
      {clearModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Clear Patient</h3>
            <p className="text-sm text-gray-500 mb-4">
              Select cost centers to clear for <span className="font-semibold text-gray-800">{clearModal.patient.full_name}</span> ({clearModal.patient.patient_no})
            </p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Cost Centers <span className="text-red-500">*</span>
                    {clearSelected.length > 0 && <span className="text-emerald-600 normal-case font-normal ml-1">{clearSelected.length} selected</span>}
                  </label>
                  {clearModal.clearances.length > 0 && (
                    <button onClick={() => setClearSelected(
                      clearSelected.length === clearModal.clearances.length ? [] : clearModal.clearances.map(c => c.cost_center)
                    )} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                      {clearSelected.length === clearModal.clearances.length ? 'Deselect all' : 'Select all'}
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-1 max-h-52 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {clearModal.clearances.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2 text-center">Loading...</p>
                  ) : clearModal.clearances.map(c => (
                    <label key={c.cost_center} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${clearSelected.includes(c.cost_center) ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={clearSelected.includes(c.cost_center)}
                        onChange={() => setClearSelected(prev => prev.includes(c.cost_center) ? prev.filter(x => x !== c.cost_center) : [...prev, c.cost_center])}
                        className="w-4 h-4 accent-emerald-600 shrink-0" />
                      <span className="text-sm text-gray-700">{c.cost_center}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Remarks <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
                <textarea rows={2} value={clearRemarks} onChange={e => setClearRemarks(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={submitClear} disabled={clearing || !clearSelected.length}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {clearing ? 'Clearing...' : `Clear${clearSelected.length > 1 ? ` (${clearSelected.length})` : ''}`}
              </button>
              <button onClick={() => setClearModal(null)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* May Go Home Modal */}
      {mayGoHomeModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Confirm May Go Home</h3>
            <p className="text-sm text-gray-500 mb-4">Mark <span className="font-semibold text-gray-800">{mayGoHomeModal.full_name}</span> ({mayGoHomeModal.patient_no}) as ready for discharge clearance.</p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Remarks <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
              <textarea rows={2} value={mghRemarks} onChange={e => setMghRemarks(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={submitMayGoHome} disabled={mghSaving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">{mghSaving ? 'Confirming...' : 'Confirm May Go Home'}</button>
              <button onClick={() => setMayGoHomeModal(null)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Return to Admitted Modal */}
      {returnModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Return Patient</h3>
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-semibold text-gray-800">{returnModal.full_name}</span> ({returnModal.patient_no}) — choose where to return this patient.
            </p>
            <div className="flex flex-col gap-1.5 mb-5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Reason <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
              <textarea rows={2} placeholder="e.g. Patient condition changed" value={returnRemarks}
                onChange={e => setReturnRemarks(e.target.value)}
                className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none" />
            </div>
            <div className="flex flex-col gap-2">
              {/* Return to Clearance — only if patient is fully cleared (all CCs done) */}
              {returnModal.clearance_step === 'cost_center_clearing' && parseInt(returnModal.pending_count) === 0 && parseInt(returnModal.total_cc) > 0 && (
                <button onClick={() => submitReturn('clearance')} disabled={returnSaving}
                  className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                  {returnSaving ? 'Processing...' : 'Return to Clearance (reset CC statuses)'}
                </button>
              )}
              <button onClick={() => submitReturn('admitted')} disabled={returnSaving}
                className="w-full py-2.5 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {returnSaving ? 'Processing...' : 'Return to Admitted (full reset)'}
              </button>
              <button onClick={() => setReturnModal(null)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* For Clearance Modal */}
      {forClearanceModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Send for Clearance</h3>
            <p className="text-sm text-gray-500 mb-4"><span className="font-semibold text-gray-700">{forClearanceModal.patient.full_name}</span> � select service to load cost centers.</p>
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Service</label>
              <select value={forClearanceModal.service} onChange={e => { const svc = e.target.value; setForClearanceModal(f => ({ ...f, service: svc, selected: svc ? [...SERVICE_CC[svc]] : [] })); }} className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                <option value="">-- Select Service --</option>
                {Object.keys(SERVICE_CC).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {forClearanceModal.selected.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-4 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {forClearanceModal.selected.map(cc => (
                  <div key={cc} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
                    <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span className="text-sm text-gray-700">{cc}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <button onClick={sendForClearance} disabled={!forClearanceModal.selected.length} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">Send to {forClearanceModal.selected.length} dept{forClearanceModal.selected.length !== 1 ? 's' : ''}</button>
              <button onClick={() => setForClearanceModal(null)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Discharge Modal */}
      {dischargeModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Discharge Patient</h3>
            <p className="text-sm text-gray-500 mb-4">Confirm discharge for <span className="font-semibold text-gray-800">{dischargeModal.full_name}</span> ({dischargeModal.patient_no})</p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Final Remarks <span className="text-red-500">*</span></label>
              <textarea rows={2} value={dischargeRemarks} onChange={e => setDischargeRemarks(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={submitDischarge} disabled={dischargeSaving} className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">{dischargeSaving ? 'Discharging...' : 'Confirm Discharge'}</button>
              <button onClick={() => setDischargeModal(null)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Modal */}
      {pendingModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Mark as Pending</h3>
            <p className="text-sm text-gray-500 mb-4">Send <span className="font-semibold text-gray-800">{pendingModal.full_name}</span> ({pendingModal.patient_no}) back to cost center(s).</p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Cost Centers <span className="text-red-500">*</span> {pendingSelected.length > 0 && <span className="text-orange-500 normal-case font-normal ml-1">{pendingSelected.length} selected</span>}</label>
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {pendingCCs.length === 0 ? <p className="text-xs text-gray-400 py-2 text-center">Loading...</p> : pendingCCs.map(cc => (
                    <label key={cc} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${pendingSelected.includes(cc) ? 'bg-orange-50 border border-orange-200' : 'hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={pendingSelected.includes(cc)} onChange={() => setPendingSelected(prev => prev.includes(cc) ? prev.filter(c => c !== cc) : [...prev, cc])} className="w-4 h-4 accent-orange-500 shrink-0" />
                      <span className="text-sm text-gray-700">{cc}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Reason</label>
                <textarea rows={2} placeholder="Missing requirement (optional)" value={pendingReason} onChange={e => setPendingReason(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={submitPending} disabled={pendingSaving || !pendingSelected.length} className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">{pendingSaving ? 'Sending...' : `Send Back${pendingSelected.length > 1 ? ` (${pendingSelected.length})` : ''}`}</button>
              <button onClick={() => setPendingModal(null)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <p className="text-base font-bold text-gray-900 mb-1">Delete {selected.size} patient{selected.size !== 1 ? 's' : ''}?</p>
            <p className="text-sm text-gray-500 mb-5">This will permanently remove the patient record and all associated clearance data. This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button onClick={() => setDeleteConfirm(false)}
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

const EMPTY_FORM = { username: '', full_name: '', password: '', confirmPassword: '', cost_center: '' };

const EyeIcon = ({ show, onClick }) => (
  <button type="button" onClick={onClick} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
    {show ? (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      </svg>
    ) : (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    )}
  </button>
);

export default function AdminDashboard({ user, onLogout }) {
  const [tab, setTab] = useState('dashboard');
  const [auditKey, setAuditKey]   = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [adminStats, setAdminStats]     = useState({});
  const [patientCounts, setPatientCounts] = useState({});
  const [allStaff, setAllStaff]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [activeCC, setActiveCC]   = useState('All');
  const [form, setForm]           = useState(null);
  const [saving, setSaving]       = useState(false);
  const [deleteId, setDeleteId]   = useState(null);
  const [showPass, setShowPass]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [ccOpen, setCcOpen]       = useState(false);
  const ccRef = useRef(null);
  const [profile, setProfile]         = useState({ full_name: user.fullName, username: user.username, password: '', confirmPassword: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg]   = useState(null);
  const [showProfilePass, setShowProfilePass]       = useState(false);
  const [showProfileConfirm, setShowProfileConfirm] = useState(false);

  const [toastSettings, setToastSettings] = useState({});
  const [adminPendingBalance, setAdminPendingBalance] = useState([]);
  const [adminPendingBalanceLoading, setAdminPendingBalanceLoading] = useState(false);
  const [adminRemarksModal, setAdminRemarksModal] = useState(null);
  const [expandedPatient, setExpandedPatient] = useState(null);
  const [adminClearModal, setAdminClearModal] = useState(null); // { patient, cost_center }
  const [adminClearRemarks, setAdminClearRemarks] = useState('');
  const [adminClearSaving, setAdminClearSaving] = useState(false);

  const handleAdminClear = async () => {
    setAdminClearSaving(true);
    try {
      const res = await api.post('/pending_balance.php', {
        action: 'admin_clear',
        patient_id: adminClearModal.patient.id,
        cost_center: adminClearModal.cost_center,
        actor: user.fullName || user.username,
        remarks: adminClearRemarks.trim() || 'Cleared by admin',
      });
      if (res.data.success) {
        setAdminClearModal(null);
        setAdminClearRemarks('');
        fetchAdminPendingBalance();
      } else {
        alert(res.data.message);
      }
    } finally { setAdminClearSaving(false); }
  };

  const handlePatientsLoaded = (patients) => {
    setPatientCounts({
      total:            patients.length,
      admitted:         patients.filter(p => p.clearance_step === 'no_request' || p.clearance_step === 'awaiting_nurse').length,
      awaiting_billing: patients.filter(p => p.clearance_step === 'awaiting_billing').length,
      in_clearance:     patients.filter(p => p.clearance_step === 'cost_center_clearing' && !(parseInt(p.pending_count) === 0 && parseInt(p.total_cc) > 0)).length,
      pending:          patients.filter(p => p.has_pending && p.clearance_step === 'cost_center_clearing').length,
      cleared:          patients.filter(p => p.clearance_step === 'cost_center_clearing' && parseInt(p.pending_count) === 0 && parseInt(p.total_cc) > 0).length,
      discharged:       patients.filter(p => p.clearance_step === 'discharged').length,
    });
  };

  const fetchAdminPendingBalance = () => {
    setAdminPendingBalanceLoading(true);
    api.get('/pending_balance.php?cost_center=all')
      .then(res => setAdminPendingBalance(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setAdminPendingBalanceLoading(false));
  };

  const fetchAll = () => {
    setLoading(true);
    api.get('/manage_users.php?action=list_all')
      .then(res => setAllStaff(Array.isArray(res.data) ? res.data : []))
      .finally(() => setLoading(false));
  };

  const fetchToastSettings = () => {
    api.get('/notification_settings.php')
      .then(res => setToastSettings(res.data || {}))
      .catch(() => {});
  };

  const toggleToast = async (costCenter, current) => {
    const newVal = !current;
    setToastSettings(prev => ({ ...prev, [costCenter]: newVal }));
    await api.post('/notification_settings.php', { cost_center: costCenter, toast_enabled: newVal }).catch(() => {});
  };

  useEffect(() => {
    fetchAll();
    fetchToastSettings();
    fetchAdminPendingBalance();
    api.get('/get_stats.php').then(r => {
      const d = r.data || {};
      setPendingCount(d.pending_count || 0);
      setAdminStats(d);
    }).catch(() => {});
    // Load patient counts for badges on initial render (date = today)
    const today = new Date().toISOString().split('T')[0];
    api.get(`/get_patients.php?role=Admin&date=${today}`)
      .then(r => handlePatientsLoaded(r.data || []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!ccOpen) return;
    const close = (e) => { if (ccRef.current && !ccRef.current.contains(e.target)) setCcOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ccOpen]);

  const filtered = allStaff.filter(s => {
    const matchCC = activeCC === 'All' || s.cost_center === activeCC;
    const q = search.toLowerCase();
    return matchCC && (!q || s.username.toLowerCase().includes(q) || s.full_name.toLowerCase().includes(q) || s.cost_center.toLowerCase().includes(q));
  });
  const { paged: pagedStaff, page: staffPage, setPage: setStaffPage, totalPages: staffTotalPages, total: staffTotal, start: staffStart, pageSize: staffPageSize } = usePagination(filtered);

  const openCreate = () => { setShowPass(false); setShowConfirm(false); setForm({ mode: 'create', data: { ...EMPTY_FORM, cost_center: activeCC !== 'All' ? activeCC : '' } }); };
  const openEdit   = (s) => { setShowPass(false); setShowConfirm(false); setForm({ mode: 'edit', data: { id: s.id, username: s.username, full_name: s.full_name, cost_center: s.cost_center, password: '', confirmPassword: '' } }); };
  const set = (key, val) => setForm(f => ({ ...f, data: { ...f.data, [key]: val } }));

  const handleSave = async () => {
    const { username, full_name, password, confirmPassword, cost_center } = form.data;
    if (!username.trim() || !full_name.trim() || !cost_center) { alert('Username, full name, and cost center are required.'); return; }
    if (form.mode === 'create' && !password.trim()) { alert('Password is required for new accounts.'); return; }
    if (password && password !== confirmPassword) { alert('Passwords do not match.'); return; }
    setSaving(true);
    try {
      const res = await api.post(`/manage_users.php?action=${form.mode === 'create' ? 'create' : 'edit'}`, form.data);
      if (res.data.success) { setForm(null); fetchAll(); } else alert(res.data.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    setSaving(true);
    try {
      const res = await api.post('/manage_users.php?action=delete', { id });
      if (res.data.success) { setDeleteId(null); fetchAll(); } else alert(res.data.message);
    } finally { setSaving(false); }
  };

  const handleProfileSave = async () => {
    if (!profile.username.trim() || !profile.full_name.trim()) { setProfileMsg({ ok: false, text: 'Username and full name are required.' }); return; }
    if (profile.password && profile.password !== profile.confirmPassword) { setProfileMsg({ ok: false, text: 'Passwords do not match.' }); return; }
    setProfileSaving(true); setProfileMsg(null);
    try {
      const res = await api.post('/update_profile.php', { id: user.id, ...profile });
      if (res.data.success) { setProfileMsg({ ok: true, text: 'Profile updated successfully.' }); setProfile(p => ({ ...p, password: '', confirmPassword: '' })); }
      else setProfileMsg({ ok: false, text: res.data.message });
    } finally { setProfileSaving(false); }
  };

  const tabs = ['All', ...COST_CENTERS];
  const PATIENT_TABS = ['total','admitted','awaiting_billing','in_clearance','pending','cleared','discharged'];

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <header className="bg-emerald-800 sticky top-0 z-10 shadow">
        <div className="w-full px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}GEAMH-LOGO.png`} alt="logo" className="w-7 h-7 object-contain" />
            <div className="leading-tight">
              <p className="text-[10px] text-emerald-300 uppercase tracking-widest">Hospital Clearance System</p>
              <p className="text-white font-semibold text-sm">Admin Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PhClock />
            <NotificationBell recipient="Admin" />
            <button onClick={() => setTab('profile')} title="Profile Settings"
              className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {tab !== "profile" && (
      <div className="flex flex-1 min-h-0">
        <aside className="w-56 shrink-0 bg-white border-r border-gray-100 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">System Management</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">Admin Panel</p>
          </div>
          <nav className="flex flex-col gap-0.5 p-2 flex-1 overflow-y-auto min-h-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2 pt-1 pb-0.5">Overview</p>
            <NavBtn compact tabKey="dashboard" label="Dashboard" active={tab} setTab={setTab} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2 pt-2 pb-0.5">Patients</p>
            <NavBtn compact tabKey="total"            label="Total Patients"   active={tab} setTab={setTab} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            <NavBtn compact tabKey="admitted"         label="Admitted"         active={tab} setTab={setTab} badge={patientCounts.admitted || undefined} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            <NavBtn compact tabKey="awaiting_billing" label="Awaiting Billing" active={tab} setTab={setTab} badge={patientCounts.awaiting_billing || undefined} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            <NavBtn compact tabKey="in_clearance"     label="Clearance (Processing)"     active={tab} setTab={setTab} badge={patientCounts.in_clearance || undefined} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            <NavBtn compact tabKey="pending" label="Missing Requirements" active={tab} setTab={setTab} badge={patientCounts.pending || undefined} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <NavBtn compact tabKey="pending_balance" label="Pending Balance" active={tab} setTab={() => { setTab('pending_balance'); fetchAdminPendingBalance(); }} badge={[...new Set(adminPendingBalance.filter(r => r.status === 'pending_balance').map(r => r.id))].length || undefined} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <NavBtn compact tabKey="cleared"          label="Cleared Patients" active={tab} setTab={setTab} badge={patientCounts.cleared || undefined} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            <NavBtn compact tabKey="discharged"       label="Discharged"       active={tab} setTab={setTab} badge={patientCounts.discharged || undefined} d="M5 13l4 4L19 7" />
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2 pt-2 pb-0.5">Management</p>
            <NavBtn compact tabKey="staff" label="Account Management" active={tab} setTab={setTab} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2 pt-2 pb-0.5">Records</p>
            <NavBtn compact tabKey="audit" label="Audit Trail" active={tab} setTab={() => { setTab("audit"); setAuditKey(k => k + 1); }} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </nav>
          <div className="p-2 border-t border-gray-100 shrink-0">
            <button onClick={onLogout} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors w-full">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {tab === "dashboard" && <DashboardOverview title="Admin Dashboard" subtitle="System-wide overview" onCardClick={t => setTab(t)} />}
          {tab === 'audit' && <AuditTrail key={auditKey} role="admin" />}
          {PATIENT_TABS.includes(tab) && <AdminPatientList tab={tab} onPatientsLoaded={handlePatientsLoaded} />}

          {tab === 'pending_balance' && (() => {
            // Group flat list by patient_id
            const grouped = adminPendingBalance.reduce((acc, row) => {
              const key = row.id;
              if (!acc[key]) {
                acc[key] = {
                  id: row.id, patient_no: row.patient_no, full_name: row.full_name,
                  age: row.age, ward: row.ward, admit_date: row.admit_date,
                  patient_type: row.patient_type, costCenters: []
                };
              }
              acc[key].costCenters.push({
                cost_center: row.cost_center,
                status: row.status,
                flagged_by: row.status === 'pending_balance' ? row.flagged_by : null,
                balance_remarks: row.status === 'pending_balance' ? row.balance_remarks : null,
                flagged_at: row.flagged_at,
              });
              return acc;
            }, {});
            const patients = Object.values(grouped);

            return (
              <div className="flex flex-col gap-5">
                <div>
                  <h1 className="text-xl font-bold text-gray-800">Pending Balance</h1>
                  <p className="text-sm text-gray-400 mt-0.5">Click a patient to see which cost centers flagged a balance mismatch</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-left">
                          {['Hospital No.','Name of Patient','Ward','Admit Date','Flagged Depts',''].map(h => (
                            <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {adminPendingBalanceLoading ? (
                          <tr><td colSpan={6} className="text-center py-12 text-gray-300 text-sm">Loading...</td></tr>
                        ) : patients.length === 0 ? (
                          <tr><td colSpan={6} className="text-center py-12 text-gray-300 text-sm">No pending balance patients.</td></tr>
                        ) : patients.map(p => (
                          <>
                            <tr key={p.id}
                              onClick={() => setExpandedPatient(expandedPatient === p.id ? null : p.id)}
                              className="hover:bg-gray-50/70 transition-colors cursor-pointer border-b border-gray-50">
                              <td className="px-5 py-4 font-mono text-xs text-gray-400 whitespace-nowrap">{p.patient_no}</td>
                              <td className="px-5 py-4 font-semibold text-gray-800 whitespace-nowrap">{p.full_name}</td>
                              <td className="px-5 py-4 text-gray-500 whitespace-nowrap">{p.ward}</td>
                              <td className="px-5 py-4 text-gray-500 text-xs whitespace-nowrap">
                                {p.admit_date ? new Date(p.admit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '�'}
                              </td>
                              <td className="px-5 py-4">
                                <span className="text-xs font-semibold bg-red-100 text-red-600 px-2.5 py-1 rounded-full">
                                  {p.costCenters.length} dept{p.costCenters.length !== 1 ? 's' : ''}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-gray-400">
                                <svg className={`w-4 h-4 transition-transform ${expandedPatient === p.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </td>
                            </tr>
                            {expandedPatient === p.id && (
                              <tr key={`${p.id}-detail`}>
                                <td colSpan={6} className="px-5 pb-4 pt-0 bg-gray-50/60">
                                  <div className="rounded-xl border border-gray-100 overflow-hidden mt-1">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-gray-100 text-left">
                                          {['Cost Center','Flagged By','Remarks','Action'].map(h => (
                                            <th key={h} className="px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 bg-white">
                                        {p.costCenters.map((cc, i) => (
                                          <tr key={i}>
                                            <td className="px-4 py-2.5">
                                              <span className="font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{cc.cost_center}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-600">
                                              {cc.status === 'pending_balance'
                                                ? <span className="text-red-600 font-medium">{cc.flagged_by}</span>
                                                : <span className="text-gray-400 italic">No action yet</span>
                                              }
                                            </td>
                                            <td className="px-4 py-2.5">
                                              {cc.status === 'pending_balance' && cc.balance_remarks
                                                ? <button onClick={e => { e.stopPropagation(); setAdminRemarksModal({ ...p, cost_center: cc.cost_center, balance_remarks: cc.balance_remarks }); }}
                                                    className="font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors">
                                                    View
                                                  </button>
                                                : <span className="text-gray-300">�</span>
                                              }
                                            </td>
                                            <td className="px-4 py-2.5">
                                              {cc.status === 'pending_balance'
                                                ? <button onClick={e => { e.stopPropagation(); setAdminClearModal({ patient: p, cost_center: cc.cost_center }); setAdminClearRemarks(''); }}
                                                    className="font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap">
                                                    Clear
                                                  </button>
                                                : <span className="text-xs text-amber-500 font-medium bg-amber-50 px-2 py-0.5 rounded-full">Pending</span>
                                              }
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                    {patients.length} patient(s) with pending balance
                  </div>
                </div>
              </div>
            );
          })()}

          {tab === 'staff' && (
            <div className="flex flex-col gap-5">
              <div>
                <h1 className="text-xl font-bold text-gray-800">Account Management</h1>
                <p className="text-sm text-gray-400 mt-0.5">Manage all staff accounts across every cost center</p>
              </div>
              <div className="flex gap-3 items-center">
                <SearchBar value={search} onChange={setSearch} placeholder="Search by name, username, or cost center�" />
                <div className="relative w-64 shrink-0" ref={ccRef}>
                  <button onClick={() => setCcOpen(v => !v)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                    <span className="truncate">{activeCC === 'All' ? `All Cost Centers (${allStaff.length})` : activeCC}</span>
                    <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${ccOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {ccOpen && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                      {tabs.map(cc => (
                        <button key={cc} onClick={() => { setActiveCC(cc); setCcOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${activeCC === cc ? 'bg-emerald-700 text-white font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
                          {cc === 'All' ? `All Cost Centers (${allStaff.length})` : cc}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={openCreate}
                  className="flex items-center gap-1.5 text-sm font-semibold bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Account
                </button>
              </div>
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-left">
                        {['Username','Full Name','Cost Center','Created','Notification Management','Actions'].map(h => (
                        <th key={h} className={`px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap ${h === 'Notification Management' ? 'text-center' : ''}`}>{h}</th>
                      ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {loading ? (
                        <tr><td colSpan={5} className="text-center py-12 text-gray-300 text-sm">Loading</td></tr>
                      ) : filtered.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-12 text-gray-300 text-sm">No staff accounts found.</td></tr>
                      ) : pagedStaff.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-5 py-4 font-mono text-xs text-gray-400">{s.username}</td>
                          <td className="px-5 py-4 font-semibold text-gray-800">{s.full_name}</td>
                          <td className="px-5 py-4"><span className="text-xs font-medium bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">{s.cost_center}</span></td>
                          <td className="px-5 py-4 text-gray-500 text-xs">{new Date(s.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' })}</td>
                          <td className="px-5 py-4 text-center">
                            {s.cost_center && s.cost_center !== 'Nurse' ? (() => {
                              const on = toastSettings[s.cost_center] !== false;
                              return (
                                <button
                                  onClick={() => toggleToast(s.cost_center, on)}
                                  className={`relative inline-flex h-7 w-16 items-center rounded-full transition-colors duration-200 focus:outline-none ${on ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                >
                                  <span className={`absolute text-[10px] font-bold text-white transition-all duration-200 ${on ? 'left-2' : 'right-2'}`}>
                                    {on ? 'ON' : 'OFF'}
                                  </span>
                                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-10' : 'translate-x-1'}`} />
                                </button>
                              );
                            })() : (
                              <span className="text-xs text-gray-300">�</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex gap-2">
                              <button onClick={() => openEdit(s)} className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">Edit</button>
                              <button onClick={() => setDeleteId(s.id)} className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={staffPage} totalPages={staffTotalPages} total={staffTotal} start={staffStart} pageSize={staffPageSize} onPage={setStaffPage} />
              </div>
            </div>
          )}
        </main>
      </div>
      )}

      {tab === 'profile' && (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-6 max-w-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-2xl font-bold select-none">
                  {profile.full_name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-800">{profile.full_name}</h1>
                  <p className="text-sm text-gray-400">@{profile.username}</p>
                  <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Admin</span>
                </div>
              </div>
              <button onClick={() => { setTab('staff'); setProfileMsg(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-800 mb-5">Account Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Employee ID <span className="text-red-500">*</span></label>
                  <input type="text" value={profile.username} onChange={e => setProfile(p => ({ ...p, username: e.target.value.replace(/[^0-9]/g, '').substring(0, 4) }))}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">New Password <span className="text-gray-400 normal-case font-normal">(leave blank to keep)</span></label>
                  <div className="relative">
                    <input type={showProfilePass ? 'text' : 'password'} placeholder="Enter new password" value={profile.password}
                      onChange={e => setProfile(p => ({ ...p, password: e.target.value }))}
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    <EyeIcon show={showProfilePass} onClick={() => setShowProfilePass(v => !v)} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Confirm Password</label>
                  <div className="relative">
                    <input type={showProfileConfirm ? 'text' : 'password'} placeholder="Re-enter new password" value={profile.confirmPassword}
                      onChange={e => setProfile(p => ({ ...p, confirmPassword: e.target.value }))}
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    <EyeIcon show={showProfileConfirm} onClick={() => setShowProfileConfirm(v => !v)} />
                  </div>
                  {profile.password && profile.confirmPassword && profile.password !== profile.confirmPassword && (
                    <p className="text-xs text-red-500 mt-0.5">Passwords do not match.</p>
                  )}
                </div>
              </div>
              {profileMsg && <p className={`text-sm font-medium mt-4 ${profileMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{profileMsg.text}</p>}
              <div className="flex gap-3 mt-6">
                <button onClick={handleProfileSave} disabled={profileSaving}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                  {profileSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => { setTab('staff'); setProfileMsg(null); }}
                  className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-5">{form.mode === 'create' ? 'Add Account' : 'Edit Account'}</h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Full Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Enter full name" value={form.data.full_name} onChange={e => set('full_name', e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Employee ID <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Enter 4-digit employee ID" value={form.data.username} onChange={e => set('username', e.target.value.replace(/[^0-9]/g, '').substring(0, 4))}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Cost Center <span className="text-red-500">*</span></label>
                <select value={form.data.cost_center} onChange={e => set('cost_center', e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                  <option value="">Select cost center</option>
                  {COST_CENTERS.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Password {form.mode === 'create' ? <span className="text-red-500">*</span> : <span className="text-gray-400 normal-case font-normal">(leave blank to keep)</span>}
                </label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} placeholder={form.mode === 'edit' ? 'Leave blank to keep current' : 'Enter password'}
                    value={form.data.password} onChange={e => set('password', e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  <EyeIcon show={showPass} onClick={() => setShowPass(v => !v)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Confirm Password {form.mode === 'create' ? <span className="text-red-500">*</span> : <span className="text-gray-400 normal-case font-normal">(leave blank to keep)</span>}
                </label>
                <div className="relative">
                  <input type={showConfirm ? 'text' : 'password'} placeholder="Re-enter password"
                    value={form.data.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  <EyeIcon show={showConfirm} onClick={() => setShowConfirm(v => !v)} />
                </div>
                {form.data.password && form.data.confirmPassword && form.data.password !== form.data.confirmPassword && (
                  <p className="text-xs text-red-500 mt-0.5">Passwords do not match.</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {saving ? 'Saving...' : form.mode === 'create' ? 'Create Account' : 'Save Changes'}
              </button>
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <p className="text-base font-bold text-gray-900 mb-2">Delete Account?</p>
            <p className="text-sm text-gray-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(deleteId)} disabled={saving}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {saving ? 'Deleting' : 'Delete'}
              </button>
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {adminClearModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Admin Override � Clear Patient</h3>
            <p className="text-sm text-gray-500 mb-4">
              Clear <span className="font-semibold text-gray-800">{adminClearModal.patient.full_name}</span> ({adminClearModal.patient.patient_no}) at{' '}
              <span className="font-semibold text-emerald-700">{adminClearModal.cost_center}</span>
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Remarks <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
              <textarea rows={2} placeholder="e.g. balance verified and settled"
                value={adminClearRemarks} onChange={e => setAdminClearRemarks(e.target.value)}
                className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleAdminClear} disabled={adminClearSaving}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {adminClearSaving ? 'Clearing...' : 'Confirm Clear'}
              </button>
              <button onClick={() => { setAdminClearModal(null); setAdminClearRemarks(''); }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {adminRemarksModal && (        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Balance Remarks</h3>
                <p className="text-xs text-gray-400 mt-0.5">{adminRemarksModal.full_name} � {adminRemarksModal.patient_no}</p>
                <p className="text-xs text-emerald-600 font-medium mt-0.5">{adminRemarksModal.cost_center}</p>
              </div>
              <button onClick={() => setAdminRemarksModal(null)} className="text-gray-300 hover:text-gray-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-sm text-red-700 leading-relaxed">{adminRemarksModal.balance_remarks}</p>
            </div>
            <button onClick={() => setAdminRemarksModal(null)}
              className="w-full mt-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
      <AdminChatBox />
    </div>
  );
}

const COST_CENTERS = [
  'Operating Room/Delivery Room','Pulmonary Department (MSA)','Hemodialysis Unit',
  'Newborn Screening','Newborn Hearing Test','Radiology','Laboratory','Bloodbank',
  'Pharmacy','Billing - Window 1','Billing - Window 2','Benefits - Window 3A',
  'Benefits - Window 3B','Benefits - Window 6','Billing','Nurse',
];
