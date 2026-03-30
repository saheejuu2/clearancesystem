import React, { useState, useEffect } from "react";
import api from "../services/api";
import ClearanceReport from "../components/ClearanceReport";
import AuditTrail from "../components/AuditTrail";
import StaffManager from "../components/StaffManager";
import PhClock from "../components/PhClock";
import SearchBar from "../components/SearchBar";

const STEP_LABEL = {
  no_request:           { label: "Admitted",     style: "bg-gray-100 text-gray-500"       },
  awaiting_nurse:       { label: "Admitted",     style: "bg-gray-100 text-gray-500"       },
  awaiting_billing:     { label: "May Go Home",  style: "bg-blue-100 text-blue-600"       },
  cost_center_clearing: { label: "In Clearance", style: "bg-amber-100 text-amber-600"     },
  discharged:           { label: "Discharged",   style: "bg-emerald-100 text-emerald-700" },
};

export default function BillingDashboard({ user, onLogout }) {
  const [tab, setTab]               = useState("patients");
  const [patients, setPatients]     = useState([]);
  const [search, setSearch]         = useState("");
  const [loading, setLoading]       = useState(false);
  const [actionId, setActionId]     = useState(null);
  const [remarksId, setRemarksId]   = useState(null);
  const [clearanceForm, setClearanceForm] = useState(null); // { patientId, selected: [] }
  const [dischargerName, setDischargerName] = useState("");
  const [remarks, setRemarks]       = useState("");
  const [reportPatient, setReport]  = useState(null);
  const [ccProgress, setCcProgress] = useState({});

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await api.get("/get_patients.php?role=Billing");
      setPatients(res.data);
    } catch { }
    finally { setLoading(false); }
  };

  const fetchProgress = async (patient_id) => {
    try {
      const res = await api.get("/get_clearance_report.php?patient_id=" + patient_id);
      if (res.data.success) {
        const cleared = res.data.clearances.filter(c => c.status === "cleared").length;
        const total   = res.data.clearances.length;
        setCcProgress(prev => ({ ...prev, [patient_id]: { cleared, total } }));
      }
    } catch { }
  };

  useEffect(() => { fetchPatients(); }, []);
  useEffect(() => {
    patients.forEach(p => {
      if (p.clearance_step === "cost_center_clearing") fetchProgress(p.id);
    });
  }, [patients]);

  const DEPT_LIST = [
    "Operating Room/Delivery Room",
    "Pulmonary Department (MSA)",
    "Hemodialysis Unit",
    "Newborn Screening",
    "Newborn Hearing Test",
    "Radiology",
    "Laboratory",
    "Bloodbank",
    "Pharmacy",
    "Benefits",
  ];

  const openClearanceForm = (patient_id) => {
    setClearanceForm({ patientId: patient_id, selected: [...DEPT_LIST] });
  };

  const sendForClearance = async () => {
    if (!clearanceForm || clearanceForm.selected.length === 0) {
      alert("Please select at least one cost center.");
      return;
    }
    setActionId(clearanceForm.patientId);
    try {
      const res = await api.post("/update_clearance.php", {
        action: "for_clearance",
        patient_id: clearanceForm.patientId,
        actor: user.costCenter,
        cost_centers: clearanceForm.selected,
      });
      if (res.data.success) { setClearanceForm(null); fetchPatients(); }
      else alert(res.data.message);
    } finally { setActionId(null); }
  };

  const discharge = async (patient_id) => {
    if (!remarks.trim()) { alert("Please enter final remarks before discharging."); return; }
    setActionId(patient_id);
    try {
      const res = await api.post("/update_clearance.php", { action: "discharge", patient_id, actor: user.costCenter, remarks });
      if (res.data.success) { setRemarksId(null); setRemarks(""); setDischargerName(""); fetchPatients(); }
      else alert(res.data.message);
    } finally { setActionId(null); }
  };

  const filtered = patients.filter(p =>
    p.clearance_step !== "discharged" &&
    (p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.patient_no.toLowerCase().includes(search.toLowerCase()))
  );

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
            <button onClick={onLogout} className="text-sm text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1">
          {[["patients","Patients"],["discharged","Discharged"],["audit","Audit Trail"], ...(user.role === "admin" ? [["staff","Staff"]] : [])].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={"px-4 py-3 text-sm font-semibold border-b-2 transition-colors " + (tab === key ? "border-emerald-600 text-emerald-700" : "border-transparent text-gray-400 hover:text-gray-600")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-5">

        {tab === "staff" && <StaffManager costCenter={user.costCenter} />}
        {tab === "audit" && <AuditTrail role={user.costCenter} />}


        {tab === "discharged" && (
          <>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Discharged Patients</h1>
              <p className="text-sm text-gray-400 mt-0.5">All patients who have completed the clearance process</p>
            </div>
            <SearchBar value={search} onChange={setSearch} placeholder="Search by name or patient ID" />
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {["Patient ID","Name","Ward","Admit Date","Discharged At","Action"].map(h => (
                        <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {patients.filter(p => p.clearance_step === "discharged" && (p.full_name.toLowerCase().includes(search.toLowerCase()) || p.patient_no.toLowerCase().includes(search.toLowerCase()))).length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-gray-300 text-sm">No discharged patients.</td></tr>
                    ) : patients.filter(p => p.clearance_step === "discharged" && (p.full_name.toLowerCase().includes(search.toLowerCase()) || p.patient_no.toLowerCase().includes(search.toLowerCase()))).map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs text-gray-400">{p.patient_no}</td>
                        <td className="px-5 py-4 font-semibold text-gray-800">{p.full_name}</td>
                        <td className="px-5 py-4 text-gray-500">{p.ward}</td>
                        <td className="px-5 py-4 text-gray-500">{p.admit_date}</td>
                        <td className="px-5 py-4 text-gray-500 text-xs">{p.discharged_at ? new Date(p.discharged_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "-"}</td>
                        <td className="px-5 py-4">
                          <button onClick={() => setReport(p)} className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                            Report
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                {patients.filter(p => p.clearance_step === "discharged").length} discharged patient(s)
              </div>
            </div>
          </>
        )}        {tab === "patients" && (
          <>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Billing Dashboard</h1>
              <p className="text-sm text-gray-400 mt-0.5">Manage patient clearance and discharge</p>
            </div>

            <SearchBar value={search} onChange={setSearch} placeholder="Search by name or patient ID" />

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {["Patient ID","Name","Ward","Admit Date","Status","Progress","Action"].map(h => (
                        <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">Loading</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">No patients found.</td></tr>
                    ) : filtered.map(p => {
                      const step = STEP_LABEL[p.clearance_step] || STEP_LABEL["no_request"];
                      const prog = ccProgress[p.id];
                      return (
                        <React.Fragment key={p.id}>
                          <tr className="hover:bg-gray-50/70 transition-colors">
                            <td className="px-5 py-4 font-mono text-xs text-gray-400">{p.patient_no}</td>
                            <td className="px-5 py-4 font-semibold text-gray-800">{p.full_name}</td>
                            <td className="px-5 py-4 text-gray-500">{p.ward}</td>
                            <td className="px-5 py-4 text-gray-500">{p.admit_date}</td>
                            <td className="px-5 py-4">
                              <span className={"px-2.5 py-1 rounded-full text-xs font-semibold " + step.style}>{step.label}</span>
                            </td>
                            <td className="px-5 py-4">
                              {prog ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: (prog.cleared / prog.total * 100) + "%" }} />
                                  </div>
                                  <span className="text-xs text-gray-400">{prog.cleared}/{prog.total}</span>
                                </div>
                              ) : <span className="text-xs text-gray-300">-</span>}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                {p.clearance_step === "awaiting_billing" && (
                                  <button onClick={() => openClearanceForm(p.id)} disabled={actionId === p.id}
                                    className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                    For Clearance
                                  </button>
                                )}
                                {p.clearance_step === "cost_center_clearing" && prog && prog.cleared === prog.total && prog.total > 0 && (
                                  <button onClick={() => { setRemarksId(p.id); setRemarks(""); }}
                                    className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                    Discharge
                                  </button>
                                )}
                                {p.request_id && (
                                  <button onClick={() => setReport(p)}
                                    className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                                    Report
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {remarksId === p.id && (
                            <tr key={"r-" + p.id} className="bg-emerald-50">
                              <td colSpan={7} className="px-5 py-4">
                                <div className="flex flex-col gap-3">
                                  <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="flex flex-col gap-1 flex-1">
                                      <label className="text-xs font-semibold text-gray-600">Your Name <span className="text-red-500">*</span></label>
                                      <input type="text" placeholder="Enter your full name" value={dischargerName} onChange={e => setDischargerName(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                    </div>
                                    <div className="flex flex-col gap-1 flex-1">
                                      <label className="text-xs font-semibold text-gray-600">Final Remarks <span className="text-red-500">*</span></label>
                                      <input type="text" placeholder="Enter final remarks" value={remarks} onChange={e => setRemarks(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => discharge(p.id)} disabled={actionId === p.id} className="text-sm font-semibold bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">
                                      {actionId === p.id ? "Discharging" : "Confirm Discharge"}
                                    </button>
                                    <button onClick={() => { setRemarksId(null); setRemarks(""); setDischargerName(""); }} className="text-sm text-gray-500 hover:text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-lg transition-colors">
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                Showing {filtered.length} of {patients.length} patients
              </div>
            </div>
          </>
        )}

      </main>

      {reportPatient && (
        <ClearanceReport patientId={reportPatient.id} onClose={() => setReport(null)} />
      )}

    </div>
  );
}