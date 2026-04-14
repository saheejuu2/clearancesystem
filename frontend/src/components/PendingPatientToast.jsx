import { useState, useEffect, useRef } from 'react';

// Shows a persistent toast for each uncleared patient until they are cleared
export default function PendingPatientToast({ patients = [], enabled = true }) {
  const [toasts, setToasts] = useState([]);
  const shownRef = useRef(new Set());
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      setToasts([]);
      return;
    }

    // Create toasts for all uncleared patients
    const newToasts = patients.map(p => ({
      ...p,
      toastId: `${p.id}`,
    }));

    setToasts(newToasts);
  }, [patients, enabled]);

  const dismiss = (toastId) => setToasts(prev => prev.filter(t => t.toastId !== toastId));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(t => (
        <div key={t.toastId}
          className="pointer-events-auto flex items-start gap-3 bg-white border border-amber-200 shadow-xl rounded-2xl px-4 py-3 w-80 animate-slide-in">
          <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Pending Clearance</p>
            <p className="text-sm font-semibold text-gray-800 truncate">{t.full_name}</p>
            <p className="text-xs text-gray-400">{t.patient_no} · {t.ward}</p>
          </div>
          <button onClick={() => dismiss(t.toastId)}
            className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors mt-0.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
