import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ConsultationPage from '../pages/ConsultationPage';
import DoctorAppointmentsPage from '../pages/DoctorAppointmentsPage';
import DoctorProfilePage from '../pages/DoctorProfilePage';
import { consultationService, doctorService } from '../services/api';

jest.mock('../services/api', () => ({
  consultationService: { getDoctors: jest.fn(), getConsultations: jest.fn(), getSlots: jest.fn(), createAppointment: jest.fn(), cancel: jest.fn(), reschedule: jest.fn(), withdrawReport: jest.fn(), events: jest.fn() },
  doctorService: { appointments: jest.fn(), confirm: jest.fn(), decline: jest.fn(), complete: jest.fn(), report: jest.fn(), getProfile: jest.fn(), saveProfile: jest.fn() },
  getErrorMessage: (e, f) => e?.response?.data?.message || f,
}));
jest.mock('../components/layout/Navbar', () => () => <nav />);
jest.mock('../components/layout/Footer', () => () => <footer />);
jest.mock('../components/common/AuthImage', () => ({ scanId }) => <div data-testid="auth-image">{scanId}</div>);
jest.mock('framer-motion', () => {
  const Stable = ({ children }) => <div>{children}</div>;
  return { motion: new Proxy({}, { get: () => Stable }) };
});

const DOCTORS = [
  { id: 1, name: 'Jane', specialty: 'Dermatologist', hospital: 'City Clinic', experience: '9 years', bio: 'I treat skin conditions.', rating: 0, verified: true, bookable: true, available: true },
  { id: 2, name: 'Dr. Walkin', specialty: 'Derm', rating: 4.5, verified: false, bookable: false, available: true },
];
const FUTURE = '2099-01-05';

beforeEach(() => {
  jest.resetAllMocks();
  window.confirm = jest.fn(() => true);
  consultationService.getDoctors.mockResolvedValue({ data: { doctors: DOCTORS } });
  consultationService.getConsultations.mockResolvedValue({ data: { consultations: [] } });
  consultationService.getSlots.mockResolvedValue({ data: { slots: ['09:00', '09:30'] } });
});

const page = () => render(<MemoryRouter><ConsultationPage /></MemoryRouter>);

test('registered doctors are listed with profile + verified badge; a one-word name does not crash', async () => {
  page();
  expect(await screen.findByText('I treat skin conditions.')).toBeInTheDocument();
  expect(screen.getByText('Jane')).toBeInTheDocument();
  expect(screen.getByText(/HPCSA registration verified/)).toBeInTheDocument();
  expect(screen.getByText('New')).toBeInTheDocument();                             // no fake 0 rating
  expect(screen.getByText(/Not available for online booking yet/)).toBeInTheDocument();
  const select = screen.getByLabelText('Select Doctor');
  expect(within(select).queryByText(/Walkin/)).toBeNull();                          // not bookable -> not in the booking list
});

test('book: pick doctor, date and a free slot; submit stays disabled until a time is chosen', async () => {
  consultationService.createAppointment.mockResolvedValue({ data: { consultation: { id: 5 } } });
  page();
  await screen.findByText('Jane');
  await userEvent.click(screen.getByRole('button', { name: 'Book appointment' }));
  expect(screen.getByLabelText('Select Doctor')).toHaveValue('1');
  await userEvent.type(screen.getByLabelText('Date'), FUTURE);
  const submit = screen.getByRole('button', { name: /request appointment/i });
  expect(submit).toBeDisabled();
  await waitFor(() => expect(consultationService.getSlots).toHaveBeenCalledWith('1', FUTURE));
  await userEvent.click(await screen.findByRole('radio', { name: '09:30' }));
  expect(submit).toBeEnabled();
  await userEvent.click(submit);
  await waitFor(() => expect(consultationService.createAppointment).toHaveBeenCalledWith(expect.objectContaining({ doctor_id: 1, appointment_date: `${FUTURE} 09:30`, type: 'video' })));
  expect(await screen.findByText(/Pending: the doctor has not confirmed it yet/)).toBeInTheDocument();
});

