import { useState, useCallback } from 'react';
import Login from './pages/Login';
import NurseDashboard from './pages/NurseDashboard';
import BillingDashboard from './pages/BillingDashboard';
import CostCenterDashboard from './pages/CostCenterDashboard';
import IdleLockScreen from './components/IdleLockScreen';
import useIdleTimeout from './hooks/useIdleTimeout';

const COST_CENTERS = [
  'Laboratory','Ward','Radiology','Radio Therapy','Procedure',
  'Physical Therapy','Pharmacy','Out Patient Department','Parenatal',
  'Opthalmology','Operating Room','Nuclear Medicine','Neurology',
  'Emergency Room','Dermatology','Dental','Central Supply Room','Delivery Room',
];

function AppContent({ user, onLogout }) {
  const [locked, setLocked] = useState(false);

  const handleIdle = useCallback(() => setLocked(true), []);
  useIdleTimeout(handleIdle, 2 * 60 * 1000);

  const dashboard = () => {
    if (user.costCenter === 'Nurse')   return <NurseDashboard   user={user} onLogout={onLogout} />;
    if (user.costCenter === 'Billing') return <BillingDashboard user={user} onLogout={onLogout} />;
    if (COST_CENTERS.includes(user.costCenter)) return <CostCenterDashboard user={user} onLogout={onLogout} />;
    return <div className="p-8 text-gray-500">Unknown role: {user.costCenter}</div>;
  };

  return (
    <>
      {dashboard()}
      {locked && <IdleLockScreen user={user} onUnlock={() => setLocked(false)} />}
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(null);

  if (!user) return <Login onLogin={setUser} />;
  return <AppContent user={user} onLogout={() => setUser(null)} />;
}
