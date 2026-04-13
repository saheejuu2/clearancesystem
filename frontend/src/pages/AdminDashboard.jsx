import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import PhClock from '../components/PhClock';
import AuditTrail from '../components/AuditTrail';
import NotificationBell from '../components/NotificationBell';
import NavBtn from '../components/NavBtn';
import DashboardOverview from '../components/DashboardOverview';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';

const STEP_LABELS = {
  no_request:           { label: 'Admitted',         style: 'bg-gray-100 text-gray-500'       },
  awaiting_nurse:       { label: 'Admitted',         style: 'bg-gray-100 text-gray-500'       },
  awaiting_billing:     { label: 'Awaiting Billing', style: 'bg-amber-100 text-amber-600'     },
  cost_center_clearing: { label: 'In Clearance',     style: 'bg-violet-100 text-violet-600'   },
  discharged:           { label: 'Discharged',       style: 'bg-emerald-100 text-emerald-700' },
};

const TAB_CONFIG = {
  total:           { title: 'Total Patients',    subtitle: 'All patients in the system',                   filter: p => true },
  admitted:        { title: 'Admitted',          subtitle: 'Patients not yet in discharge process',        filter: p => p.clearance_step === 'no_request' || p.clearance_step === 'awaiting_nurse' },
  awaiting_billing:{ title: 'Awaiting Billing',  subtitle: 'Nurse approved — waiting for billing',         filter: p => p.clearance_step === 'awaiting_billing' },
  in_clearance:    { title: 'In Clearance',      subtitle: 'Currently being cleared by cost centers',      filter: p => p.clearance_step === 'cost_center_clearing' },
  pending:         { title: 'Pending',           subtitle: 'Patients with missing requirements sent back',  filter: p => p.has_pending && p.clearance_step === 'cost_center_clearing' },
  cleared:         { title: 'Cleared Patients',  subtitle: 'All cost centers have cleared these patients',  filter: p => p.clearance_step === 'cost_center_clearing' && parseInt(p.pending_count) === 0 && parseInt(p.total_cc) > 0 },
  discharged:      { title: 'Discharged',        subtitle: 'Successfully discharged patients',             filter: p => p.clearance_step === 'discharged' },
};

function AdminPatientList({ tab }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const cfg = TAB_CONFIG[tab];

  useEffect(() => {
    setLoading(true);
    api.get('/get_patients.php?role=Admin')
      .then(res => setPatients(res.data || []))
      .finally(() => setLoading(false));
  }, [tab]);

  const filtered = patients
    .filter(cfg.filter)
    .filter(p => p.full_name.toLowerCase().includes(search.toLowerCase()) || p.patient_no.toLowerCase().includes(search.toLowerCase()));
  const { paged, page, setPage, totalPages, total, start, pageSize } = usePagination(filtered);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">{cfg.title}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{cfg.subtitle}</p>
      </div>
      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by name or patient ID..."
        className="w-full max-w-sm px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                {['Patient ID','Name','Age','Ward','Admit Date','Type','Status'].map(h => (
                  <th key={h} className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">No patients found.</td></tr>
              ) : paged.map(p => {
                const step = STEP_LABELS[p.clearance_step] || STEP_LABELS['no_request'];
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} start={start} pageSize={pageSize} onPage={setPage} />
      </div>
    </div>
  );
}

const COST_CENTERS = [
  'Operating Room/Delivery Room','Pulmonary Department (MSA)','Hemodialysis Unit',
  'Newborn Screening','Newborn Hearing Test','Radiology','Laboratory','Bloodbank',
  'Pharmacy','Billing - Window 1','Billing - Window 2','Benefits - Window 3A',
  'Benefits - Window 3B','Benefits - Window 6','Billing','Nurse',
];

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

  const fetchAll = () => {
    setLoading(true);
    api.get('/manage_users.php?action=list_all')
      .then(res => setAllStaff(Array.isArray(res.data) ? res.data : []))
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchAll(); }, []);
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
            <NavBtn compact tabKey="admitted"         label="Admitted"         active={tab} setTab={setTab} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            <NavBtn compact tabKey="awaiting_billing" label="Awaiting Billing" active={tab} setTab={setTab} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            <NavBtn compact tabKey="in_clearance"     label="In Clearance"     active={tab} setTab={setTab} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            <NavBtn compact tabKey="pending"          label="Pending"          active={tab} setTab={setTab} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <NavBtn compact tabKey="cleared"          label="Cleared Patients" active={tab} setTab={setTab} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            <NavBtn compact tabKey="discharged"       label="Discharged"       active={tab} setTab={setTab} d="M5 13l4 4L19 7" />
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2 pt-2 pb-0.5">Management</p>
            <NavBtn compact tabKey="staff" label="Staff Accounts" active={tab} setTab={setTab} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
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
          {PATIENT_TABS.includes(tab) && <AdminPatientList tab={tab} />}

          {tab === 'staff' && (
            <div className="flex flex-col gap-5">
              <div>
                <h1 className="text-xl font-bold text-gray-800">Staff Accounts</h1>
                <p className="text-sm text-gray-400 mt-0.5">Manage all staff accounts across every cost center</p>
              </div>
              <div className="flex gap-3 items-center">
                <input type="text" placeholder="Search by name, username, or cost center..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
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
                  Add Staff
                </button>
              </div>
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-left">
                        {['Username','Full Name','Cost Center','Created','Actions'].map(h => (
                          <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
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
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Username <span className="text-red-500">*</span></label>
                  <input type="text" value={profile.username} onChange={e => setProfile(p => ({ ...p, username: e.target.value }))}
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
            <h3 className="text-base font-bold text-gray-900 mb-5">{form.mode === 'create' ? 'Add Staff Account' : 'Edit Staff Account'}</h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Full Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Enter full name" value={form.data.full_name} onChange={e => set('full_name', e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Username <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Enter username" value={form.data.username} onChange={e => set('username', e.target.value)}
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
            <p className="text-base font-bold text-gray-900 mb-2">Delete Staff Account?</p>
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
    </div>
  );
}
