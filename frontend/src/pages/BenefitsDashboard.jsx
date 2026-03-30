import { useState } from "react";
import AuditTrail from "../components/AuditTrail";
import PhClock from "../components/PhClock";
import WindowTab from "./WindowTab";

export default function BenefitsDashboard({ user, onLogout }) {
  const [tab, setTab] = useState("3a");
  const [auditKey, setAuditKey] = useState(0);

  const TABS = [
    { key: "3a",    label: "Window 3A (In-Patient)" },
    { key: "3b",    label: "Window 3B (ER-Refundable)" },
    { key: "6",     label: "Window 6 (ER)" },
    { key: "audit", label: "Audit Trail" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-emerald-800 sticky top-0 z-10 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/GEAMH LOGO.png" alt="logo" className="w-7 h-7 object-contain" />
            <div className="leading-tight">
              <p className="text-[10px] text-emerald-300 uppercase tracking-widest">Hospital Clearance System</p>
              <p className="text-white font-semibold text-sm">{user.costCenter}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PhClock />
            <button onClick={onLogout} className="text-sm text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all">Logout</button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => { setTab(key); if (key === "audit") setAuditKey(k => k + 1); }}
              className={"whitespace-nowrap px-4 py-3 text-sm font-semibold border-b-2 transition-colors " + (tab === key ? "border-emerald-600 text-emerald-700" : "border-transparent text-gray-400 hover:text-gray-600")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {tab === "audit" && <AuditTrail key={auditKey} role={user.costCenter} />}
        {tab === "3a"  && <WindowTab costCenter="Benefits - Window 3A" label="Window 3A — In-Patients" />}
        {tab === "3b"  && <WindowTab costCenter="Benefits - Window 3B" label="Window 3B — ER-Refundable" />}
        {tab === "6"   && <WindowTab costCenter="Benefits - Window 6"  label="Window 6 — ER Patients" />}
      </main>
    </div>
  );
}

