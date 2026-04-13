export default function Pagination({ page, totalPages, total, start, pageSize, onPage }) {
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
      <span>
        Showing {start + 1}–{Math.min(start + pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          className="px-2 py-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          ‹
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`e${i}`} className="px-2">…</span>
          ) : (
            <button key={p} onClick={() => onPage(p)}
              className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${p === page ? 'bg-emerald-700 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
              {p}
            </button>
          )
        )}
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
          className="px-2 py-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          ›
        </button>
      </div>
    </div>
  );
}
