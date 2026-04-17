import { useState, useEffect, useRef, useCallback } from "react";
import api from "../services/api";

export default function NotificationBell({ recipient, onNotificationClick }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const fetchNotifications = useCallback(() => {
    api.get("/notifications.php?action=list&recipient=" + encodeURIComponent(recipient))
      .then(res => setNotifications(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, [recipient]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    const onVisible = () => { if (document.visibilityState === "visible") fetchNotifications(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const markRead = async (id) => {
    await api.post("/notifications.php?action=read", { id }).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
  };

  const markAllRead = async () => {
    await api.post("/notifications.php?action=read_all&recipient=" + encodeURIComponent(recipient)).catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
  };

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="relative text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-all">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <p className="text-center py-8 text-gray-300 text-sm">No notifications</p>
            ) : notifications.map(n => (
              <div key={n.id} onClick={async () => {
                setOpen(false);
                await markRead(n.id);
                if (onNotificationClick) onNotificationClick(n);
              }}
                className={"px-4 py-3 cursor-pointer transition-colors " + (n.is_read ? "bg-white hover:bg-gray-50" : "bg-blue-50 hover:bg-blue-100")}>
                {recipient === "Admin" && (
                  <p className="text-xs font-semibold text-emerald-600 mb-0.5">{n.recipient}</p>
                )}
                <p className={"text-sm " + (n.is_read ? "text-gray-600" : "text-gray-800 font-medium")}>{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(n.created_at).toLocaleString("en-PH", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