test('slot taken by someone else: shows the server message and reloads free slots', async () => {
  consultationService.createAppointment.mockRejectedValue({ response: { status: 409, data: { code: 'slot_unavailable', message: 'Someone just booked that slot. Please pick another.' } } });
  page();
  await screen.findByText('Jane');
  await userEvent.click(screen.getByRole('button', { name: 'Book appointment' }));
  await userEvent.type(screen.getByLabelText('Date'), FUTURE);
  await userEvent.click(await screen.findByRole('radio', { name: '09:00' }));
  await userEvent.click(screen.getByRole('button', { name: /request appointment/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Someone just booked that slot');
  await waitFor(() => expect(consultationService.getSlots).toHaveBeenCalledTimes(2));
});

test('my appointments: shows honest status, doctor note, and cancels', async () => {
  consultationService.getConsultations.mockResolvedValue({ data: { consultations: [
    { id: 7, doctor_id: 1, doctor_name: 'Jane', appointment_date: '2099-01-05T09:00:00', type: 'video', status: 'confirmed', doctor_note: 'Bring scans', can_change: true, can_reschedule: true },
    { id: 8, doctor_id: 1, doctor_name: 'Jane', appointment_date: '2099-01-06T09:00:00', type: 'chat', status: 'pending', can_change: true, can_reschedule: true }] } });
  consultationService.cancel.mockResolvedValue({ data: {} });
  page();
  expect(await screen.findByText('Confirmed')).toBeInTheDocument();
  expect(screen.getByText('Pending')).toBeInTheDocument();
  expect(screen.getByText(/Waiting for the doctor to confirm/)).toBeInTheDocument();
  expect(screen.getByText(/Bring scans/)).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole('button', { name: 'Cancel appointment' })[1]);
  await waitFor(() => expect(consultationService.cancel).toHaveBeenCalledWith(8));
});

test('doctor: confirm a pending request with a note, and decline another', async () => {
  doctorService.appointments.mockResolvedValue({ data: { appointments: [
    { id: 1, patient_name: 'Pat Patient', appointment_date: '2099-01-05T09:00:00', type: 'video', status: 'pending', notes: 'rash on arm' }] } });
  doctorService.confirm.mockResolvedValue({ data: {} });
  doctorService.decline.mockResolvedValue({ data: {} });
  render(<MemoryRouter><DoctorAppointmentsPage /></MemoryRouter>);
  expect(await screen.findByText('Pat Patient')).toBeInTheDocument();
  expect(screen.getByText(/rash on arm/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await userEvent.type(screen.getByLabelText(/Note for the patient/), 'Bring scans');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm appointment' }));
  await waitFor(() => expect(doctorService.confirm).toHaveBeenCalledWith(1, 'Bring scans'));
  await userEvent.click(await screen.findByRole('button', { name: 'Decline' }));
  await userEvent.click(screen.getByRole('button', { name: 'Decline appointment' }));
  await waitFor(() => expect(doctorService.decline).toHaveBeenCalledWith(1, ''));
});

test('doctor profile: pending doctor can edit but is told they are not visible yet', async () => {
  doctorService.getProfile.mockResolvedValue({ data: { listed: false, verification_status: 'pending', doctor: { specialty: 'Medical Practitioner', hospital: null, experience: null, phone: null, bio: null, available: true, verified: false } } });
  doctorService.saveProfile.mockResolvedValue({ data: { listed: false } });
  render(<MemoryRouter><DoctorProfilePage /></MemoryRouter>);
  expect(await screen.findByText(/once an administrator verifies your HPCSA registration/)).toBeInTheDocument();
  expect(screen.getByLabelText('Specialty')).toHaveValue('');                       // placeholder not shown as if it were real
  await userEvent.type(screen.getByLabelText('Specialty'), 'Dermatologist');
  await userEvent.type(screen.getByLabelText('About you'), 'Hello');
  await userEvent.click(screen.getByRole('button', { name: /save profile/i }));
  await waitFor(() => expect(doctorService.saveProfile).toHaveBeenCalledWith(expect.objectContaining({ specialty: 'Dermatologist', bio: 'Hello' })));
  expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
});

const APPT = { id: 7, doctor_id: 1, doctor_name: 'Jane', appointment_date: '2099-01-05T09:00:00', type: 'video', status: 'confirmed', can_change: true, can_reschedule: true, reschedule_count: 0 };

test('reschedule: pick new date + slot, confirm, and be told it needs re-confirmation', async () => {
  consultationService.getConsultations.mockResolvedValue({ data: { consultations: [APPT] } });
  consultationService.reschedule.mockResolvedValue({ data: { message: 'Appointment rescheduled. It needs the doctor to confirm the new time.' } });
  page();
  await userEvent.click(await screen.findByRole('button', { name: 'Reschedule' }));
  expect(screen.getByText(/doctor will need to confirm it again/)).toBeInTheDocument();
  const confirm = screen.getByRole('button', { name: 'Confirm new time' });
  expect(confirm).toBeDisabled();
  await userEvent.type(screen.getByLabelText('New date'), FUTURE);
  await waitFor(() => expect(consultationService.getSlots).toHaveBeenCalledWith(1, FUTURE));
  await userEvent.click(await screen.findByRole('radio', { name: '09:30' }));
  await userEvent.click(confirm);
  await waitFor(() => expect(consultationService.reschedule).toHaveBeenCalledWith(7, `${FUTURE} 09:30`));
  expect(await screen.findByText(/needs the doctor to confirm the new time/)).toBeInTheDocument();
});

test('reschedule: slot taken -> error shown and slots reloaded; "keep current time" closes the panel', async () => {
  consultationService.getConsultations.mockResolvedValue({ data: { consultations: [APPT] } });
  consultationService.reschedule.mockRejectedValue({ response: { data: { code: 'slot_unavailable', message: 'Someone just booked that slot. Please pick another.' } } });
  page();
  await userEvent.click(await screen.findByRole('button', { name: 'Reschedule' }));
  await userEvent.type(screen.getByLabelText('New date'), FUTURE);
  await userEvent.click(await screen.findByRole('radio', { name: '09:00' }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirm new time' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Someone just booked that slot');
  await waitFor(() => expect(consultationService.getSlots).toHaveBeenCalledTimes(2));
  await userEvent.click(screen.getByRole('button', { name: 'Keep current time' }));
  expect(screen.queryByLabelText('New date')).toBeNull();
});

test('reschedule limit reached: no reschedule button, explains why; completed appointments have no actions', async () => {
  consultationService.getConsultations.mockResolvedValue({ data: { consultations: [
    { ...APPT, id: 1, can_reschedule: false, reschedule_count: 3 },
    { ...APPT, id: 2, status: 'completed', can_change: false, can_reschedule: false, doctor_note: 'Follow-up in 2 weeks' }] } });
  page();
  expect(await screen.findByText(/Reschedule limit reached/)).toBeInTheDocument();
  expect(screen.getByText('Rescheduled 3 of 3 times.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reschedule' })).toBeNull();
  expect(screen.getByText('Completed')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Cancel appointment' })).toHaveLength(1);       // only the active one
  expect(screen.getByText(/Follow-up in 2 weeks/)).toBeInTheDocument();
});

test('doctor: can mark a started confirmed appointment completed; future ones show a hint instead', async () => {
  doctorService.appointments.mockResolvedValue({ data: { appointments: [
    { id: 1, patient_name: 'Past Pat', appointment_date: '2000-01-05T09:00:00', type: 'video', status: 'confirmed' },
    { id: 2, patient_name: 'Future Fred', appointment_date: '2099-01-05T09:00:00', type: 'video', status: 'confirmed' }] } });
  doctorService.complete.mockResolvedValue({ data: {} });
  render(<MemoryRouter><DoctorAppointmentsPage /></MemoryRouter>);
  expect(await screen.findByText('Future Fred')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Mark completed' })).toHaveLength(1);
  expect(screen.getByText(/Can be marked completed once it starts/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Mark completed' }));
  await userEvent.type(screen.getByLabelText(/Follow-up note/), 'Review in 2 weeks');
  await userEvent.click(screen.getByRole('button', { name: 'Mark as completed' }));
  await waitFor(() => expect(doctorService.complete).toHaveBeenCalledWith(1, 'Review in 2 weeks'));
  expect(screen.getByRole('tab', { name: 'Completed' })).toBeInTheDocument();
});

test('patient sees the attached report status, can read the access log and withdraw it', async () => {
  consultationService.getConsultations.mockResolvedValue({ data: { consultations: [
    { ...APPT, id: 20, status: 'pending', has_report: true, report_scan_id: 'SCN-AB12', report_opened_at: null },
    { ...APPT, id: 21, has_report: true, report_scan_id: 'SCN-CD34', report_opened_at: '2099-01-04T08:00:00' },
    { ...APPT, id: 22, has_report: false, report_withdrawn: true }] } });
  consultationService.events.mockResolvedValue({ data: { events: [{ event: 'booked', created_at: '2099-01-01T08:00:00' }, { event: 'report_opened_by_doctor', created_at: '2099-01-04T08:00:00' }] } });
  consultationService.withdrawReport.mockResolvedValue({ data: { message: 'Report withdrawn. The doctor can no longer see it.' } });
  page();
  expect(await screen.findByText('Report SCN-AB12 attached')).toBeInTheDocument();
  expect(screen.getByText('Not opened by the doctor yet')).toBeInTheDocument();
  expect(screen.getByText(/Opened by the doctor on/)).toBeInTheDocument();
  expect(screen.getByText(/Report withdrawn\. The doctor can no longer see it\./)).toBeInTheDocument();
  await userEvent.click(screen.getAllByText('Who has accessed this')[1]);
  expect(await screen.findByText(/Doctor opened your report/)).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole('button', { name: 'Withdraw report' })[0]);
  await waitFor(() => expect(consultationService.withdrawReport).toHaveBeenCalledWith(20));
});

test('doctor receives the booking as an appointment with the report inside it', async () => {
  doctorService.appointments.mockResolvedValue({ data: { appointments: [
    { id: 5, patient_name: 'Pat Patient', appointment_date: '2099-01-05T09:00:00', type: 'video', status: 'pending', notes: 'itches at night',
      has_report: true, report_condition: 'Eczema (dermatitis)', report_severity: 'Mild', report_has_image: true },
    { id: 6, patient_name: 'No Report', appointment_date: '2099-01-06T09:00:00', type: 'chat', status: 'pending', has_report: false, report_withdrawn: true }] } });
  doctorService.report.mockResolvedValue({ data: { report: { report_reference: 'SCN-AB12', assessment_date: '2099-01-01T08:00:00', patient: { name: 'Pat Patient' },
    results: { condition: 'Eczema (dermatitis)', confidence_score: 91.2, severity: 'Mild', symptoms: ['Dry scaly patches'], model_version: 'experimental:x.keras', is_demo: true },
    ai_recommendations: ['Moisturise daily'], image: { shared: true } } } });
  render(<MemoryRouter><DoctorAppointmentsPage /></MemoryRouter>);
  expect(await screen.findByText('Pat Patient')).toBeInTheDocument();
  expect(screen.getByText(/Report attached: Eczema \(dermatitis\)/)).toBeInTheDocument();
  expect(screen.getByText(/The patient withdrew the attached report/)).toBeInTheDocument();
  expect(screen.queryByText(/referral/i)).toBeNull();                                     // it is an appointment, not a referral
  expect(doctorService.report).not.toHaveBeenCalled();                                     // not opened until the doctor asks
  await userEvent.click(screen.getByRole('button', { name: 'View report' }));
  expect(await screen.findByTestId('attached-report')).toBeInTheDocument();
  expect(screen.getByText('91.2%')).toBeInTheDocument();
  expect(screen.getByText('Dry scaly patches')).toBeInTheDocument();
  expect(screen.getByText('Moisturise daily')).toBeInTheDocument();
  expect(screen.getByText(/demonstration or experimental model/)).toBeInTheDocument();
  expect(screen.getByTestId('auth-image')).toHaveTextContent('SCN-AB12');
  expect(doctorService.report).toHaveBeenCalledWith(5);
});
