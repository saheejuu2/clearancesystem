import { useState, useEffect } from "react";
import api from "../services/api";
import SearchBar from "../components/SearchBar";
import PatientInfoModal from "../components/PatientInfoModal";

export default function WindowTab({ costCenter, label }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionId, setActionId] = useState(null);
  const [remarksMap, setRemarksMap] = useState({});
  const [nameMap, setNameMap] = useState({});
  const [viewPatient, setViewPatient] = useState(null);
  const [viewClearances, setViewClearances] = useState([]);

  const fetchPatients = () => {
    setLoading(true);
    api.get("/get_patients.php?role=" + encodeURIComponent(costCenter))
      .then(res => setPatients(Array.isArray(res.data) ? res.data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPatients(); }, [costCenter]);

  const clearPatient = async (patient_id) => {
    if (!nameMap[patient_id]?.trim()) { alert("Please enter your name before confirming."); return; }
    setActionId(patient_id);
    try {
      const res = await api.post("/update_clearance.php", {
        action: "cost_center_clear",
        patient_id,
        cost_center: costCenter,
        actor: nameMap[patient_id].trim(),
        remarks: remarksMap[patient_id] || "",
      });
      if (res.data.success) {
        setPatients(prev => prev.filter(p => p.id !== patient_id));
        setNameMap(prev => { const n = {...prev}; delete n[patient_id]; return n; });
        setRemarksMap(prev => { const n = {...prev}; delete n[patient_id]; return n; });
        fetchPatients();
      } else alert(res.data.message);
    } finally { setActionId(null); }
  };

  const filtered = patients.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.patient_no.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">{label}</h1>
        <p className="text-sm text-gray-400 mt-0.5">Patients pending clearance for this window</p>
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder="Search by name or patient ID..." />
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                {["Patient ID","Name","Age","Ward","Admit Date","Action",""].map(h => (
                  <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">No patients pending clearance.</td></tr>
              ) : filtered.map(p => (
                <>
                  <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs text-gray-400">{p.patient_no}</td>
                    <td className="px-5 py-4 font-semibold text-gray-800">{p.full_name}</td>
                    <td className="px-5 py-4 text-gray-500">{p.age}</td>
                    <td className="px-5 py-4 text-gray-500">{p.ward}</td>
                    <td className="px-5 py-4 text-gray-500">{p.admit_date}</td>
                    <td className="px-5 py-4">
                      {p.clearance_step === "cost_center_clearing" ? (
                        <button onClick={() => setRemarksMap(prev => ({ ...prev, [p.id]: prev[p.id] ?? "" }))}
                          className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                          Clear Patient
                        </button>
                      ) : <span className="text-xs text-gray-300">-</span>}
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={async () => {
                        setViewPatient(p);
                        try {
                          const r = await api.get("/get_clearance_report.php?patient_id=" + p.id);
                          setViewClearances(r.data.success ? r.data.clearances : []);
                        } catch { setViewClearances([]); }
                      }} className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                        View
                      </button>
                    </td>
                  </tr>
                  {remarksMap.hasOwnProperty(p.id) && (
                    <tr key={"r-" + p.id} className="bg-emerald-50">
                      <td colSpan={7} className="px-5 py-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex flex-col gap-1 flex-1">
                            <label className="text-xs font-semibold text-gray-600">Your Name *</label>
                            <input type="text" placeholder="Enter your full name" value={nameMap[p.id] || ""}
                              onChange={e => setNameMap(prev => ({ ...prev, [p.id]: e.target.value }))}
                              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                          </div>
                          <div className="flex flex-col gap-1 flex-1">
                            <label className="text-xs font-semibold text-gray-600">Remarks (optional)</label>
                            <input type="text" placeholder="e.g. no outstanding balance" value={remarksMap[p.id] || ""}
                              onChange={e => setRemarksMap(prev => ({ ...prev, [p.id]: e.target.value }))}
                              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                          </div>
                          <div className="flex items-end gap-2">
                            <button onClick={() => clearPatient(p.id)} disabled={actionId === p.id}
                              className="text-sm font-semibold bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
                              {actionId === p.id ? "Clearing..." : "Confirm Cleared"}
                            </button>
                            <button onClick={() => {
                              setRemarksMap(prev => { const n = {...prev}; delete n[p.id]; return n; });
                              setNameMap(prev => { const n = {...prev}; delete n[p.id]; return n; });
                            }} className="text-sm text-gray-500 bg-white border border-gray-200 px-4 py-2 rounded-lg transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
          {filtered.length} patient{filtered.length !== 1 ? "s" : ""} pending
        </div>
      </div>
      <PatientInfoModal patient={viewPatient} clearances={viewClearances} onClose={() => { setViewPatient(null); setViewClearances([]); }} />
    </div>
  );
}
