import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

const COST_CENTER_ROWS = [
  { label: 'OPERATING ROOM/\nDELIVERY ROOM',   sub: '(KPFH Building 2nd Floor)',    keys: ['Operating Room/Delivery Room'] },
  { label: 'PULMONARY DEPARTMENT (MSA)',         sub: '(KPFH Building 2nd Floor)',    keys: ['Pulmonary Department (MSA)'] },
  { label: 'HEMODIALYSIS UNIT',                  sub: '(KPFH Building Ground Floor)', keys: ['Hemodialysis Unit'] },
  { label: 'NEWBORN SCREENING',                  sub: '(KPFH Building Ground Floor)', keys: ['Newborn Screening'] },
  { label: 'NEWBORN HEARING TEST',               sub: '(KPFH Building Ground Floor)', keys: ['Newborn Hearing Test'] },
  { label: 'RADIOLOGY',                          sub: '(Ancillary Building Ground Floor)', keys: ['Radiology'] },
  { label: 'LABORATORY',                         sub: '(Ancillary Building 2nd Floor)',    keys: ['Laboratory'] },
  { label: 'BLOODBANK',                          sub: '(Ancillary Building 2nd Floor)',    keys: ['Bloodbank'] },
  { label: 'PHARMACY',                           sub: '(GEAMH Building)',                  keys: ['Pharmacy'] },
  { label: 'BENEFITS (WINDOW 3A/3B/6)',          sub: '(KPFH Building Ground Floor)',      keys: ['Benefits - Window 3A','Benefits - Window 3B','Benefits - Window 6'] },
  { label: 'Billing (WINDOW 1/2)',               sub: '(KPFH Building Ground Floor)',      keys: ['Billing - Window 1','Billing - Window 2','Billing'] },
  { label: 'MAB',                                sub: '',                                  keys: ['MAB'] },
];

