import { useState } from 'react';
import Login from './pages/Login';
import NurseDashboard from './pages/NurseDashboard';
import BillingDashboard from './pages/BillingDashboard';
import CostCenterDashboard from './pages/CostCenterDashboard';

const COST_CENTERS = [
  'Laboratory','Ward','Radiology','Radio Therapy','Procedure',
  'Physical Therapy','Pharmacy','Out Patient Department','Parenatal',
  'Opthalmology','Operating Room','Nuclear Medicine','Neurology',
  'Emergency Room','Dermatology','Dental','Central Supply Room','Delivery Room',
];

function App() {
  const [user, setUser] = useState(null);

  if (!user) return <Login onLogin={setUser} />;

  const logout = () => setUser(null);

  if (user.costCenter === 'Nurse')   return <NurseDashboard   user={user} onLogout={logout} />;
  if (user.costCenter === 'Billing') return <BillingDashboard user={user} onLogout={logout} />;
  if (COST_CENTERS.includes(user.costCenter)) return <CostCenterDashboard user={user} onLogout={logout} />;

  return <div className="p-8 text-gray-500">Unknown role: {user.costCenter}</div>;
}

export default App;
