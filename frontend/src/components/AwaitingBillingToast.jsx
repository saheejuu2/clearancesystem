import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

// Shows persistent toast for patients awaiting billing clearance
export default function AwaitingBillingToast({ patients = [], enabled = true, onPatientClick }) {
  const [toasts, setToasts] = useState([]);
  const seenNotificationsRef = useRef(new Set());

  useEffect(() => {
    if (!enabled) {
      setToasts([]);
      return;
    }

    // Create toasts for all patients awaiting billing
    const patientToasts = patients
      .filter(p => p.clearance_step === 'awaiting_billing')
      .map(p => ({
        ...p,
        toastId: `patient-${p.id}`,
        type: 'patient',
      }));

    setToasts(patientToasts);
  }, [patients, enabled]);

  // Poll for new notifications from Billing
  useEffect(() => {
    if (!enabled) return;

    const pollNotifications = async () => {
      try {
        const res = await api.get('/notifications.php?recipient=Billing');
        if (Array.isArray(res.data)) {
          res.data.forEach(notif => {
            // Show unread notifications about patients ready for billing review
            if (!notif.is_read && notif.message && notif.message.includes('ready for billing review')) {
              const notifId = `notif-${notif.id}`;
              
              // Only add if we haven't seen this notification before
              if (!seenNotificationsRef.current.has(notifId)) {
                seenNotificationsRef.current.add(notifId);
                
                const newToast = {
                  toastId: notifId,
                  patient_id: notif.patient_id,
                  patient_no: notif.patient_no,
                  full_name: notif.patient_name,
                  ward: 'Pending',
                  type: 'notification',
                };

                setToasts(prev => [...prev, newToast]);

                // Auto-dismiss after 8 seconds
                setTimeout(() => {
                  setToasts(prev => prev.filter(t => t.toastId !== notifId));
                }, 8000);
              }
            }
          });
        }
      } catch (err) {
        console.error('Error polling notifications:', err);
      }
    };

    // Poll immediately and then every 5 seconds
    pollNotifications();
    const interval = setInterval(pollNotifications, 5000);

    return () => clearInterval(interval);
  }, [enabled]);

  const dismiss = (toastId) => {
    setToasts(prev => prev.filter(t => t.toastId !== toastId));
  };

  const handleToastClick = (toast) => {
    if (onPatientClick) {
      onPatientClick(toast);
    }
    dismiss(toast.toastId);
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(t => (
        <div key={t.toastId}
          onClick={() => handleToastClick(t)}
          className="pointer-events-auto flex items-start gap-3 bg-white border border-blue-200 shadow-xl rounded-2xl px-4 py-3 w-80 animate-slide-in cursor-pointer hover:shadow-2xl hover:border-blue-300 transition-all">
          <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
              {t.type === 'notification' ? 'New Patient Ready' : 'Awaiting Clearance'}
            </p>
            <p className="text-sm font-semibold text-gray-800 truncate">{t.full_name}</p>
            <p className="text-xs text-gray-400">{t.patient_no} · {t.ward}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); dismiss(t.toastId); }}
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
