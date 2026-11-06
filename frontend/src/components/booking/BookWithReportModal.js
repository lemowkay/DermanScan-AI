import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiX, FiCheck, FiAlertTriangle, FiAlertCircle, FiRefreshCw, FiLock, FiCalendar, FiInfo, FiArrowLeft, FiMail, FiPaperclip, FiVideo, FiMessageSquare, FiUser } from 'react-icons/fi';
import { consultationService, getErrorMessage } from '../../services/api';
import SlotPicker from '../common/SlotPicker';
import Field from '../common/Field';
import { useAuth } from '../../context/AuthContext';
import { initials } from '../common/AppointmentStatus';
import { formatDateTime } from '../../utils/format';

const STEPS = ['Report', 'Doctor & time', 'Confirm'];
const TYPES = [['video', 'Video', FiVideo], ['chat', 'Chat', FiMessageSquare], ['in-person', 'In-person', FiUser]];
const today = () => new Date().toISOString().slice(0, 10);
const uuid = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `k${Date.now()}${Math.random().toString(16).slice(2)}`);

/** Book an appointment with the report attached: report  */
const BookWithReportModal = ({ scanId, onClose, onBooked }) => {
  const dialogRef = useRef(null);
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [options, setOptions] = useState({ include_image: true, include_recommendations: true });
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [doctorsError, setDoctorsError] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [type, setType] = useState('video');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [errors, setErrors] = useState({});
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null);
  const key = useRef(uuid());                       


  useEffect(() => {
    const previous = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const f = dialogRef.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; previous?.focus?.(); };
  }, [onClose, submitting]);

  // Server-built preview: what you see is exactly what is attached.
  const loadPreview = useCallback(async () => {
    try { setPreview((await consultationService.reportPreview({ scan_id: scanId, options })).data); setPreviewError(''); }
    catch (err) { setPreviewError(getErrorMessage(err, 'Could not load the report summary.')); }
  }, [scanId, options]);
  useEffect(() => { loadPreview(); }, [loadPreview]);

  useEffect(() => {
    consultationService.getDoctors()
      .then((r) => setDoctors(r.data.doctors.filter((d) => d.bookable)))
      .catch((e) => setDoctorsError(getErrorMessage(e, 'Could not load the list of doctors.')));
  }, []);

  const doctor = doctors.find((d) => String(d.id) === String(doctorId));
  const sections = preview?.sections || [];
  const attached = sections.filter((s) => s.included);

  const next = () => {
    if (step === 1) {
      const e = {};
      if (!doctorId) e.doctor = 'Please choose a doctor.';
      if (!date) e.date = 'Please choose a date.';
      else if (!time) e.time = 'Please choose a time.';
      setErrors(e);
      if (Object.keys(e).length) return;
    }
    setStep((s) => s + 1);
  };

  
