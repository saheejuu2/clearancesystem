export default function NavBtn({ tabKey, label, active, setTab, d }) {
  const isActive = active === tabKey;
  return (
    <button onClick={() => setTab(tabKey)}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left w-full ${
        isActive ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
      }`}>
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      </svg>
      {label}
    </button>
  );
}
