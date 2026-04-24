import { formatWard } from '../utils/formatWard';

const SUFFIXES = ['JR', 'SR', 'II', 'III', 'IV', 'V', 'JR.', 'SR.'];

function parseName(patient) {
  if (patient.patlast || patient.patfirst) {
    return {
      lastname:   (patient.patlast   || '').trim(),
      firstname:  (patient.patfirst  || '').trim(),
      middlename: (patient.patmiddle || '').trim(),
      suffix:     (patient.patsuffix || '').trim(),
    };
  }
  const full = (patient.full_name || '').trim();
  const commaIdx = full.indexOf(',');
  if (commaIdx === -1) return { lastname: full, firstname: '', middlename: '', suffix: '' };
  const lastname = full.substring(0, commaIdx).trim();
  const parts    = full.substring(commaIdx + 1).trim().split(/\s+/).filter(Boolean);
  let suffix = '';
  if (parts.length > 0 && SUFFIXES.includes(parts[parts.length - 1].toUpperCase())) suffix = parts.pop();
  return { lastname, firstname: parts[0] || '', middlename: parts.slice(1).join(' '), suffix };
}

function toTitle(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function Field({ label, value, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value || '—'}</span>
    </div>
  );
}

function Divider() {
  return <div className="col-span-full h-px bg-gray-100 my-1" />;
}

export default function PatientInfoModal({ patient, clearances, onClose }) {
  if (!patient) return null;

  const { lastname, firstname, middlename, suffix } = parseName(patient);

  const enccode   = (patient.ward && patient.ward.length > 20) ? patient.ward : '';
  const timeMatch = enccode.match(/(\d{2}:\d{2}:\d{2})$/);
  const rawTime   = patient.admit_time || (timeMatch ? timeMatch[1].substring(0, 5) : null);

  const fmtTime = (t) => {
    if (!t) return '—';
    try {
      const [h, m] = t.split(':');
      const d = new Date(); d.setHours(+h, +m);
      return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { return t; }
  };

  const fmtDate = (d, opts) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-PH', opts || { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return '—'; }
  };

  const age = patient.patbdate
    ? Math.floor((new Date() - new Date(patient.patbdate)) / (365.25 * 24 * 60 * 60 * 1000))
    : (patient.age ?? null);

  const cleared = clearances?.filter(c => c.status === 'cleared').length ?? 0;
  const total   = clearances?.length ?? 0;
  const pct     = total > 0 ? Math.round((cleared / total) * 100) : 0;

  const patientTypeBadge =
    patient.patient_type === 'er'  ? { label: 'ER',         cls: 'bg-red-100 text-red-600'     } :
    patient.patient_type === 'opd' ? { label: 'OPD',        cls: 'bg-green-100 text-green-700'  } :
                                     { label: 'In-Patient',  cls: 'bg-blue-100 text-blue-700'    };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
            <div>
              <p className="text-base font-bold text-gray-900 leading-tight">Patient Information</p>
              <p className="text-xs text-gray-400">{patient.patient_no}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${patientTypeBadge.cls}`}>
              {patientTypeBadge.label}
            </span>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-6">

          {/* Name section */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Name</p>
            <div className="grid grid-cols-4 gap-x-6 gap-y-4">
              <Field label="Last name"   value={toTitle(lastname)}   />
              <Field label="First name"  value={toTitle(firstname)}  />
              <Field label="Middle name" value={toTitle(middlename)} />
              <Field label="Suffix"      value={toTitle(suffix)}     />
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Personal info */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Personal Information</p>
            <div className="grid grid-cols-4 gap-x-6 gap-y-4">
              <Field label="Birthdate"
                value={fmtDate(patient.patbdate, { month: '2-digit', day: '2-digit', year: 'numeric' })} />
              <Field label="Age"    value={age !== null ? `${age} yrs` : '—'} />
              <Field label="Sex"    value={patient.patsex === 'M' ? 'Male' : patient.patsex === 'F' ? 'Female' : '—'} />
              <Field label="Contact no." value={patient.contact || patient.pattelno} />
              <Field label="Address" value={patient.address} className="col-span-4" />
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Admission info */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Admission Details</p>
            <div className="grid grid-cols-4 gap-x-6 gap-y-4">
              <Field label="Admission date" value={fmtDate(patient.admit_date)} />
              <Field label="Admission time" value={fmtTime(rawTime)} />
              <Field label="Type of service" value={patient.service_type} />
              <Field label="Accommodation"   value={patient.accom_type}  />
              <Field label="Ward"     value={formatWard(patient)} />
              <Field label="Room / Bed" value={patient.room_bed}  />
              <Field label="Admitting diagnosis"
                value={patient.admtxt || patient.admitting_dx}
                className="col-span-2" />
            </div>
          </div>

          {/* Clearance progress */}
          {clearances && clearances.length > 0 && (
            <>
              <div className="h-px bg-gray-100" />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Clearance Progress</p>
                  <span className="text-xs font-bold text-gray-500">{cleared}/{total} cleared · {pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {clearances.map(c => (
                    <div key={c.cost_center}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium
                        ${c.status === 'cleared' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-500'}`}>
                      <span className="truncate pr-2">{c.cost_center}</span>
                      {c.status === 'cleared'
                        ? <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                          </svg>
                        : <span className="text-[10px] font-bold text-amber-500 shrink-0">PENDING</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm rounded-xl transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
