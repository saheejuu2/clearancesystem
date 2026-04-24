import { useState, useEffect } from 'react';
import api from '../services/api';
import PhClock from '../components/PhClock';
import SearchBar from '../components/SearchBar';
import DateFilter from '../components/DateFilter';
import PatientInfoModal from '../components/PatientInfoModal';
import NotificationBell from '../components/NotificationBell';

const STEP_LABEL = {
  awaiting_coder:       { label: 'For Coding',     style: 'bg-indigo-100 text-indigo-600' },
  awaiting_billing:     { label: 'Forwarded',       style: 'bg-blue-100 text-blue-600'    },
  cost_center_clearing: { label: 'Clearance',       style: 'bg-amber-100 text-amber-600'  },
  discharged:           { label: 'Discharged',      style: 'bg-emerald-100 text-emerald-700' },
};

export default function CoderDashboard({ user, onLogout }) {
  const [patients, setPatients]         = useState([]);
  const [loading, setLoading]           = useState(false);
  const [search, setSearch]             = useState('');
  const [filterDate, setFilterDate]     = useState(() => sessionStorage.getItem('coder_filterDate') || new Date().toISOString().split('T')[0]);
  const [typeFilter, setTypeFilter]     = useState(() => sessionStorage.getItem('coder_typeFilter') || '');
  const [viewPatient, setViewPatient]   = useState(null);
  const [viewClearances, setViewClearances] = useState([]);
  const [actionId, setActionId]         = useState(null);
  const [proceedForm, setProceedForm]   = useState(null);
  const [returnForm, setReturnForm]     = useState(null); // { patientId, patientName, remarks }

  const setFilterDateP = (v) => { sessionStorage.setItem('coder_filterDate', v); setFilterDate(v); };
  const setTypeFilterP = (v) => { sessionStorage.setItem('coder_typeFilter', v); setTypeFilter(v); };

  const fetchPatients = async (date) => {
    setLoading(true);
    const d = date || filterDate;
    try {
      const dateParam = d === 'all' ? 'all_dates=1' : `date=${d}`;
      const res = await api.get(`/get_patients.php?role=Coder&${dateParam}`);
      setPatients(res.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPatients(); }, []);

  const submitProceed = async () => {
    setActionId(proceedForm.patientId);
    try {
      const res = await api.post('/update_clearance.php', {
        action:            'proceed_to_billing',
        patient_id:        proceedForm.patientId,
        actor:             user.username,
        icd10_code:        proceedForm.icd10_code?.trim() || '',
        icd10_description: proceedForm.icd10_description?.trim() || '',
        case_type:         proceedForm.case_type || '',
        procedure_done:    proceedForm.procedure_done?.trim() || '',
        remarks:           proceedForm.remarks?.trim() || '',
      });
      if (res.data.success) { setProceedForm(null); fetchPatients(); }
      else alert(res.data.message);
    } finally { setActionId(null); }
  };

  const submitReturnToNurse = async () => {
    if (!returnForm.remarks.trim()) { alert('Please enter a reason.'); return; }
    setActionId(returnForm.patientId);
    try {
      const res = await api.post('/update_clearance.php', {
        action:     'coder_return_to_nurse',
        patient_id: returnForm.patientId,
        actor:      user.username,
        remarks:    returnForm.remarks.trim(),
      });
      if (res.data.success) { setReturnForm(null); fetchPatients(); }
      else alert(res.data.message);
    } finally { setActionId(null); }
  };

  const openPatientInfo = async (p) => {
    setViewPatient(p);
    try {
      const r = await api.get('/get_clearance_report.php?patient_id=' + p.id);
      setViewClearances(r.data.success ? r.data.clearances : []);
    } catch { setViewClearances([]); }
  };

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    const matchQ    = !q || p.full_name.toLowerCase().includes(q) || p.patient_no.toLowerCase().includes(q);
    const matchType = !typeFilter || p.patient_type === typeFilter;
    return matchQ && matchType;
  });

  const pendingCount = patients.filter(p => p.clearance_step === 'awaiting_coder').length;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <header className="bg-indigo-800 sticky top-0 z-10 shadow">
        <div className="w-full px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}GEAMH-LOGO.png`} alt="logo" className="w-7 h-7 object-contain" />
            <div className="leading-tight">
              <p className="text-[10px] text-indigo-300 uppercase tracking-widest">Hospital Clearance System</p>
              <p className="text-white font-semibold text-sm">Medical Coder</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PhClock />
            <NotificationBell recipient="Coder" onNotificationClick={() => {}} />
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-56 shrink-0 bg-white border-r border-gray-100 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Coding</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">Medical Coder</p>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pb-1">Filter by Type</p>
            {[
              { value: '',           label: 'All Patients', dot: 'bg-gray-400'  },
              { value: 'in-patient', label: 'In-Patient',   dot: 'bg-blue-400'  },
              { value: 'er',         label: 'ER',           dot: 'bg-red-400'   },
              { value: 'opd',        label: 'OPD',          dot: 'bg-green-400' },
            ].map(t => (
              <button key={t.value} onClick={() => setTypeFilterP(t.value)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left w-full ${typeFilter === t.value ? 'bg-indigo-700 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${typeFilter === t.value ? 'bg-white' : t.dot}`} />
                <span className="flex-1">{t.label}</span>
                {t.value !== '' && patients.filter(p => p.patient_type === t.value).length > 0 && (
                  <span className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${typeFilter === t.value ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-600'}`}>
                    {patients.filter(p => p.patient_type === t.value).length}
                  </span>
                )}
              </button>
            ))}
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
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-800">Patient List</h1>
                <p className="text-sm text-gray-400 mt-0.5">Review and forward patients to billing after coding</p>
              </div>
              {pendingCount > 0 && (
                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full">
                  {pendingCount} for coding
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <SearchBar value={search} onChange={setSearch} placeholder="Search by name or hospital no." />
              <div className="flex items-center gap-2 shrink-0">
                {filterDate !== 'all' && (
                  <DateFilter value={filterDate} onChange={d => { setFilterDateP(d); fetchPatients(d); }} />
                )}
                <button
                  onClick={() => {
                    const next = filterDate === 'all' ? new Date().toISOString().split('T')[0] : 'all';
                    setFilterDateP(next);
                    fetchPatients(next);
                  }}
                  className={`text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap ${filterDate === 'all' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  All Dates
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {['Hospital No.', 'Name of Patient', 'Service', 'Accommodation', 'Admit Date', 'Type', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={8} className="text-center py-12 text-gray-300 text-sm">Loading...</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-gray-300 text-sm">No patients found.</td></tr>
                    ) : filtered.map(p => {
                      const step = STEP_LABEL[p.clearance_step] || STEP_LABEL['awaiting_coder'];
                      return (
                        <tr key={p.id} onClick={() => openPatientInfo(p)} className="hover:bg-gray-50/70 transition-colors cursor-pointer">
                          <td className="px-4 py-3.5 font-mono text-xs text-gray-400 whitespace-nowrap">{p.patient_no}</td>
                          <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">{p.full_name}</td>
                          <td className="px-4 py-3.5 text-gray-500 text-center whitespace-nowrap">{p.service_type || '—'}</td>
                          <td className="px-4 py-3.5 text-gray-500 text-center whitespace-nowrap">{p.accom_type || '—'}</td>
                          <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                            {p.admit_date ? new Date(p.admit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${p.patient_type === 'er' ? 'bg-red-100 text-red-600' : p.patient_type === 'opd' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                              {p.patient_type === 'er' ? 'ER' : p.patient_type === 'opd' ? 'OPD' : 'In-Patient'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${step.style}`}>{step.label}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            {p.clearance_step === 'awaiting_coder' && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={e => { e.stopPropagation(); setProceedForm({ patientId: p.id, patientName: p.full_name, icd10_code: '', icd10_description: '', case_type: '', procedure_done: '', remarks: '' }); }}
                                  disabled={actionId === p.id}
                                  className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                  Proceed to Clearance
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); setReturnForm({ patientId: p.id, patientName: p.full_name, remarks: '' }); }}
                                  disabled={actionId === p.id}
                                  className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                  Return to Nurse
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      <PatientInfoModal patient={viewPatient} clearances={viewClearances} onClose={() => { setViewPatient(null); setViewClearances([]); }} />

      {/* Proceed to Clearance Confirm Modal */}
      {proceedForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Proceed to Clearance</h3>
            <p className="text-sm text-gray-500 mb-5">
              Forward <span className="font-semibold text-gray-800">{proceedForm.patientName}</span> to billing for clearance processing.
            </p>
            <div className="flex flex-col gap-4">

              {/* ICD-10 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">ICD-10 Code</label>
                  <input type="text" placeholder="e.g. J18.9"
                    value={proceedForm.icd10_code}
                    onChange={e => setProceedForm(f => ({ ...f, icd10_code: e.target.value.toUpperCase() }))}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono" />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Diagnosis Description</label>
                  <input type="text" placeholder="e.g. Pneumonia, unspecified"
                    value={proceedForm.icd10_description}
                    onChange={e => setProceedForm(f => ({ ...f, icd10_description: e.target.value }))}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>

              {/* Case Type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Case Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Ordinary', 'Catastrophic', 'TB-DOTS', 'Z Benefit', 'Case Rate', 'Per Diem'].map(ct => (
                    <label key={ct} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors text-sm ${proceedForm.case_type === ct ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <input type="radio" name="case_type" value={ct}
                        checked={proceedForm.case_type === ct}
                        onChange={() => setProceedForm(f => ({ ...f, case_type: ct }))}
                        className="accent-indigo-600 shrink-0" />
                      {ct}
                    </label>
                  ))}
                </div>
              </div>

              {/* Procedure */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Procedure Done <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
                <input type="text" placeholder="e.g. Appendectomy, Caesarean Section"
                  value={proceedForm.procedure_done}
                  onChange={e => setProceedForm(f => ({ ...f, procedure_done: e.target.value }))}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>

              {/* Remarks */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Remarks <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
                <textarea placeholder="Additional notes for billing..."
                  rows={2}
                  value={proceedForm.remarks}
                  onChange={e => setProceedForm(f => ({ ...f, remarks: e.target.value }))}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={submitProceed} disabled={actionId === proceedForm.patientId}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {actionId === proceedForm.patientId ? 'Processing...' : 'Confirm & Forward to Billing'}
              </button>
              <button onClick={() => setProceedForm(null)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Return to Nurse Modal */}
      {returnForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Return to Nurse</h3>
            <p className="text-sm text-gray-500 mb-5">
              Return <span className="font-semibold text-gray-800">{returnForm.patientName}</span> to the nurse for correction or additional information.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Reason <span className="text-red-500">*</span></label>
              <textarea placeholder="e.g. incomplete diagnosis, missing information"
                rows={3}
                value={returnForm.remarks}
                onChange={e => setReturnForm(f => ({ ...f, remarks: e.target.value }))}
                className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={submitReturnToNurse} disabled={actionId === returnForm.patientId}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {actionId === returnForm.patientId ? 'Returning...' : 'Confirm Return'}
              </button>
              <button onClick={() => setReturnForm(null)}
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
