import { useState } from 'react';
import api from '../services/api';
import './Login.css';

const COST_CENTERS = [
  'Laboratory', 'Ward', 'Radiology', 'Radio Therapy', 'Procedure',
  'Physical Therapy', 'Pharmacy', 'Out Patient Department', 'Parenatal',
  'Opthalmology', 'Operating Room', 'Nuclear Medicine', 'Neurology',
  'Emergency Room', 'Dermatology', 'Dental', 'Central Supply Room', 'Delivery Room',
];

export default function Login({ onLogin }) {
  const [costCenter, setCostCenter] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!costCenter) {
      setError('Please select a cost center.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/login.php', { cost_center: costCenter, password });
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
    <div className="login-wrapper">
      {/* Left branding panel */}
      <div className="login-left">
        <img src="/favicon.svg" alt="Hospital Logo" className="brand-logo" />
        <h1>Hospital Clearance System</h1>
        <p>Streamlining patient discharge clearance across all hospital departments.</p>
      </div>

      <div className="login-divider" />

      {/* Right form panel */}
      <div className="login-right">
        <div className="login-card">
          <div className="login-card-header">
            <h2>Cost Center Login</h2>
            <p>Select your department and enter your password</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="costCenter">Cost Center</label>
              <select
                id="costCenter"
                value={costCenter}
                onChange={(e) => setCostCenter(e.target.value)}
                required
              >
                <option value="">-- Select Cost Center --</option>
                {COST_CENTERS.map((cc) => (
                  <option key={cc} value={cc}>{cc}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>

            {error && <p className="login-error" role="alert">{error}</p>}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
