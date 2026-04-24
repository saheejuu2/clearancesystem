import { useState } from 'react';
import api from '../services/api';

export default function usePatientInfo() {
  const [viewPatient, setViewPatient]       = useState(null);
  const [viewClearances, setViewClearances] = useState([]);

  const openPatientInfo = async (p) => {
    // Show local data immediately — patbdate already synced from migrate script
    setViewPatient({ ...p });
    setViewClearances([]);

    // Enrich from HDB (skip OPD — no encounter record)
    if (p.patient_type !== 'opd') {
      try {
        const nr = await api.get(
          `/get_hdb_patients.php?hpercode=${encodeURIComponent(p.patient_no)}&enccode=${encodeURIComponent(p.ward || '')}`
        );
        if (nr.data?.person) {
          const person   = nr.data.person;
          const enccode  = p.ward || '';
          const timeMatch = enccode.match(/(\d{2}:\d{2}:\d{2})$/);
          const admTime  = timeMatch
            ? timeMatch[1].substring(0, 5)
            : (() => {
                try {
                  const d = new Date(person.admtime || '');
                  return !isNaN(d) && d.getFullYear() > 1900 && d.getFullYear() < 3000
                    ? d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
                    : null;
                } catch { return null; }
              })();

          setViewPatient(prev => ({
            ...prev,
            patlast:      person.patlast      || prev.patlast,
            patfirst:     person.patfirst     || prev.patfirst,
            patmiddle:    person.patmiddle    || prev.patmiddle,
            patsuffix:    person.patsuffix    || prev.patsuffix,
            patsex:       person.patsex       || prev.patsex,
            patbdate:     person.patbdate     || prev.patbdate,
            pattelno:     person.pattelno     || prev.pattelno,
            contact:      person.contact      || prev.contact,
            address:      person.address      || prev.address,
            toecode:      person.toecode      || prev.toecode,
            ward_name:    person.wardname     || prev.ward_name  || '—',
            room_bed:     person.room_bed     || prev.room_bed   || '—',
            accom_type:   person.accom_type   || prev.accom_type  || '—',
            service_type: person.service_type || prev.service_type || '—',
            admtxt:       person.admtxt       || prev.admtxt     || prev.admitting_dx,
            admit_time:   admTime             || prev.admit_time,
          }));
        }
      } catch { /* silent — show whatever we already have */ }
    }

    // Fetch clearance report
    try {
      const r = await api.get('/get_clearance_report.php?patient_id=' + p.id);
      setViewClearances(r.data.success ? r.data.clearances : []);
    } catch { setViewClearances([]); }
  };

  const closePatientInfo = () => {
    setViewPatient(null);
    setViewClearances([]);
  };

  return { viewPatient, viewClearances, openPatientInfo, closePatientInfo };
}
