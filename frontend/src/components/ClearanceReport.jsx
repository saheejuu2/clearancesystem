import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

export default function ClearanceReport({ patientId, onClose }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef();

  useEffect(() => {
    api.get(`/get_clearance_report.php?patient_id=${patientId}`)
      .then(res => { if (res.data.success) setData(res.data); })
      .finally(() => setLoading(false));
  }, [patientId]);

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Clearance Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 15px; color: #555; margin-bottom: 24px; font-weight: normal; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 13px; }
        th { background: #f4f4f4; font-weight: 600; }
        .section { margin-bottom: 24px; }
        .label { font-size: 12px; color: #888; }
        .value { font-size: 14px; font-weight: 600; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
      </style>
      </head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  const fmt = (dt) => dt ? new Date(dt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 text-lg">Clearance Report</h2>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="text-sm font-semibold bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors">
              Close
            </button>
          </div>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {loading ? (
            <p className="text-center text-gray-300 py-12">Loading report…</p>
          ) : !data ? (
            <p className="text-center text-gray-300 py-12">No data available.</p>
          ) : (
            <div ref={printRef}>
              {/* Hospital header */}
              <div className="text-center mb-6">
                <h1 className="text-xl font-bold text-gray-900">General Emilio Aguinaldo Memorial Hospital</h1>
                <h2 className="text-base text-gray-500 font-medium">Patient Discharge Clearance Report</h2>
              </div>

              {/* Patient info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
                {[
                  ['Patient No.',   data.patient.patient_no],
                  ['Full Name',     data.patient.full_name],
                  ['Age',           data.patient.age],
                  ['Ward',          data.patient.ward],
                  ['Admit Date',    data.patient.admit_date],
                  ['Discharge Date', fmt(data.request?.discharged_at)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-sm font-semibold text-gray-800">{value}</p>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Clearance Timeline</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Nurse — May Go Home',    by: data.request?.nurse_cleared_by,   at: fmt(data.request?.nurse_cleared_at)   },
                    { label: 'Billing — For Clearance', by: data.request?.billing_sent_by,    at: fmt(data.request?.billing_sent_at)    },
                    { label: 'Billing — Discharged',    by: data.request?.discharged_by,      at: fmt(data.request?.discharged_at)      },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-gray-100 text-sm">
                      <span className="text-gray-600 font-medium">{row.label}</span>
                      <span className="text-gray-400 text-xs">{row.at}{row.by ? " · " + row.by : ""}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost center clearances */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Cost Center Clearances</h3>
                <table className="w-full text-sm border border-gray-100 rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase">Cost Center</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase">Status</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase">Cleared By</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase">Date & Time</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.clearances.map(c => (
                      <tr key={c.cost_center} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-700 font-medium">{c.cost_center}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.status === 'cleared' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-600'}`}>
                            {c.status === 'cleared' ? 'Cleared' : 'Pending'}
                          </span>
                        </td>
                        <td className='px-4 py-2.5 text-gray-500 text-xs'>{c.cleared_by || '-'}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{fmt(c.cleared_at)}</td>
                        <td className='px-4 py-2.5 text-gray-500 text-xs'>{c.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Final remarks */}
              {data.request?.final_remarks && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Final Remarks</p>
                  <p className="text-sm text-gray-700">{data.request.final_remarks}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}