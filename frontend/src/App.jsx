import { useState, useCallback } from 'react';
import Login from './pages/Login';
import NurseDashboard from './pages/NurseDashboard';
import BillingDashboard from './pages/BillingDashboard';
import CostCenterDashboard from './pages/CostCenterDashboard';
import AdminDashboard from './pages/AdminDashboard';
import CoderDashboard from './pages/CoderDashboard';
import IdleLockScreen from './components/IdleLockScreen';
import useIdleTimeout from './hooks/useIdleTimeout';

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
  'Endoscopy',
  'Colonoscopy',
  'Physical Therapy',
  'Benefits',
  'Billing - Window 1',
  'Billing - Window 2',
  'Benefits - Window 3A',
  'Benefits - Window 3B',
  'Benefits - Window 6',
  'MAB',
];

const dashboard = ({ user, onLogout }) => {
  if (user.role === 'admin')           return <AdminDashboard    user={user} onLogout={onLogout} />;
  if (user.costCenter === 'Nurse')     return <NurseDashboard    user={user} onLogout={onLogout} />;
  if (['ER Nurse','OB Nurse','Pediatrics Nurse','Medical Nurse','Surgery Nurse'].includes(user.costCenter)) return <NurseDashboard user={user} onLogout={onLogout} />;
  if (user.costCenter === 'Billing')   return <BillingDashboard  user={user} onLogout={onLogout} />;
  if (user.costCenter === 'Coder')     return <CoderDashboard    user={user} onLogout={onLogout} />;
  if (COST_CENTERS.includes(user.costCenter)) return <CostCenterDashboard user={user} onLogout={onLogout} />;
  return <div className="p-8 text-gray-500">Unknown role: {user.costCenter}</div>;
};

function AppContent({ user, onLogout }) {
  const [locked, setLocked] = useState(false);

  // IDLE LOCK DISABLED — re-enable by removing the `false &&` guards below
  const handleIdle = useCallback(() => {}, []); // setLocked(true) disabled
  const { warning, countdown, resetTimer } = useIdleTimeout(handleIdle, 2 * 60 * 1000);

  return (
    <>
      {dashboard({ user, onLogout: () => onLogout() })}
      {false && warning && !locked && (
        <div className="fixed bottom-6 right-6 z-[90] bg-amber-500 text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4 max-w-sm">
          <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold">Session locking in {countdown}s</p>
            <p className="text-xs opacity-80">Move your mouse to stay active</p>
          </div>
          <button onClick={resetTimer} className="text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors">
            Stay
          </button>
        </div>
      )}
      {false && locked && <IdleLockScreen user={user} onUnlock={() => setLocked(false)} />}
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const handleLogin = (userData) => {
    sessionStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    setUser(null);
  };

  if (!user) return <Login onLogin={handleLogin} />;
  return <AppContent user={user} onLogout={handleLogout} />;
}