export default function ClearanceFormPrint({ patientId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [patientType, setPatientType] = useState('GEAMH');
  const [ihisAmounts, setIhisAmounts] = useState({}); // { costCenter: amount }
  const printRef = useRef(null);

  useEffect(() => {
    api.get(`/get_clearance_report.php?patient_id=${patientId}`)
      .then(async res => {
        if (res.data.success) {
          setData(res.data);
          // Fetch SOA from IHIS for each cleared cost center that has no amount saved
          const patient_no = res.data.patient?.patient_no;
          if (patient_no) {
            const ccRows = COST_CENTER_ROWS.flatMap(r => r.keys);
            const uniqueCCs = [...new Set(ccRows)];
            const results = await Promise.all(
              uniqueCCs.map(cc =>
                api.get(`/get_soa_amount.php?patient_no=${encodeURIComponent(patient_no)}&cost_center=${encodeURIComponent(cc)}`)
                  .then(r => ({ cc, amount: r.data.success ? r.data.amount : null }))
                  .catch(() => ({ cc, amount: null }))
              )
            );
            const map = {};
            results.forEach(({ cc, amount }) => { if (amount !== null && amount > 0) map[cc] = amount; });
            setIhisAmounts(map);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Clearance Form</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
        .form-wrap { width: 210mm; min-height: 297mm; padding: 10mm 12mm; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 6px; }
        .header h2 { font-size: 13px; font-weight: bold; text-transform: uppercase; }
        .header h3 { font-size: 11px; }
        .header h1 { font-size: 16px; font-weight: bold; letter-spacing: 2px; margin: 6px 0; text-decoration: underline; }
        .type-row { display: flex; gap: 30px; margin: 8px 0; }
        .type-box { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: bold; }
        .checkbox { width: 14px; height: 14px; border: 2px solid #000; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 8px 0; font-size: 11px; }
        .info-row { display: flex; align-items: flex-end; gap: 4px; margin-bottom: 6px; }
        .info-label { white-space: nowrap; }
        .info-val { border-bottom: 1px solid #000; flex: 1; min-width: 80px; padding-bottom: 1px; font-weight: bold; text-align: center; }
        .info-sub { font-size: 9px; text-align: center; }
        .top-right { position: absolute; right: 12mm; top: 10mm; font-size: 10px; }
        .top-right div { margin-bottom: 3px; }
        .top-right .val-line { border-bottom: 1px solid #000; min-width: 80px; display: inline-block; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { font-size: 10px; font-weight: bold; text-align: center; border-bottom: 1px solid #000; padding: 4px 2px; }
        td { border: 1px solid #ccc; padding: 5px 4px; vertical-align: middle; font-size: 10px; }
        td.cc-name { font-weight: bold; font-size: 10px; white-space: pre-line; }
        td.cc-sub { font-size: 8.5px; color: #444; }
        .cc-cell { display: flex; align-items: flex-start; gap: 5px; }
        .cleared-check { font-size: 13px; }
        .sig-cell { min-height: 32px; }
        .amt-cell { text-align: right; font-weight: bold; }
        .dt-cell { font-size: 9px; text-align: center; }
        .footer-box { border: 1px solid #000; padding: 6px 10px; margin-top: 10px; font-size: 10px; text-align: center; }
        .footer-note { border: 1px solid #000; padding: 6px 10px; margin-top: 4px; font-size: 10px; text-align: center; font-weight: bold; }
        .pss-row { margin-top: 6px; font-size: 10px; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style>
      </head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 text-gray-400 text-sm">Loading...</div>
    </div>
  );

  if (!data) return null;

  const { patient, request, clearances } = data;

  // Build a map of cost_center -> clearance record
  const ccMap = {};
  clearances.forEach(c => { ccMap[c.cost_center] = c; });

  const fmt = (dt) => dt ? new Date(dt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
        {/* Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <h3 className="text-base font-bold text-gray-900">Clearance Form Preview</h3>
            <div className="flex items-center gap-3">
              {['GEAMH','KPFH'].map(t => (
                <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="ptype" value={t} checked={patientType === t}
                    onChange={() => setPatientType(t)} className="accent-emerald-600" />
                  <span className="text-sm font-semibold">{t}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              Print
            </button>
            <button onClick={onClose}
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              Close
            </button>
          </div>
        </div>

        {/* Printable area */}
        <div className="overflow-y-auto max-h-[75vh] p-4">
          <div ref={printRef}>
            <div className="form-wrap" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', width: '100%', padding: '8mm 10mm' }}>

              {/* Title — full width centered */}
              <div style={{ textAlign: 'center', marginBottom: '6px' }}>
                <div style={{ fontSize: '9px' }}>GEAMH FORM NO. 22 revised 3.2025</div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>General Emilio Aguinaldo Memorial Hospital</div>
                <div style={{ fontSize: '11px' }}>(Korea-Philippines Friendship Project)</div>
                <div style={{ fontSize: '11px' }}>Trece Martires City, Cavite</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '3px', margin: '6px 0', textDecoration: 'underline' }}>CLEARANCE FORM</div>
              </div>

              {/* Date/Time/Hospital No/Case No — right aligned below title */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                <div style={{ fontSize: '10px' }}>
                  <div>Date: <span style={{ borderBottom: '1px solid #000', minWidth: '80px', display: 'inline-block' }}>{fmtDate(patient.admit_date)}</span></div>
                  <div style={{ marginTop: '3px' }}>Time: <span style={{ borderBottom: '1px solid #000', minWidth: '80px', display: 'inline-block' }}></span></div>
                  <div style={{ marginTop: '3px' }}>Hospital No.: <span style={{ borderBottom: '1px solid #000', minWidth: '60px', display: 'inline-block' }}>{patient.patient_no}</span></div>
                  <div style={{ marginTop: '3px' }}>Case No.: <span style={{ borderBottom: '1px solid #000', minWidth: '80px', display: 'inline-block' }}></span></div>
                </div>
              </div>

              {/* GEAMH / KPFH checkboxes */}
              <div style={{ display: 'flex', gap: '40px', margin: '8px 0' }}>
                {['GEAMH','KPFH'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 'bold' }}>
                    <div style={{ width: '14px', height: '14px', border: '2px solid #000', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                      {patientType === t ? '✓' : ''}
                    </div>
                    {t === 'KPFH' ? 'KPFH' : 'GEAMH'}
                  </div>
                ))}
              </div>

              {/* Patient info */}
              <div style={{ fontSize: '11px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span style={{ whiteSpace: 'nowrap' }}>This is to certify that</span>
                  <div style={{ flex: '1', minWidth: '120px' }}>
                    <div style={{ borderBottom: '1px solid #000', fontWeight: 'bold', padding: '0 4px', textAlign: 'center' }}>{patient.full_name}</div>
                  </div>
                  <span style={{ whiteSpace: 'nowrap' }}>of</span>
                  <div style={{ minWidth: '100px' }}>
                    <div style={{ borderBottom: '1px solid #000', fontWeight: 'bold', padding: '0 4px', textAlign: 'center' }}>{patient.ward_name || patient.ward || ''}</div>
                    <div style={{ fontSize: '9px', textAlign: 'center', marginTop: '1px' }}>(Ward)</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <span>was admitted on</span>
                  <div style={{ textAlign: 'center', minWidth: '100px' }}>
                    <div style={{ borderBottom: '1px solid #000', fontWeight: 'bold', padding: '0 4px' }}>{fmtDate(patient.admit_date)}</div>
                    <div style={{ fontSize: '9px' }}>(Date/Time)</div>
                  </div>
                  <span>at</span>
                  <div style={{ textAlign: 'center', minWidth: '80px' }}>
                    <div style={{ borderBottom: '1px solid #000', fontWeight: 'bold', padding: '0 4px' }}>{patient.ward_name || patient.ward || ''}</div>
                    <div style={{ fontSize: '9px' }}>(Ward)</div>
                  </div>
                  <span>schedule for discharge on</span>
                  <div style={{ textAlign: 'center', minWidth: '100px' }}>
                    <div style={{ borderBottom: '1px solid #000', padding: '0 4px' }}>{request?.nurse_cleared_at ? fmtDate(request.nurse_cleared_at) : ''}</div>
                    <div style={{ fontSize: '9px' }}>(Date/Time)</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
                  <span>Issued to:</span>
                  <div style={{ textAlign: 'center', flex: '1', minWidth: '140px' }}>
                    <div style={{ borderBottom: '1px solid #000', padding: '0 4px' }}></div>
                    <div style={{ fontSize: '9px' }}>(First Name MI Last Name)</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '120px' }}>
                    <div style={{ borderBottom: '1px solid #000', padding: '0 4px' }}></div>
                    <div style={{ fontSize: '9px' }}>(Contact Number)</div>
                  </div>
                </div>
              </div>

              {/* Clearance table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '32%', textAlign: 'left', borderBottom: '1px solid #000', padding: '4px 2px', fontSize: '10px' }}></th>
                    <th style={{ width: '36%', textAlign: 'center', borderBottom: '1px solid #000', padding: '4px 2px', fontSize: '10px' }}>SIGNATURE OVER PRINTED NAME</th>
                    <th style={{ width: '18%', textAlign: 'center', borderBottom: '1px solid #000', padding: '4px 2px', fontSize: '10px' }}>AMOUNT</th>
                    <th style={{ width: '14%', textAlign: 'center', borderBottom: '1px solid #000', padding: '4px 2px', fontSize: '10px' }}>DATE/TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {COST_CENTER_ROWS.map((row, i) => {
                    // Find if any of the keys is cleared
                    const cleared = row.keys.find(k => ccMap[k]?.status === 'cleared');
                    const cc = cleared ? ccMap[cleared] : null;
                    // Use saved amount first, fall back to IHIS fetched amount
                    const displayAmount = cc?.amount
                      ? parseFloat(cc.amount)
                      : (ihisAmounts[cleared] ?? row.keys.reduce((sum, k) => sum + (ihisAmounts[k] ?? 0), 0)) || null;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '4px 4px', verticalAlign: 'middle', fontSize: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                            <div style={{ width: '12px', height: '12px', border: '1.5px solid #000', marginTop: '1px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                              {cc ? '✓' : ''}
                            </div>
                            <div>
                              <div style={{ fontWeight: 'bold', whiteSpace: 'pre-line', lineHeight: '1.3' }}>{row.label}</div>
                              {row.sub && <div style={{ fontSize: '8.5px', color: '#555' }}>{row.sub}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '4px 6px', minHeight: '32px', fontSize: '10px', textAlign: 'center', verticalAlign: 'middle' }}>
                          {cc?.cleared_by || ''}
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 'bold', fontSize: '10px', verticalAlign: 'middle' }}>
                          {displayAmount ? `₱${displayAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : ''}
                        </td>
                        <td style={{ padding: '4px 4px', textAlign: 'center', fontSize: '9px' }}>
                          {cc?.cleared_at ? fmt(cc.cleared_at) : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* PSS row */}
              <div style={{ marginTop: '6px', fontSize: '10px' }}>PSS# <span style={{ borderBottom: '1px solid #000', minWidth: '120px', display: 'inline-block' }}></span></div>

              {/* Footer */}
              <div style={{ border: '1px solid #000', padding: '6px 10px', marginTop: '10px', fontSize: '10px', textAlign: 'center' }}>
                INSTRUCTION: Once this form is completed kindly proceed to Billing Section.
              </div>
              <div style={{ border: '1px solid #000', padding: '6px 10px', marginTop: '4px', fontSize: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                NOTE: ATTACHED STATEMENT OF ACCOUNT IS TENTATIVE BILL AND FOR CLEARANCE REFERENCE PURPOSES ONLY.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
