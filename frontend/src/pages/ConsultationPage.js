import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FiUser, FiCalendar, FiMessageSquare, FiVideo, FiSearch, FiStar, FiMapPin, FiShield, FiPhone, FiClock, FiInfo, FiPaperclip } from 'react-icons/fi';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import AppointmentStatus, { initials } from '../components/common/AppointmentStatus';
import SlotPicker from '../components/common/SlotPicker';
import { consultationService, getErrorMessage } from '../services/api';
import { formatDateTime } from '../utils/format';

const COLORS = ['from-primary-500 to-sky-500', 'from-sky-500 to-primary-600', 'from-medical-500 to-primary-500', 'from-primary-600 to-sky-500'];
const TYPES = [['video', 'Video', FiVideo], ['chat', 'Chat', FiMessageSquare], ['in-person', 'In-person', FiUser]];
const EVENT_LABELS = {
  booked: 'Appointment requested', report_attached: 'You attached your report', confirmed: 'Doctor confirmed', declined: 'Doctor declined',
  rescheduled: 'You rescheduled', cancelled: 'You cancelled', completed: 'Doctor marked it completed',
  report_opened_by_doctor: 'Doctor opened your report', report_withdrawn: 'You withdrew your report',
};

const Activity = ({ id }) => {
  const [events, setEvents] = useState(null);
  const load = (e) => { if (e.target.open && !events) consultationService.events(id).then((r) => setEvents(r.data.events)).catch(() => setEvents([])); };
  return (
    <details onToggle={load} className="mt-2 text-xs text-gray-600 dark:text-gray-300">
      <summary className="cursor-pointer font-medium text-primary-600 dark:text-primary-400">Who has accessed this</summary>
      {!events ? <p role="status" className="mt-1">Loading…</p> : (
        <ul className="mt-1 space-y-1">{events.map((ev, i) => <li key={i}>{EVENT_LABELS[ev.event] || ev.event} · {formatDateTime(ev.created_at)}</li>)}</ul>
      )}
    </details>
  );
};

const today = () => new Date().toISOString().slice(0, 10);

