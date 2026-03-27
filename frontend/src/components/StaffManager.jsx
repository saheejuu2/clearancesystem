import { useState, useEffect } from 'react';
import api from '../services/api';

const EMPTY_FORM = { username: '', full_name: '', password: '', confirmPassword: '' };

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

export default function StaffManager({ costCenter }) {
  const [staff, setStaff]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [form, setForm]           = useState(null);
  const [saving, setSaving]       = useState(false);
  const [deleteId, setDeleteId]   = useState(null);
  const [showPass, setShowPass]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchStaff = () => {
    setLoading(true);
    api.get(`/manage_users.php?action=list&cost_center=${encodeURIComponent(costCenter)}`)
      .then(res => setStaff(Array.isArray(res.data) ? res.data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStaff(); }, [costCenter]);

  const openCreate = () => { setShowPass(false); setShowConfirm(false); setForm({ mode: 'create', data: { ...EMPTY_FORM } }); };
  const openEdit   = (s) => { setShowPass(false); setShowConfirm(false); setForm({ mode: 'edit', data: { id: s.id, username: s.username, full_name: s.full_name, password: '', confirmPassword: '' } }); };

  const handleSave = async () => {
    if (!form.data.username.trim() || !form.data.full_name.trim()) {
      alert('Username and full name are required.');
      return;
    }
    if (form.mode === 'create' && !form.data.password.trim()) {
      alert('Password is required for new accounts.');
      return;
    }
    if (form.data.password && form.data.password !== form.data.confirmPassword) {
      alert('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const action = form.mode === 'create' ? 'create' : 'edit';
      const res = await api.post(`/manage_users.php?action=${action}`, {
        ...form.data,
        cost_center: costCenter,
      });
      if (res.data.success) { setForm(null); fetchStaff(); }
      else alert(res.data.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    setSaving(true);
    try {
      const res = await api.post('/manage_users.php?action=delete', { id });
      if (res.data.success) { setDeleteId(null); fetchStaff(); }
      else alert(res.data.message);
    } finally { setSaving(false); }
  };

  const staffOnly = staff.filter(s => s.role === 'staff');
  const set = (key, val) => setForm(f => ({ ...f, data: { ...f.data, [key]: val } }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Staff Accounts</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage staff under {costCenter}</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 text-sm font-semibold bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Staff
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left">
              {['Username', 'Full Name', 'Created', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={4} className="text-center py-10 text-gray-300 text-sm">Loading…</td></tr>
            ) : staffOnly.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-10 text-gray-300 text-sm">No staff accounts yet.</td></tr>
            ) : staffOnly.map(s => (
              <tr key={s.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{s.username}</td>
                <td className="px-5 py-3.5 font-semibold text-gray-800">{s.full_name}</td>
                <td className="px-5 py-3.5 text-gray-400 text-xs">
                  {new Date(s.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                </td>
                <td className="px-5 py-3.5">
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
        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
          {staffOnly.length} staff account{staffOnly.length !== 1 ? 's' : ''}
        </div>
      </div>

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
                {saving ? 'Saving…' : form.mode === 'create' ? 'Create Account' : 'Save Changes'}
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
                {saving ? 'Deleting…' : 'Delete'}
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
