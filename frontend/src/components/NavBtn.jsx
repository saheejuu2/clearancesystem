export default function NavBtn({ tabKey, label, active, setTab, d, compact, badge }) {
  const isActive = active === tabKey;
  return (
    <button onClick={() => setTab(tabKey)}
      className={`flex items-center gap-3 px-3 rounded-xl text-sm font-semibold transition-colors text-left w-full ${compact ? 'py-1.5' : 'py-2.5'} ${
        isActive ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
      }`}>
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      </svg>
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
