import { useState } from 'react';

const MOCK_PATIENTS = [
  { id: 'P-0001', name: 'Juan Dela Cruz',  age: 45, ward: 'Ward 3', admitDate: '2026-03-20', status: 'Pending'    },
  { id: 'P-0002', name: 'Maria Santos',    age: 32, ward: 'Ward 1', admitDate: '2026-03-22', status: 'Cleared'    },
  { id: 'P-0003', name: 'Roberto Reyes',   age: 60, ward: 'Ward 5', admitDate: '2026-03-18', status: 'Pending'    },
  { id: 'P-0004', name: 'Ana Gonzales',    age: 28, ward: 'Ward 2', admitDate: '2026-03-25', status: 'For Review' },
  { id: 'P-0005', name: 'Carlos Mendoza',  age: 53, ward: 'Ward 4', admitDate: '2026-03-21', status: 'Cleared'    },
  { id: 'P-0006', name: 'Liza Fernandez',  age: 37, ward: 'Ward 3', admitDate: '2026-03-26', status: 'Pending'    },
];

const STATUS = {
  'Pending':    { pill: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400'  },
  'Cleared':    { pill: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  'For Review': { pill: 'bg-red-100 text-red-600',      dot: 'bg-red-400'    },
};

const STATUSES = ['All', 'Pending', 'Cleared', 'For Review'];

function StatCard({ label, value, accent }) {
  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border-t-4 ${accent}`}>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-4xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

export default function Dashboard({ user, onLogout }) {
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('All');
  const [wardFilter, setWard]       = useState('All');

  const wards    = ['All', ...new Set(MOCK_PATIENTS.map(p => p.ward))];
  const filtered = MOCK_PATIENTS.filter(p => {
    const q = search.toLowerCase();
    return (
      (p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)) &&
      (statusFilter === 'All' || p.status === statusFilter) &&
      (wardFilter   === 'All' || p.ward   === wardFilter)
    );
  });

  const count = (s) => MOCK_PATIENTS.filter(p => p.status === s).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Navbar ── */}
      <header className="bg-emerald-800 shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <img src="/GEAMH LOGO.png" alt="GEAMH Logo" className="w-7 h-7 object-contain" />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] text-emerald-300 font-medium uppercase tracking-widest">Hospital Clearance System</p>
              <p className="text-white font-semibold text-sm">{user.costCenter}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* ── Page title ── */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">Patient Clearance</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage and track patient clearance requests</p>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Patients" value={MOCK_PATIENTS.length} accent="border-emerald-500" />
          <StatCard label="Pending"        value={count('Pending')}     accent="border-amber-400"   />
          <StatCard label="Cleared"        value={count('Cleared')}     accent="border-green-500"   />
          <StatCard label="For Review"     value={count('For Review')}  accent="border-red-400"     />
        </div>

        {/* ── Search & filters ── */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name or patient ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition"
              />
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={e => setStatus(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition sm:w-40"
            >
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>

            {/* Ward filter */}
            <select
              value={wardFilter}
              onChange={e => setWard(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition sm:w-36"
            >
              {wards.map(w => <option key={w}>{w}</option>)}
            </select>
          </div>
        </div>

        {/* ── Table (desktop) / Cards (mobile) ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  {['Patient ID', 'Name', 'Age', 'Ward', 'Admit Date', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-gray-300 text-sm">
                      No patients match your search.
                    </td>
                  </tr>
                ) : filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/70 transition-colors group">
                    <td className="px-5 py-4 font-mono text-xs text-gray-400">{p.id}</td>
                    <td className="px-5 py-4 font-semibold text-gray-800">{p.name}</td>
                    <td className="px-5 py-4 text-gray-500">{p.age}</td>
                    <td className="px-5 py-4 text-gray-500">{p.ward}</td>
                    <td className="px-5 py-4 text-gray-500">{p.admitDate}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS[p.status].pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS[p.status].dot}`} />
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <p className="text-center py-12 text-gray-300 text-sm">No patients match your search.</p>
            ) : filtered.map(p => (
              <div key={p.id} className="p-4 flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{p.id}</p>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                    <span>{p.ward}</span>
                    <span>·</span>
                    <span>Age {p.age}</span>
                    <span>·</span>
                    <span>{p.admitDate}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS[p.status].pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS[p.status].dot}`} />
                    {p.status}
                  </span>
                  <button className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Showing <span className="font-semibold text-gray-600">{filtered.length}</span> of <span className="font-semibold text-gray-600">{MOCK_PATIENTS.length}</span> patients
            </p>
            {(search || statusFilter !== 'All' || wardFilter !== 'All') && (
              <button
                onClick={() => { setSearch(''); setStatus('All'); setWard('All'); }}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-medium transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
