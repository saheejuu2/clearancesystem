export default function PatientInfoModal({ patient, clearances, onClose }) {
  if (!patient) return null;

  // Parse enccode stored in ward: fhud(7) + hpercode(15) + date(10) + time(8)
  const enccode = (patient.ward && patient.ward.length > 20) ? patient.ward : '';
  const facilityCode = enccode ? enccode.substring(0, 7) : '—';
  const patientCode  = enccode ? enccode.substring(7, 22) : (patient.patient_no || '—');
  const timeMatch    = enccode.match(/(\d{2}:\d{2}:\d{2})$/);
  const admitTime    = patient.admit_time || (timeMatch ? timeMatch[1].substring(0, 5) : '—');

  const rows = [
    ['Hospital No.',   patient.patient_no],
    ['Name of Patient',patient.full_name],
    ['Age',            patient.patbdate ? Math.floor((new Date() - new Date(patient.patbdate)) / (365.25 * 24 * 60 * 60 * 1000)) : (patient.age ?? '—')],
    ['Sex',            patient.patsex === 'M' ? 'Male' : patient.patsex === 'F' ? 'Female' : '—'],
    ['Birthdate',      patient.patbdate ? (() => { try { return new Date(patient.patbdate).toLocaleDateString('en-PH', { dateStyle: 'medium' }); } catch { return '—'; } })() : '—'],
    ['Address',        patient.address || '—'],
    ['Ward',           patient.ward_name || patient.wardname || (patient.ward && patient.ward.length <= 20 ? patient.ward : '—')],
    ['Admitting Diagnosis ',   patient.admtxt || patient.admitting_dx || '—'],
    ['Admission Date',  patient.admit_date ? new Date(patient.admit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'],
    ['Admission Time',  admitTime && admitTime !== '—' ? (() => { try { const [h, m] = admitTime.split(':'); const d = new Date(); d.setHours(+h, +m); return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }); } catch { return admitTime; } })() : '—'],
    ['Patient Type',   patient.patient_type === 'er' ? 'ER' : patient.patient_type === 'opd' ? 'OPD' : 'In-Patient'],
    ['Service',        (() => {
      const t = (patient.toecode || '').toUpperCase();
      const map = { ADM: 'Admitted', ER: 'Emergency Room', ERADM: 'ER → Admitted', OPD: 'Out-Patient (OPD)', OPDAD: 'OPD → Admitted' };
      return map[t] || (t || '—');
    })()],
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-gray-900">Patient Information</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Patient details */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-0 mb-5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5 py-2 border-b border-gray-50">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
              <span className="text-sm font-semibold text-gray-800 break-words">{value ?? '—'}</span>
            </div>
          ))}
        </div>

        {/* Clearance progress */}
        {clearances && clearances.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Clearance Progress ({clearances.filter(c => c.status === 'cleared').length}/{clearances.length})
            </p>
            <div className="flex flex-col gap-1.5">
              {clearances.map(c => (
                <div key={c.cost_center} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                  <span className="text-xs text-gray-700">{c.cost_center}</span>
                  {c.status === 'cleared' ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Cleared
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-amber-500">Pending</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={onClose}
          className="w-full mt-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm rounded-lg transition-colors">
          Close
        </button>
      </div>
    </div>
  );
}
