import { useState } from 'react';
import api from '../services/api';

const COST_CENTERS = [
  'Laboratory', 'Ward', 'Radiology', 'Radio Therapy', 'Procedure',
  'Physical Therapy', 'Pharmacy', 'Out Patient Department', 'Parenatal',
  'Opthalmology', 'Operating Room', 'Nuclear Medicine', 'Neurology',
  'Emergency Room', 'Dermatology', 'Dental', 'Central Supply Room', 'Delivery Room',
];

const OTHER_ROLES = ['Billing', 'Nurse'];

export default function Login({ onLogin }) {
  const [loginType, setLoginType] = useState('cost-center'); // 'cost-center' | 'other'
  const [costCenter, setCostCenter] = useState('');
  const [role, setRole]             = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);

  const handleTypeSwitch = (type) => {
    setLoginType(type);
    setCostCenter('');
    setRole('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const department = loginType === 'cost-center' ? costCenter : role;
    if (!department) {
      setError(loginType === 'cost-center' ? 'Please select a cost center.' : 'Please select a role.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/login.php', { cost_center: department, password });
      if (res.data.success) {
        onLogin({ costCenter: res.data.cost_center });
      } else {
        setError(res.data.message || 'Invalid credentials.');
      }
    } catch {
      setError('Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-emerald-900">

      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex flex-col items-center justify-center flex-[1.4] px-16 gap-8">
        <div className="w-48 h-48 rounded-2xl flex items-center justify-center">
          <img src="/GEAMH LOGO.png" alt="GEAMH Logo" className="w-full h-full object-contain" />
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white leading-snug">
            Hospital Clearance System
          </h1>
          <p className="mt-3 text-white text-base font-medium">
            General Emilio Aguinaldo Memorial Hospital
          </p>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="hidden lg:block w-px bg-white/10 my-12" />

      {/* ── Right form panel ── */}
      <div className="flex flex-1 items-center justify-center p-6 bg-black/20">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-8">
            <img src="/GEAMH LOGO.png" alt="GEAMH Logo" className="w-10 h-10 object-contain" />
            <span className="text-white font-semibold text-lg">Hospital Clearance System</span>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">Sign In</h2>
              <p className="text-sm text-gray-500 mt-1">Select your department to continue</p>
            </div>

            {/* Toggle tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
              <button
                type="button"
                onClick={() => handleTypeSwitch('cost-center')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  loginType === 'cost-center'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Cost Center
              </button>
              <button
                type="button"
                onClick={() => handleTypeSwitch('other')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  loginType === 'other'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Billing / Nurse
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">

              {/* Cost center dropdown */}
              {loginType === 'cost-center' && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="costCenter" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Cost Center
                  </label>
                  <select
                    id="costCenter"
                    value={costCenter}
                    onChange={e => setCostCenter(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  >
                    <option value="">-- Select Cost Center --</option>
                    {COST_CENTERS.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                  </select>
                </div>
              )}

              {/* Billing / Nurse dropdown */}
              {loginType === 'other' && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="role" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Role
                  </label>
                  <select
                    id="role"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  >
                    <option value="">-- Select Role --</option>
                    {OTHER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2.5">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-5.25a.75.75 0 001.5 0v-4a.75.75 0 00-1.5 0v4zm.75-7a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-all mt-1"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
