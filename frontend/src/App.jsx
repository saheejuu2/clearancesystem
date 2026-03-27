import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';

function App() {
  const [user, setUser] = useState(null);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <nav style={{ padding: '10px', background: '#f4f4f4', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Logged in as: <strong>{user.costCenter}</strong></span>
        <button onClick={handleLogout} style={{ cursor: 'pointer' }}>Logout</button>
      </nav>

      <div style={{ padding: '20px' }}>
        <Routes>
          <Route path="/cost-center" element={<h1>Step 3: {user.costCenter} Clearance</h1>} />
          <Route path="*" element={<Navigate to="/cost-center" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