const submit = async () => {
  if (!consent || submitting) return;

  setSubmitting(true);
  setSubmitError('');

  try {
    const appointmentDate = `${date} ${time}`;

    console.log('========== APPOINTMENT DEBUG ==========');
    console.log('SELECTED DATE:', date);
    console.log('SELECTED TIME:', time);
    console.log('SENT TO BACKEND:', appointmentDate);
    console.log(
      'BROWSER TIMEZONE:',
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );

   
    const res = await consultationService.createAppointment({
      doctor_id: Number(doctorId),
      type,
      notes,
      appointment_date: appointmentDate,
      scan_id: scanId,
      options,
      consent: true,
      consent_version: preview.consent_version,
      idempotency_key: key.current,
    });

    
    console.log(
      'BACKEND RETURNED:',
      res.data.consultation.appointment_date
    );
    console.log('FULL BACKEND RESPONSE:', res.data);
    console.log('======================================');

   
    setResult(res.data);
    onBooked?.(res.data.consultation);

  } catch (err) {
    console.error('APPOINTMENT BOOKING ERROR:', err);
    console.error('BACKEND ERROR RESPONSE:', err.response?.data);

    setSubmitError(
      getErrorMessage(
        err,
        'The appointment could not be booked. Nothing was sent. You can try again.'
      )
    );

    if (err.response?.data?.code === 'slot_unavailable') {
      setTime('');
      setRefresh((n) => n + 1);
      setStep(1);
    }

  } finally {
    setSubmitting(false);
  }
};


  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="book-title" tabIndex={-1}
        className="bg-white dark:bg-gray-800 w-full sm:max-w-2xl max-h-[94vh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl outline-none">
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-5 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h2 id="book-title" className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Book appointment with your report</h2>
            {!result && <p className="text-xs text-gray-500 dark:text-gray-400">Step {step + 1} of 3 · {STEPS[step]}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Close"
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><FiX aria-hidden="true" /></button>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-5">
          {result ? (
            <div role="status" aria-live="polite" className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3 bg-amber-100 dark:bg-amber-900/30"><FiCalendar className="text-amber-600 text-3xl" aria-hidden="true" /></div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Appointment requested</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Status: <strong>Pending</strong>. {doctor?.name} has not confirmed it yet. Your report is attached so the doctor can review it before replying.</p>
              </div>
              <dl className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-4 text-sm space-y-2">
                <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Doctor</dt><dd className="font-medium text-gray-900 dark:text-white">{doctor?.name}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">When</dt><dd className="font-medium text-gray-900 dark:text-white">{formatDateTime(result.consultation.appointment_date)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Report</dt><dd className="font-mono font-medium text-gray-900 dark:text-white">{result.consultation.report_scan_id}</dd></div>
              </dl>
              <p className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-2" data-testid="email-note">
                <FiMail className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                {result.email === 'queued'
                  ? <span>A confirmation email is being sent to <strong>{user?.email}</strong>. It contains no health details. You will also be emailed when the doctor responds.</span>
                  : <span>Email notifications are not enabled on this server, so no email was sent. Check “My appointments” for updates.</span>}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/doctors" className="btn-primary text-center flex-1" onClick={onClose}>View my appointments</Link>
                <button type="button" onClick={onClose} className="btn-secondary flex-1">Close</button>
              </div>
            </div>
          ) : (
            <>
              <ol className="flex items-center gap-2" aria-label="Progress">
                {STEPS.map((s, i) => (
                  <li key={s} className="flex-1" aria-current={i === step ? 'step' : undefined}>
                    <div className={'h-1.5 rounded-full ' + (i <= step ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-600')} />
                    <span className={'text-xs mt-1 block ' + (i === step ? 'font-semibold text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400')}>{s}</span>
                  </li>
                ))}
              </ol>

              {step === 0 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">This report will be attached to your appointment request. Review exactly what the doctor will be able to see.</p>
                  {previewError && <p role="alert" className="text-sm text-red-600 dark:text-red-400 flex gap-1"><FiAlertCircle className="mt-0.5" aria-hidden="true" />{previewError}</p>}
                  {!preview && !previewError && <p role="status" className="text-sm text-gray-500 flex items-center gap-2"><FiRefreshCw className="animate-spin" aria-hidden="true" />Loading summary…</p>}
                  
                  <ul className="space-y-2">
                    {sections.map((s) => (
                      <li key={s.key} className="rounded-xl border border-gray-100 dark:border-gray-700 p-3">
                        {s.required ? (
                          <div className="flex items-start gap-3"><FiCheck className="text-medical-600 mt-1 flex-shrink-0" aria-hidden="true" />
                            <div><p className="text-sm font-semibold text-gray-900 dark:text-white">{s.label}</p><p className="text-xs text-gray-500 dark:text-gray-400 break-words">{s.detail}</p></div></div>
                        ) : (
                          <label className={'flex items-start gap-3 ' + (s.available ? 'cursor-pointer' : 'opacity-60')}>
                            <input type="checkbox" className="mt-1 w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 flex-shrink-0"
                              disabled={!s.available} checked={s.included} onChange={(e) => setOptions({ ...options, [s.key]: e.target.checked })} />
                            <div><p className="text-sm font-semibold text-gray-900 dark:text-white">{s.label}</p><p className="text-xs text-gray-500 dark:text-gray-400 break-words">{s.detail}</p></div>
                          </label>
                        )}
                      </li>
                    ))}
                  </ul>
                  <Field id="appt-notes" label="Notes for the doctor (optional)" hint={`${notes.length}/2000 characters`}>
                    <textarea id="appt-notes" rows={3} maxLength={2000} className="input-field resize-none" value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder="Symptoms, how long you have had it, medication, allergies…" />
                  </Field>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <fieldset>
                    <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Choose a doctor</legend>
                    {doctorsError && <p role="alert" className="text-sm text-red-600">{doctorsError}</p>}
                    {!doctorsError && doctors.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No doctor is bookable online yet.</p>}
                    <div className="space-y-2">
                      {doctors.map((d) => (
                        <label key={d.id} className={'flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer ' + (String(doctorId) === String(d.id) ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10' : 'border-gray-100 dark:border-gray-700')}>
                          <input type="radio" name="doctor" className="mt-1 w-5 h-5 text-primary-600 focus:ring-primary-500" checked={String(doctorId) === String(d.id)} onChange={() => { setDoctorId(d.id); setTime(''); setErrors({}); }} />
                          <span className="w-10 h-10 rounded-xl gradient-primary text-white flex items-center justify-center font-bold flex-shrink-0" aria-hidden="true">{initials(d.name)}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{d.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{d.specialty}{d.hospital ? ` · ${d.hospital}` : ''}</p>
                            {d.verified && <p className="text-xs text-medical-700 dark:text-medical-400 mt-0.5">HPCSA registration verified</p>}
                          </div>
                        </label>
                      ))}
                    </div>
                    {errors.doctor && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-2">{errors.doctor}</p>}
                  </fieldset>

                  <div role="radiogroup" aria-label="Consultation type">
                    <p className="input-label" aria-hidden="true">Consultation type</p>
                    <div className="grid grid-cols-3 gap-2">
                      {TYPES.map(([v, label]) => (
                        <button key={v} type="button" role="radio" aria-checked={type === v} onClick={() => setType(v)}
                          className={'py-2 rounded-xl text-sm font-medium transition-all ' + (type === v ? 'bg-primary-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300')}>{label}</button>
                      ))}
                    </div>
                  </div>

                  <Field id="appt-date" label="When would you like the appointment? Date" type="date" min={today()} value={date} error={errors.date}
                    onChange={(e) => { setDate(e.target.value); setTime(''); }} hint="Appointments run Monday–Friday, in 30-minute slots." />
                  <SlotPicker doctorId={doctorId} date={date} value={time} refreshToken={refresh} onChange={setTime} />
                  {errors.time && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{errors.time}</p>}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-4 text-sm space-y-3">
                    <p><span className="text-gray-500 dark:text-gray-400">Appointment with </span><strong className="text-gray-900 dark:text-white">{doctor?.name}</strong>
                      <span className="text-gray-500 dark:text-gray-400"> on </span><strong className="text-gray-900 dark:text-white">{date} at {time}</strong>
                      <span className="text-gray-500 dark:text-gray-400"> ({type})</span></p>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><FiPaperclip aria-hidden="true" /> Report items attached:</p>
                      <ul className="space-y-1">{attached.map((s) => <li key={s.key} className="flex gap-2 text-gray-800 dark:text-gray-200"><FiCheck className="text-medical-600 mt-0.5 flex-shrink-0" aria-hidden="true" /><span>{s.label}</span></li>)}</ul>
                    </div>
                  </div>
                  <label className="flex items-start gap-3 p-4 rounded-xl border-2 border-primary-200 dark:border-primary-800 bg-primary-50/40 dark:bg-primary-900/10 cursor-pointer">
                    <input type="checkbox" className="mt-1 w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 flex-shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    <span className="text-sm text-gray-800 dark:text-gray-200">{preview?.consent_text}</span>
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex gap-2"><FiLock className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    The report is encrypted in storage and only this doctor can open it, while the appointment is active. Every time it is opened is logged where you can see it, and you can withdraw it at any time (POPIA).</p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 flex gap-2"><FiInfo className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    The appointment starts as <strong>Pending</strong> until the doctor confirms it.</p>
                  {submitError && (
                    <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                      <FiAlertCircle className="mt-0.5 flex-shrink-0" aria-hidden="true" /><span>{submitError}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2">
                {step > 0 ? (
                  <button type="button" onClick={() => setStep(step - 1)} disabled={submitting} className="btn-secondary flex items-center justify-center space-x-2"><FiArrowLeft aria-hidden="true" /><span>Back</span></button>
                ) : <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>}
                {step < 2 ? (
                  <button type="button" onClick={next} disabled={step === 0 && !preview} className="btn-primary">Continue</button>
                ) : (
                  <button type="button" onClick={submit} disabled={!consent || submitting} className="btn-primary flex items-center justify-center space-x-2">
                    {submitting ? <><FiRefreshCw className="animate-spin" aria-hidden="true" /><span>Booking…</span></> : <><FiCalendar aria-hidden="true" /><span>{submitError ? 'Try again' : 'Book appointment'}</span></>}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookWithReportModal;
