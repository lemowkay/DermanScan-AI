
import React, { useCallback, useEffect, useState } from 'react';
import { FiClock, FiPaperclip } from 'react-icons/fi';

import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import AppointmentStatus from '../components/common/AppointmentStatus';
import SlotPicker from '../components/common/SlotPicker';

import { consultationService, getErrorMessage } from '../services/api';
import { formatDateTime } from '../utils/format';

const today = () => new Date().toISOString().slice(0, 10);

const EVENT_LABELS = {
  booked: 'Appointment requested',
  report_attached: 'You attached your report',
  confirmed: 'Doctor confirmed',
  declined: 'Doctor declined',
  rescheduled: 'You rescheduled',
  cancelled: 'You cancelled',
  completed: 'Doctor marked it completed',
  report_opened_by_doctor: 'Doctor opened your report',
  report_withdrawn: 'You withdrew your report',
};

const Activity = ({ id }) => {
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async (e) => {
    if (!e.target.open || events !== null || loading) return;

    setLoading(true);

    try {
      const response = await consultationService.events(id);
      setEvents(response.data.events);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <details
      onToggle={load}
      className="mt-2 text-xs text-gray-600 dark:text-gray-300"
    >
      <summary className="cursor-pointer font-medium text-primary-600 dark:text-primary-400">
        Who has accessed this
      </summary>

      {loading ? (
        <p role="status" className="mt-1">Loading...</p>
      ) : (
        events && (
          <ul className="mt-1 space-y-1">
            {events.map((ev, i) => (
              <li key={i}>
                {EVENT_LABELS[ev.event] || ev.event}
                {' · '}
                {formatDateTime(ev.created_at)}
              </li>
            ))}
          </ul>
        )
      )}
    </details>
  );
};

const ConsultationPage = () => {
  const [appointments, setAppointments] = useState([]);
  const [refresh, setRefresh] = useState(0);

  const [resched, setResched] = useState(null);
  const [reschedMsg, setReschedMsg] = useState(null);
  const [reschedBusy, setReschedBusy] = useState(false);

  const loadAppointments = useCallback(async () => {
    try {
      const response = await consultationService.getConsultations();
      setAppointments(response.data.consultations);
    } catch {
      // Keep existing appointments if loading fails.
    }
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const withdraw = async (id) => {
    if (!window.confirm(
      'Withdraw your report? The doctor will no longer be able to see it. Your appointment stays.'
    )) return;

    try {
      const response = await consultationService.withdrawReport(id);

      setReschedMsg({
        ok: true,
        text: response.data.message,
      });

      loadAppointments();
    } catch (error) {
      setReschedMsg({
        ok: false,
        text: getErrorMessage(error),
      });
    }
  };

  const cancel = async (id) => {
    if (!window.confirm('Cancel this appointment?')) return;

    try {
      await consultationService.cancel(id);
      loadAppointments();
    } catch (error) {
      setReschedMsg({
        ok: false,
        text: getErrorMessage(error),
      });
    }
  };

  const submitReschedule = async () => {
    if (!resched?.time || reschedBusy) return;

    setReschedBusy(true);
    setReschedMsg(null);

    try {
      const response = await consultationService.reschedule(
        resched.id,
        `${resched.date} ${resched.time}`
      );

      setReschedMsg({
        ok: true,
        text: response.data.message,
      });

      setResched(null);
      loadAppointments();
    } catch (error) {
      setReschedMsg({
        ok: false,
        text: getErrorMessage(error, 'Could not reschedule.'),
      });

      if (error.response?.data?.code === 'slot_unavailable') {
        setRefresh((n) => n + 1);
      }
    } finally {
      setReschedBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
      <Navbar />

      <div className="pt-20 lg:pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-8">
            Doctor Appointment
          </h1>

          <section
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-5 sm:p-6"
            aria-labelledby="mine-title"
          >
            <h2
              id="mine-title"
              className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"
            >
              <FiClock className="text-primary-500" aria-hidden="true" />
              My appointments
            </h2>

            {reschedMsg && (
              <p
                role={reschedMsg.ok ? 'status' : 'alert'}
                className={`text-sm p-3 rounded-xl mb-3 ${
                  reschedMsg.ok
                    ? 'bg-medical-50 dark:bg-medical-900/20 text-medical-800 dark:text-medical-300'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                }`}
              >
                {reschedMsg.text}
              </p>
            )}

            {appointments.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You have not booked any appointments yet.
              </p>
            )}

            <ul className="space-y-3">
              {appointments.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-gray-100 dark:border-gray-700 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {a.doctor_name}
                      </p>

                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                        {formatDateTime(a.appointment_date)} · {a.type}
                      </p>
                    </div>

                    <AppointmentStatus status={a.status} />
                  </div>

                  {a.status === 'pending' && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Waiting for the doctor to confirm.
                    </p>
                  )}

                  {a.has_report && (
                    <div className="mt-2 rounded-xl bg-primary-50/60 dark:bg-primary-900/10 p-3 text-sm">
                      <p className="flex items-center gap-1 font-medium text-gray-900 dark:text-white">
                        <FiPaperclip aria-hidden="true" />
                        Report {a.report_scan_id} attached
                      </p>

                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {a.report_opened_at
                          ? `Opened by the doctor on ${formatDateTime(a.report_opened_at)}`
                          : 'Not opened by the doctor yet'}
                      </p>

                      <button
                        type="button"
                        onClick={() => withdraw(a.id)}
                        className="text-xs font-medium text-red-600 dark:text-red-400 mt-1 py-1"
                      >
                        Withdraw report
                      </button>

                      <Activity id={a.id} />
                    </div>
                  )}

                  {a.report_withdrawn && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Report withdrawn. The doctor can no longer see it.
                    </p>
                  )}

                  {a.doctor_note && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                      <span className="font-semibold">Doctor’s note:</span>{' '}
                      {a.doctor_note}
                    </p>
                  )}

                  {a.can_change && resched?.id !== a.id && (
                    <div className="flex flex-wrap gap-4 mt-2">
                      {a.can_reschedule ? (
                        <button
                          type="button"
                          onClick={() => {
                            setResched({
                              id: a.id,
                              doctorId: a.doctor_id,
                              date: '',
                              time: '',
                            });
                            setReschedMsg(null);
                          }}
                          className="text-sm font-medium text-primary-600 dark:text-primary-400 py-1"
                        >
                          Reschedule
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-gray-400 py-1">
                          Reschedule limit reached. Cancel and book again if needed.
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => cancel(a.id)}
                        className="text-sm font-medium text-red-600 dark:text-red-400 py-1"
                      >
                        Cancel appointment
                      </button>
                    </div>
                  )}

                  {a.reschedule_count > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Rescheduled {a.reschedule_count} of 3 times.
                    </p>
                  )}

                  {resched?.id === a.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3">
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        Pick a new time. The doctor will need to confirm it again.
                      </p>

                      <div>
                        <label
                          htmlFor={`rs-date-${a.id}`}
                          className="input-label"
                        >
                          New date
                        </label>

                        <input
                          id={`rs-date-${a.id}`}
                          type="date"
                          min={today()}
                          className="input-field"
                          value={resched.date}
                          onChange={(e) =>
                            setResched({
                              ...resched,
                              date: e.target.value,
                              time: '',
                            })
                          }
                        />
                      </div>

                      <SlotPicker
                        doctorId={resched.doctorId}
                        date={resched.date}
                        value={resched.time}
                        refreshToken={refresh}
                        label="New time"
                        onChange={(time) =>
                          setResched((current) =>
                            current ? { ...current, time } : current
                          )
                        }
                      />

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={submitReschedule}
                          disabled={!resched.time || reschedBusy}
                          className="btn-primary text-sm py-2 px-4"
                        >
                          {reschedBusy ? 'Saving...' : 'Confirm new time'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setResched(null)}
                          className="btn-secondary text-sm py-2 px-4"
                        >
                          Keep current time
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ConsultationPage;
