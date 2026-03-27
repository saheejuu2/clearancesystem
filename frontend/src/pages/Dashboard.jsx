import { useState } from 'react';

const MOCK_PATIENTS = [
  { id: 'P-0001', name: 'Juan Dela Cruz',    age: 45, ward: 'Ward 3', admitDate: '2026-03-20', status: 'Pending' },
  { id: 'P-0002', name: 'Maria Santos',      age: 32, ward: 'Ward 1', admitDate: '2026-03-22', status: 'Cleared' },
  { id: 'P-0003', name: 'Roberto Reyes',     age: 60, ward: 'Ward 5', admitDate: '2026-03-18', status: 'Pending' },
  { id: 'P-0004', name: 'Ana Gonzales',      age: 28, ward: 'Ward 2', admitDate: '2026-03-25', status: 'For Review' },
  { id: 'P-0005', name: 'Carlos Mendoza',    age: 53, ward: 'Ward 4', admitDate: '2026-03-21', status: 'Cleared' },
  { id: 'P-0006', name: 'Liza Fernandez',    age: 37, ward: 'Ward 3', admitDate: '2026-03-26', status: 'Pending' },
];

const STATUS_STYLES = {
  'Pending':    'bg-yellow-100 text-yellow-700',
  'Cleared':    'bg-green-100 text-green-700',
  'For Review': 'bg-red-100 text-red-700',
};

export default function Dashboard({ user, onLogout }) {
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('All');
  const [wardFilter, setWard]     = useState('All');

  const wards = ['All', ...new Set(MOCK_PATIENTS.map(p => p.ward))];
  const statuses = ['All', 'Pending', 'Cleared', 'For Review'];

  const filtered = MOCK_PATIENTS.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                        p.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    const matchWard   = wardFilter === 'All'   || p.ward === wardFilter;
    return matchSearch && matchStatus && matchWard;
  });

  const counts = {
    total:     MOCK_PATIENTS.length,
    pending:   MOCK_PATIENTS.filter(p => p.status === 'Pending').length,
    cleared:   MOCK_PATIENTS.filter(p => p.status === 'Cleared').length,
    forReview: MOCK_PATIENTS.filter(p => p.status === 'For Review').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Top navbar */}
      <header className="bg-emerald-800 text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="logo" className="w-8 h-8 brightness-0 invert" />
          <div>
            <p className="text-xs text-emerald-300 leading-none">Hospital Clearance System</p>
            <p className="font-semibold text-sm leading-tight">{user.costCenter}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="text-sm bg-emerald-700 hover:bg-emerald-600 px-4 py-1.5 rounded-lg transition-colors"
        >
          Logout
        </button>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Patients',  value: counts.total,     color: 'border-emerald-500 text-emerald-700' },
            { label: 'Pending',         value: counts.pending,   color: 'border-yellow-400 text-yellow-600'  },
            { label: 'Cleared',         value: counts.cleared,   color: 'border-green-500 text-green-700'    },
            { label: 'For Review',      value: counts.forReview, color: 'border-red-400 text-red-600'        },
          ].map(card => (
            <div key={card.label} className={`bg-white rounded-xl border-l-4 ${card.color} p-4 shadow-sm`}>
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className={`text-3xl font-bold ${card.color.split(' ')[1]}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Search & filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search input */}
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by patient name or ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={e => setStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
            >
              {statuses.map(s => <option key={s}>{s}</option>)}
            </select>

            {/* Ward filter */}
            <select
              value={wardFilter}
              onChange={e => setWard(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
            >
              {wards.map(w => <option key={w}>{w}</option>)}
            </select>
          </div>
        </div>

        {/* Patient table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-emerald-50 text-emerald-800 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Patient ID</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Age</th>
                <th className="px-4 py-3 font-semibold">Ward</th>
                <th className="px-4 py-3 font-semibold">Admit Date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">No patients found.</td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-500">{p.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.age}</td>
                    <td className="px-4 py-3 text-gray-600">{p.ward}</td>
                    <td className="px-4 py-3 text-gray-600">{p.admitDate}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[p.status]}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Footer count */}
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            Showing {filtered.length} of {MOCK_PATIENTS.length} patients
          </div>
        </div>

      </main>
    </div>
  );
}
