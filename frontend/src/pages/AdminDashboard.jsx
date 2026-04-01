import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import PhClock from '../components/PhClock';
import AuditTrail from '../components/AuditTrail';

const COST_CENTERS = [
  'Operating Room/Delivery Room',
  'Pulmonary Department (MSA)',
  'Hemodialysis Unit',
  'Newborn Screening',
  'Newborn Hearing Test',
  'Radiology',
  'Laboratory',
  'Bloodbank',
  'Pharmacy',
  'Billing - Window 1',
  'Billing - Window 2',
  'Benefits - Window 3A',
  'Benefits - Window 3B',
  'Benefits - Window 6',
  'Billing',
  'Nurse',
];

const EMPTY_FORM = { username: '', full_name: '', password: '', confirmPassword: '', cost_center: '' };

const EyeIcon = ({ show, onClick }) => (
  <button type="button" onClick={onClick}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
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
  const [tab, setTab]             = useState('staff');
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

  // Profile settings state
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
    const close = (e) => {
      if (ccRef.current && !ccRef.current.contains(e.target)) setCcOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ccOpen]);

  const filtered = allStaff.filter(s => {
    const matchCC = activeCC === 'All' || s.cost_center === activeCC;
    const q = search.toLowerCase();
    const matchQ = !q || s.username.toLowerCase().includes(q) || s.full_name.toLowerCase().includes(q) || s.cost_center.toLowerCase().includes(q);
    return matchCC && matchQ;
  });

  const openCreate = () => {
    setShowPass(false); setShowConfirm(false);
    setForm({ mode: 'create', data: { ...EMPTY_FORM, cost_center: activeCC !== 'All' ? activeCC : '' } });
  };
  const openEdit = (s) => {
    setShowPass(false); setShowConfirm(false);
    setForm({ mode: 'edit', data: { id: s.id, username: s.username, full_name: s.full_name, cost_center: s.cost_center, password: '', confirmPassword: '' } });
  };
  const set = (key, val) => setForm(f => ({ ...f, data: { ...f.data, [key]: val } }));

  const handleSave = async () => {
    const { username, full_name, password, confirmPassword, cost_center } = form.data;
    if (!username.trim() || !full_name.trim() || !cost_center) {
      alert('Username, full name, and cost center are required.');
      return;
    }
    if (form.mode === 'create' && !password.trim()) {
      alert('Password is required for new accounts.');
      return;
    }
    if (password && password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const action = form.mode === 'create' ? 'create' : 'edit';
      const res = await api.post(`/manage_users.php?action=${action}`, form.data);
      if (res.data.success) { setForm(null); fetchAll(); }
      else alert(res.data.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    setSaving(true);
    try {
      const res = await api.post('/manage_users.php?action=delete', { id });
      if (res.data.success) { setDeleteId(null); fetchAll(); }
      else alert(res.data.message);
    } finally { setSaving(false); }
  };

  const handleProfileSave = async () => {
    if (!profile.username.trim() || !profile.full_name.trim()) {
      setProfileMsg({ ok: false, text: 'Username and full name are required.' });
      return;
    }
    if (profile.password && profile.password !== profile.confirmPassword) {
      setProfileMsg({ ok: false, text: 'Passwords do not match.' });
      return;
    }
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await api.post('/update_profile.php', { id: user.id, ...profile });
      if (res.data.success) {
        setProfileMsg({ ok: true, text: 'Profile updated successfully.' });
        setProfile(p => ({ ...p, password: '', confirmPassword: '' }));
      } else {
        setProfileMsg({ ok: false, text: res.data.message });
      }
    } finally { setProfileSaving(false); }
  };

  const tabs = ['All', ...COST_CENTERS];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header â€” matches staff dashboard */}
      <header className="bg-emerald-800 sticky top-0 z-10 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}GEAMH LOGO.png`} alt="logo" className="w-7 h-7 object-contain" />
            <div className="leading-tight">
              <p className="text-[10px] text-emerald-300 uppercase tracking-widest">Hospital Clearance System</p>
              <p className="text-white font-semibold text-sm">Admin Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PhClock />
            <button onClick={() => setTab('profile')}
              title="Profile Settings"
              className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button onClick={onLogout}
              className="text-sm text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      {tab !== 'profile' && (
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1">
          {[['staff', 'Staff Accounts'], ['audit', 'Audit Trail']].map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); if (key === 'audit') setAuditKey(k => k + 1); }}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">

        {tab === 'audit' && <AuditTrail key={auditKey} role="admin" />}

        {tab === 'profile' && (
          <div className="flex flex-col gap-6">
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
              <button onClick={() => { setTab('staff'); setProfileMsg(null); }}
                className="text-gray-400 hover:text-gray-600 transition-colors" title="Close">
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
                  <input type="text" value={profile.full_name}
                    onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Username <span className="text-red-500">*</span></label>
                  <input type="text" value={profile.username}
                    onChange={e => setProfile(p => ({ ...p, username: e.target.value }))}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    New Password <span className="text-gray-400 normal-case font-normal">(leave blank to keep current)</span>
                  </label>
                  <div className="relative">
                    <input type={showProfilePass ? 'text' : 'password'}
                      placeholder="Enter new password"
                      value={profile.password}
                      onChange={e => setProfile(p => ({ ...p, password: e.target.value }))}
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    <EyeIcon show={showProfilePass} onClick={() => setShowProfilePass(v => !v)} />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Confirm Password <span className="text-gray-400 normal-case font-normal">(leave blank to keep current)</span>
                  </label>
                  <div className="relative">
                    <input type={showProfileConfirm ? 'text' : 'password'}
                      placeholder="Re-enter new password"
                      value={profile.confirmPassword}
                      onChange={e => setProfile(p => ({ ...p, confirmPassword: e.target.value }))}
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    <EyeIcon show={showProfileConfirm} onClick={() => setShowProfileConfirm(v => !v)} />
                  </div>
                  {profile.password && profile.confirmPassword && profile.password !== profile.confirmPassword && (
                    <p className="text-xs text-red-500 mt-0.5">Passwords do not match.</p>
                  )}
                </div>
              </div>

              {profileMsg && (
                <p className={`text-sm font-medium mt-4 ${profileMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                  {profileMsg.text}
                </p>
              )}

              <div className="flex gap-3 mt-6">
                <button onClick={handleProfileSave} disabled={profileSaving}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                  {profileSaving ? 'Saving…' : 'Save Changes'}
                </button>
                <button onClick={() => { setTab('staff'); setProfileMsg(null); }}
                  className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'staff' && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Staff Accounts</h1>
              <p className="text-sm text-gray-400 mt-0.5">Manage all staff accounts across every cost center</p>
            </div>

            {/* Toolbar */}
            <div className="flex gap-3 items-center">
              <input
                type="text"
                placeholder="Search by name, username, or cost center..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
              />
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
                      {['Username', 'Full Name', 'Cost Center', 'Created', 'Actions'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={5} className="text-center py-12 text-gray-300 text-sm">Loadingâ€¦</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-gray-300 text-sm">No staff accounts found.</td></tr>
                    ) : filtered.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs text-gray-400">{s.username}</td>
                        <td className="px-5 py-4 font-semibold text-gray-800">{s.full_name}</td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-medium bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">
                            {s.cost_center}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-500 text-xs">
                          {new Date(s.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex gap-2">
                            <button onClick={() => openEdit(s)}
                              className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                              Edit
                            </button>
                            <button onClick={() => setDeleteId(s.id)}
                              className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                Showing {filtered.length} of {allStaff.length} staff account{allStaff.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Create / Edit modal */}
      {form && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-5">
              {form.mode === 'create' ? 'Add Staff Account' : 'Edit Staff Account'}
            </h3>
            <div className="flex flex-col gap-4">

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Full Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Enter full name" value={form.data.full_name}
                  onChange={e => set('full_name', e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Username <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Enter username" value={form.data.username}
                  onChange={e => set('username', e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Cost Center <span className="text-red-500">*</span></label>
                <select value={form.data.cost_center} onChange={e => set('cost_center', e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                  <option value="">Select cost centerâ€¦</option>
                  {COST_CENTERS.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Password {form.mode === 'create' ? <span className="text-red-500">*</span> : <span className="text-gray-400 normal-case font-normal">(leave blank to keep current)</span>}
                </label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'}
                    placeholder={form.mode === 'edit' ? 'Leave blank to keep current' : 'Enter password'}
                    value={form.data.password}
                    onChange={e => set('password', e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  <EyeIcon show={showPass} onClick={() => setShowPass(v => !v)} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Confirm Password {form.mode === 'create' ? <span className="text-red-500">*</span> : <span className="text-gray-400 normal-case font-normal">(leave blank to keep current)</span>}
                </label>
                <div className="relative">
                  <input type={showConfirm ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={form.data.confirmPassword}
                    onChange={e => set('confirmPassword', e.target.value)}
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
                {saving ? 'Savingâ€¦' : form.mode === 'create' ? 'Create Account' : 'Save Changes'}
              </button>
              <button onClick={() => setForm(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <p className="text-base font-bold text-gray-900 mb-2">Delete Staff Account?</p>
            <p className="text-sm text-gray-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(deleteId)} disabled={saving}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {saving ? 'Deletingâ€¦' : 'Delete'}
              </button>
              <button onClick={() => setDeleteId(null)}
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



