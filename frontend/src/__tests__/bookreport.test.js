import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import BookWithReportModal from '../components/booking/BookWithReportModal';
import { consultationService } from '../services/api';

jest.mock('../services/api', () => ({
  consultationService: { reportPreview: jest.fn(), getDoctors: jest.fn(), getSlots: jest.fn(), createAppointment: jest.fn() },
  getErrorMessage: (e, f) => e?.response?.data?.message || f,
}));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { email: 'pat@example.com' } }) }));

const FUTURE = '2099-01-05';
const PREVIEW = { data: { is_demo: true, consent_version: '2026-02', consent_text: 'I consent to attaching my report.', sections: [
  { key: 'identity', label: 'Your name', detail: 'Pat', available: true, required: true, included: true },
  { key: 'results', label: 'Assessment results', detail: 'Eczema', available: true, required: true, included: true },
  { key: 'include_recommendations', label: 'AI findings and recommended treatment', detail: '3 item(s)', available: true, required: false, included: true },
  { key: 'include_image', label: 'Uploaded skin image', detail: 'x', available: true, required: false, included: true },
] } };
const DOCS = { data: { doctors: [
  { id: 1, name: 'Dr. Portal', specialty: 'Dermatologist', hospital: 'City Clinic', verified: true, bookable: true },
  { id: 2, name: 'Dr. Walkin', specialty: 'Derm', verified: false, bookable: false },
] } };

const open = (onBooked = jest.fn()) => render(<MemoryRouter><BookWithReportModal scanId="SCN-AB12" onClose={jest.fn()} onBooked={onBooked} /></MemoryRouter>);

const toStep3 = async () => {
  await screen.findByText('Assessment results');
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await userEvent.click(await screen.findByLabelText(/Dr\. Portal/));
  await userEvent.type(screen.getByLabelText(/appointment\? Date/), FUTURE);
  await userEvent.click(await screen.findByRole('radio', { name: '09:30' }));
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
};

beforeEach(() => {
  jest.resetAllMocks();
  consultationService.reportPreview.mockResolvedValue(PREVIEW);
  consultationService.getDoctors.mockResolvedValue(DOCS);
  consultationService.getSlots.mockResolvedValue({ data: { slots: ['09:00', '09:30'] } });
});

test('step 1 shows exactly what is attached, with the experimental-model warning', async () => {
  open();
  expect(await screen.findByText(/demonstration or experimental model/)).toBeInTheDocument();
  expect(screen.getByText('Your name')).toBeInTheDocument();
  expect(screen.getByLabelText(/Uploaded skin image/)).toBeChecked();
  expect(screen.getByText(/Step 1 of 3/)).toBeInTheDocument();
});

test('step 2: only bookable doctors, and a doctor + date + time are required', async () => {
  open();
  await screen.findByText('Assessment results');
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByLabelText(/Dr\. Portal/)).toBeInTheDocument();
  expect(screen.queryByText(/Walkin/)).toBeNull();                                      // not bookable online
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByText('Please choose a doctor.')).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText(/Dr\. Portal/));
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByText('Please choose a date.')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/appointment\? Date/), FUTURE);
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByText('Please choose a time.')).toBeInTheDocument();
  expect(consultationService.createAppointment).not.toHaveBeenCalled();
});

test('consent is required; booking sends report + date/time together and reports Pending honestly', async () => {
  const onBooked = jest.fn();
  consultationService.createAppointment.mockResolvedValue({ data: { email: 'queued', consultation: { id: 9, appointment_date: `${FUTURE}T09:30:00`, report_scan_id: 'SCN-AB12' } } });
  open(onBooked);
  await toStep3();
  expect(screen.getByText('Dr. Portal', { selector: 'strong' })).toBeInTheDocument();
  expect(screen.getByText(`${FUTURE} at 09:30`)).toBeInTheDocument();
  expect(screen.getByText('AI findings and recommended treatment', { selector: 'span' })).toBeInTheDocument();   // attached items are listed
  const book = screen.getByRole('button', { name: 'Book appointment' });
  expect(book).toBeDisabled();
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(book);
  await waitFor(() => expect(consultationService.createAppointment).toHaveBeenCalledWith(expect.objectContaining({
    doctor_id: 1, appointment_date: `${FUTURE} 09:30`, type: 'video', scan_id: 'SCN-AB12', consent: true, consent_version: '2026-02',
    options: { include_image: true, include_recommendations: true } })));
  expect(await screen.findByText('Appointment requested')).toBeInTheDocument();
  expect(screen.getByText(/has not confirmed it yet/)).toBeInTheDocument();
  expect(screen.getByText('SCN-AB12')).toBeInTheDocument();
  expect(screen.getByTestId('email-note')).toHaveTextContent('pat@example.com');
  expect(screen.getByTestId('email-note')).toHaveTextContent('no health details');
  expect(onBooked).toHaveBeenCalled();
  expect(screen.queryByText(/referral/i)).toBeNull();
});

test('unticking optional items removes them from what is sent', async () => {
  consultationService.createAppointment.mockResolvedValue({ data: { email: 'not_configured', consultation: { id: 1, appointment_date: `${FUTURE}T09:30:00`, report_scan_id: 'SCN-AB12' } } });
  open();
  await screen.findByText('Assessment results');
  await userEvent.click(screen.getByLabelText(/Uploaded skin image/));
  await waitFor(() => expect(consultationService.reportPreview).toHaveBeenLastCalledWith(expect.objectContaining({ options: { include_image: false, include_recommendations: true } })));
});

test('failure shows the error with no success, and retry reuses the same idempotency key', async () => {
  consultationService.createAppointment
    .mockRejectedValueOnce({ response: { data: { message: 'Something went wrong on our side.' } } })
    .mockResolvedValueOnce({ data: { email: 'not_configured', consultation: { id: 3, appointment_date: `${FUTURE}T09:30:00`, report_scan_id: 'SCN-AB12' } } });
  open();
  await toStep3();
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Book appointment' }));
  expect(await screen.findByText('Something went wrong on our side.')).toBeInTheDocument();
  expect(screen.queryByText('Appointment requested')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Appointment requested')).toBeInTheDocument();
  expect(screen.getByTestId('email-note')).toHaveTextContent('no email was sent');       // never claims an email went out
  const [a, b] = consultationService.createAppointment.mock.calls.map((c) => c[0]);
  expect(a.idempotency_key).toBeTruthy();
  expect(a.idempotency_key).toBe(b.idempotency_key);
});

test('slot taken at the last moment: back to the time step with the server message and fresh slots', async () => {
  consultationService.createAppointment.mockRejectedValue({ response: { data: { code: 'slot_unavailable', message: 'Someone just booked that slot. Please pick another.' } } });
  open();
  await toStep3();
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Book appointment' }));
  await waitFor(() => expect(screen.getByText(/Step 2 of 3/)).toBeInTheDocument());
  await waitFor(() => expect(consultationService.getSlots).toHaveBeenCalledTimes(2));       // slots reloaded
  expect(screen.getByRole('radio', { name: '09:30' })).toHaveAttribute('aria-checked', 'false');   // chosen time was cleared
});
