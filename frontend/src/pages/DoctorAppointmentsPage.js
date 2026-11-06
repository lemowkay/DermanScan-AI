import React, { useCallback, useEffect, useState } from 'react';
import { FiCheck, FiX, FiRefreshCw, FiCalendar, FiPaperclip } from 'react-icons/fi';
import Navbar from '../components/layout/Navbar';
import AppointmentStatus from '../components/common/AppointmentStatus';
import AttachedReport from '../components/booking/AttachedReport';
import { doctorService, getErrorMessage } from '../services/api';
import { formatDateTime } from '../utils/format';

const TABS = [['pending', 'Pending'], ['confirmed', 'Confirmed'], ['completed', 'Completed'], ['', 'All']];
const started = (iso) => new Date(iso) <= new Date();

const DoctorAppointmentsPage = () => {
  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);      // { id, mode }
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [openReport, setOpenReport] = useState(null);     // appointment id whose report is open

  const load = useCallback(() => {
    setLoading(true);
    doctorService.appointments(tab).then((r) => { setItems(r.data.appointments); setError(''); })
      .catch((e) => setError(getErrorMessage(e))).finally(() => setLoading(false));
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (active.mode === 'confirm') await doctorService.confirm(active.id, text);
      else if (active.mode === 'complete') await doctorService.complete(active.id, text);
      else await doctorService.decline(active.id, text);
      setActive(null); setText(''); load();
    } catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
      <Navbar />
      <main className="pt-24 px-4 pb-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2"><FiCalendar aria-hidden="true" />Appointment requests</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-5">Reports attached by patients appear inside their appointment. Patients are told the status only after you confirm or decline.</p>
          <div role="tablist" aria-label="Filter" className="flex gap-2 mb-4">
            {TABS.map(([v, l]) => (
              <button key={l} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
                className={'px-4 py-2 rounded-xl text-sm font-medium ' + (tab === v ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200')}>{l}</button>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
          {loading && <p role="status" className="text-gray-500 flex items-center gap-2"><FiRefreshCw className="animate-spin" aria-hidden="true" />Loading…</p>}
          {!loading && items.length === 0 && <p className="text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border border-gray-100 dark:border-gray-700">No appointments here.</p>}
          <ul className="space-y-3">
            {items.map((a) => (
              <li key={a.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white">{a.patient_name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{formatDateTime(a.appointment_date)} · {a.type}</p>
                  </div>
                  <AppointmentStatus status={a.status} />
                </div>
                {a.notes && <p className="text-sm text-gray-700 dark:text-gray-300 mt-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 whitespace-pre-wrap break-words"><span className="font-semibold">Patient notes: </span>{a.notes}</p>}
                {a.has_report && (
                  <div className="mt-3">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="inline-flex items-center gap-1 font-medium text-primary-700 dark:text-primary-300"><FiPaperclip aria-hidden="true" />Report attached: {a.report_condition}</span>
                      <button type="button" onClick={() => setOpenReport(openReport === a.id ? null : a.id)} aria-expanded={openReport === a.id}
                        className="font-medium text-primary-600 dark:text-primary-400 underline py-1">{openReport === a.id ? 'Hide report' : 'View report'}</button>
                    </div>
                    {openReport === a.id && <AttachedReport appointmentId={a.id} />}
                  </div>
                )}
                {a.report_withdrawn && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">The patient withdrew the attached report.</p>}
                {a.doctor_note && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Your note: {a.doctor_note}</p>}
                {['pending', 'confirmed'].includes(a.status) && active?.id !== a.id && (
                  <div className="flex gap-2 mt-3">
                    {a.status === 'pending' && <button type="button" onClick={() => { setActive({ id: a.id, mode: 'confirm' }); setText(''); }} className="btn-primary text-sm py-2 px-3 flex items-center gap-1"><FiCheck aria-hidden="true" />Confirm</button>}
                    {a.status === 'confirmed' && (started(a.appointment_date)
                      ? <button type="button" onClick={() => { setActive({ id: a.id, mode: 'complete' }); setText(''); }} className="btn-primary text-sm py-2 px-3 flex items-center gap-1"><FiCheck aria-hidden="true" />Mark completed</button>
                      : <span className="text-xs text-gray-500 dark:text-gray-400 self-center">Can be marked completed once it starts</span>)}
                    <button type="button" onClick={() => { setActive({ id: a.id, mode: 'decline' }); setText(''); }} className="btn-secondary text-sm py-2 px-3 flex items-center gap-1 !text-red-600"><FiX aria-hidden="true" />Decline</button>
                  </div>
                )}
                {active?.id === a.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3">
                    <div>
                      <label htmlFor={`n-${a.id}`} className="input-label">{active.mode === 'confirm' ? 'Note for the patient (optional)' : active.mode === 'complete' ? 'Follow-up note for the patient (optional)' : 'Reason (optional, shown to the patient in the app)'}</label>
                      <input id={`n-${a.id}`} maxLength={255} className="input-field" value={text} onChange={(e) => setText(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={submit} disabled={busy} className="btn-primary text-sm py-2 px-4">{busy ? 'Saving…' : active.mode === 'confirm' ? 'Confirm appointment' : active.mode === 'complete' ? 'Mark as completed' : 'Decline appointment'}</button>
                      <button type="button" onClick={() => setActive(null)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
};

export default DoctorAppointmentsPage;