const ConsultationPage = () => {
  const formRef = useRef(null);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [query, setQuery] = useState('');
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ doctorId: '', date: '', time: '', type: 'video', notes: '' });
  const [refresh, setRefresh] = useState(0);             
  const [resched, setResched] = useState(null);         
  const [reschedMsg, setReschedMsg] = useState(null);
  const [reschedBusy, setReschedBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);    // { ok, text }

  const loadAppointments = useCallback(() => consultationService.getConsultations()
    .then((r) => setAppointments(r.data.consultations)).catch(() => {}), []);

  useEffect(() => {
    consultationService.getDoctors()
      .then((res) => setDoctors(res.data.doctors.map((d, i) => ({ ...d, color: COLORS[i % COLORS.length] }))))
      .catch((e) => setLoadError(getErrorMessage(e, 'Could not load doctors.')));
    loadAppointments();
  }, [loadAppointments]);

  const visible = doctors.filter((d) => `${d.name} ${d.specialty} ${d.hospital || ''}`.toLowerCase().includes(query.toLowerCase()));
  const bookable = doctors.filter((d) => d.bookable);

  const choose = (id) => {
    setForm((f) => ({ ...f, doctorId: String(id) }));
    setFeedback(null);
    formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting || !form.time) return;
    setSubmitting(true); setFeedback(null);
    try {
      await consultationService.createAppointment({
        doctor_id: Number(form.doctorId), type: form.type, notes: form.notes, appointment_date: `${form.date} ${form.time}`,
      });
      setFeedback({ ok: true, text: 'Appointment requested. Its status is Pending: the doctor has not confirmed it yet, and you will be told when they respond.' });
      setForm({ doctorId: '', date: '', time: '', type: 'video', notes: '' });
      loadAppointments();
    } catch (err) {
      setFeedback({ ok: false, text: getErrorMessage(err, 'Could not book the appointment.') });
      if (err.response?.data?.code === 'slot_unavailable') setRefresh((n) => n + 1);   // show what is free now
    } finally { setSubmitting(false); }
  };

  const withdraw = async (id) => {
    if (!window.confirm('Withdraw your report? The doctor will no longer be able to see it. Your appointment stays.')) return;
    try { const r = await consultationService.withdrawReport(id); setReschedMsg({ ok: true, text: r.data.message }); loadAppointments(); }
    catch (e) { setReschedMsg({ ok: false, text: getErrorMessage(e) }); }
  };

  const cancel = async (id) => {
    if (!window.confirm('Cancel this appointment?')) return;
    try { await consultationService.cancel(id); loadAppointments(); }
    catch (e) { setFeedback({ ok: false, text: getErrorMessage(e) }); }
  };

  const submitReschedule = async () => {
    if (!resched?.time || reschedBusy) return;
    setReschedBusy(true); setReschedMsg(null);
    try {
      const r = await consultationService.reschedule(resched.id, `${resched.date} ${resched.time}`);
      setReschedMsg({ ok: true, text: r.data.message });
      setResched(null); loadAppointments();
    } catch (err) {
      setReschedMsg({ ok: false, text: getErrorMessage(err, 'Could not reschedule.') });
      if (err.response?.data?.code === 'slot_unavailable') setRefresh((n) => n + 1);
    } finally { setReschedBusy(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
      <Navbar />
      <div className="pt-20 lg:pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Doctor Consultation</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Browse registered doctors and book an appointment</p>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <section aria-labelledby="doctors-title">
                <div className="flex items-center justify-between mb-4 gap-3">
                  <h2 id="doctors-title" className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                    <FiUser className="text-primary-500" aria-hidden="true" /><span>Doctors</span>
                  </h2>
                  <div className="relative w-40 sm:w-64">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                    <input type="search" aria-label="Search doctors" value={query} onChange={(e) => setQuery(e.target.value)} className="input-field pl-10 py-2 text-sm" placeholder="Search doctors..." />
                  </div>
                </div>
                {loadError && <p role="alert" className="text-red-600 dark:text-red-400 mb-3">{loadError}</p>}
                {!loadError && doctors.length === 0 && <p className="text-gray-500 dark:text-gray-400">No doctors are available right now.</p>}
                <ul className="space-y-4">
                  {visible.map((d) => (
                    <li key={d.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 sm:p-5">
                      <div className="flex items-start space-x-4">
                        <div className={'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ' + d.color + ' flex items-center justify-center text-white text-xl font-bold flex-shrink-0'} aria-hidden="true">
                          {initials(d.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-bold text-gray-900 dark:text-white truncate">{d.name}</h3>
                              <p className="text-sm text-primary-600 dark:text-primary-400">{d.specialty}</p>
                            </div>
                            <div className="flex items-center space-x-1 text-sm flex-shrink-0">
                              {d.rating > 0
                                ? <><FiStar className="text-yellow-400 fill-current" aria-hidden="true" /><span className="font-medium text-gray-900 dark:text-white">{d.rating}</span></>
                                : <span className="text-xs text-gray-500 dark:text-gray-400">New</span>}
                            </div>
                          </div>
                          {d.verified && (
                            <p className="inline-flex items-center gap-1 text-xs font-semibold text-medical-700 dark:text-medical-400 mt-1">
                              <FiShield aria-hidden="true" /> HPCSA registration verified
                            </p>
                          )}
                          {d.bio && <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 break-words">{d.bio}</p>}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-gray-500 dark:text-gray-400">
                            {d.hospital && <span className="flex items-center space-x-1"><FiMapPin className="text-primary-400" aria-hidden="true" /><span>{d.hospital}</span></span>}
                            {d.experience && <span className="flex items-center space-x-1"><FiCalendar className="text-primary-400" aria-hidden="true" /><span>{d.experience}</span></span>}
                            {d.phone && <span className="flex items-center space-x-1"><FiPhone className="text-primary-400" aria-hidden="true" /><span>{d.phone}</span></span>}
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            {d.bookable
                              ? <button type="button" onClick={() => choose(d.id)} className="btn-primary text-sm py-2 px-4">Book appointment</button>
                              : <span className="inline-flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300"><FiInfo aria-hidden="true" /> Not available for online booking yet</span>}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              
            </div>

            <div className="space-y-6">
              <section ref={formRef} aria-labelledby="book-title" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-5 sm:p-6 lg:sticky lg:top-24">
                <h2 id="book-title" className="text-lg font-bold text-gray-900 dark:text-white mb-4">Book Appointment</h2>
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <label htmlFor="book-doctor" className="input-label">Select Doctor</label>
                    <select id="book-doctor" className="input-field" value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })} required>
                      <option value="">Choose a doctor</option>
                      {bookable.map((d) => <option key={d.id} value={d.id}>{d.name} - {d.specialty}</option>)}
                    </select>
                    {doctors.length > 0 && bookable.length === 0 && <p className="text-xs text-gray-500 mt-1">No doctor is bookable online yet.</p>}
                  </div>
                  <div role="radiogroup" aria-label="Consultation type">
                    <p className="input-label" aria-hidden="true">Consultation Type</p>
                    <div className="grid grid-cols-3 gap-2">
                      {TYPES.map(([v, label]) => (
                        <button key={v} type="button" role="radio" aria-checked={form.type === v} onClick={() => setForm({ ...form, type: v })}
                          className={'py-2 rounded-xl text-sm font-medium transition-all ' + (form.type === v ? 'bg-primary-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300')}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="book-date" className="input-label">Date</label>
                    <input id="book-date" type="date" min={today()} className="input-field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Appointments run Monday–Friday, in 30-minute slots.</p>
                  </div>
                  <SlotPicker doctorId={form.doctorId} date={form.date} value={form.time} refreshToken={refresh} onChange={(t) => setForm((f) => ({ ...f, time: t }))} />
                  <div>
                    <label htmlFor="book-notes" className="input-label">Notes (Optional)</label>
                    <textarea id="book-notes" rows={3} maxLength={2000} className="input-field resize-none" placeholder="Describe your condition..."
                      value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Only the doctor you book can read this.</p>
                  </div>
                  {feedback && <p role={feedback.ok ? 'status' : 'alert'} className={'text-sm p-3 rounded-xl ' + (feedback.ok ? 'bg-medical-50 dark:bg-medical-900/20 text-medical-800 dark:text-medical-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300')}>{feedback.text}</p>}
                  <button type="submit" disabled={submitting || !form.time} className="btn-primary w-full py-4 text-base">
                    {submitting ? 'Sending…' : 'Request Appointment'}
                  </button>
                </form>
              </section>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ConsultationPage;
