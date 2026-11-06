import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import ProtectedRoute from '../components/ProtectedRoute';
import { authService } from '../services/api';

jest.mock('../services/api', () => ({
  authService: { login: jest.fn(), register: jest.fn(), getProfile: jest.fn() },
  getErrorMessage: (e, f) => e?.response?.data?.message || f,
}));
jest.mock('../components/layout/Navbar', () => () => <nav />);
jest.mock('framer-motion', () => {
  const Stable = ({ children }) => <div>{children}</div>;
  return { motion: new Proxy({}, { get: () => Stable }) };
});

const app = (path) => render(
  <MemoryRouter initialEntries={[path]}><AuthProvider><Routes>
    <Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} />
    <Route path="/dashboard" element={<ProtectedRoute roles={['user']}><div>DASH</div></ProtectedRoute>} />
    <Route path="/doctor/appointments" element={<ProtectedRoute roles={['doctor']}><div>APPOINTMENTS PAGE</div></ProtectedRoute>} />
    <Route path="/doctor/pending" element={<div>PENDING PAGE</div>} />
  </Routes></AuthProvider></MemoryRouter>);

const fillLogin = async (email = 'a@b.co') => {
  await userEvent.type(screen.getByLabelText('Email address'), email);
  await userEvent.type(screen.getByLabelText('Password'), 'Password1');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
};

beforeEach(() => { localStorage.clear(); jest.resetAllMocks(); });

test('anonymous user is redirected to login', async () => {
  app('/dashboard');
  expect(await screen.findByText('Welcome back')).toBeInTheDocument();
});

test('login shows role cards, Patient selected by default, sends the selected role', async () => {
  authService.login.mockResolvedValue({ data: { token: 'tok', user: { id: 1, role: 'user', name: 'A', email: 'a@b.co' } } });
  app('/login');
  const patient = screen.getByRole('radio', { name: /Patient/ });
  expect(patient).toHaveAttribute('aria-checked', 'true');
  await fillLogin();
  expect(await screen.findByText('DASH')).toBeInTheDocument();
  expect(authService.login).toHaveBeenCalledWith('a@b.co', 'Password1', 'user');
  expect(localStorage.getItem('token')).toBe('tok');
});

test('choosing Doctor card sends role=doctor; verified doctor lands on their appointments', async () => {
  authService.login.mockResolvedValue({ data: { token: 't', user: { id: 2, role: 'doctor', verification_status: 'approved', name: 'D', email: 'd@x.co' } } });
  app('/login');
  await userEvent.click(screen.getByRole('radio', { name: /Doctor/ }));
  expect(screen.getByRole('radio', { name: /Doctor/ })).toHaveAttribute('aria-checked', 'true');
  await fillLogin('d@x.co');
  expect(await screen.findByText('APPOINTMENTS PAGE')).toBeInTheDocument();
  expect(authService.login).toHaveBeenCalledWith('d@x.co', 'Password1', 'doctor');
});

test('pending doctor is sent to the verification page, not the appointments', async () => {
  authService.login.mockResolvedValue({ data: { token: 't', user: { id: 2, role: 'doctor', verification_status: 'pending', name: 'D', email: 'd@x.co' } } });
  app('/login');
  await userEvent.click(screen.getByRole('radio', { name: /Doctor/ }));
  await fillLogin('d@x.co');
  expect(await screen.findByText('PENDING PAGE')).toBeInTheDocument();
  expect(screen.queryByText('APPOINTMENTS PAGE')).toBeNull();
});

test('role mismatch error from server is shown and nothing is stored', async () => {
  authService.login.mockRejectedValue({ response: { status: 403, data: { message: 'This is a patient account. Please select "Patient" to sign in.' } } });
  app('/login');
  await userEvent.click(screen.getByRole('radio', { name: /Doctor/ }));
  await fillLogin();
  expect(await screen.findByRole('alert')).toHaveTextContent('This is a patient account');
  expect(localStorage.getItem('token')).toBeNull();
});

test('wrong password shows server error and stays on page', async () => {
  authService.login.mockRejectedValue({ response: { status: 401, data: { message: 'Incorrect email or password.' } } });
  app('/login');
  await fillLogin();
  expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
});

test('radio cards support arrow-key selection', async () => {
  app('/login');
  screen.getByRole('radio', { name: /Patient/ }).focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByRole('radio', { name: /Doctor/ })).toHaveAttribute('aria-checked', 'true');
});

test('patient registration: validates, confirms password, sends role=user without HPCSA fields', async () => {
  authService.register.mockResolvedValue({ data: { token: 't', user: { id: 3, role: 'user', name: 'N', email: 'n@x.co' } } });
  app('/register');
  expect(screen.queryByLabelText(/HPCSA/)).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: /create account/i }));
  expect(authService.register).not.toHaveBeenCalled();
  expect(await screen.findByText('Please enter your full name.')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Full name'), 'New Person');
  await userEvent.type(screen.getByLabelText('Email address'), 'n@x.co');
  await userEvent.type(screen.getByLabelText('Password'), 'Password1');
  await userEvent.type(screen.getByLabelText('Confirm password'), 'Different1');
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: /create account/i }));
  expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
  expect(authService.register).not.toHaveBeenCalled();
  await userEvent.clear(screen.getByLabelText('Confirm password'));
  await userEvent.type(screen.getByLabelText('Confirm password'), 'Password1');
  await userEvent.click(screen.getByRole('button', { name: /create account/i }));
  await waitFor(() => expect(authService.register).toHaveBeenCalledWith({
    role: 'user', name: 'New Person', email: 'n@x.co', password: 'Password1', confirm_password: 'Password1', accepted_terms: true }));
  expect(await screen.findByText('DASH')).toBeInTheDocument();
});

test('doctor registration requires a valid HPCSA number; practice number optional; lands on pending page', async () => {
  authService.register.mockResolvedValue({ data: { token: 't', user: { id: 4, role: 'doctor', verification_status: 'pending', name: 'Dr', email: 'd@x.co' } } });
  app('/register');
  await userEvent.click(screen.getByRole('radio', { name: /Doctor/ }));
  const hp = screen.getByLabelText(/HPCSA registration number/);
  expect(hp).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Full name'), 'Dr Jane Smith');
  await userEvent.type(screen.getByLabelText('Email address'), 'd@x.co');
  await userEvent.type(screen.getByLabelText('Password'), 'Password1');
  await userEvent.type(screen.getByLabelText('Confirm password'), 'Password1');
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: /submit for verification/i }));
  expect(await screen.findByText('HPCSA registration number is required for doctors.')).toBeInTheDocument();
  await userEvent.type(hp, '123');
  await userEvent.click(screen.getByRole('button', { name: /submit for verification/i }));
  expect(await screen.findByText(/Enter a valid HPCSA number/)).toBeInTheDocument();
  expect(authService.register).not.toHaveBeenCalled();
  await userEvent.clear(hp);
  await userEvent.type(hp, 'mp 0729515');
  await userEvent.click(screen.getByRole('button', { name: /submit for verification/i }));
  await waitFor(() => expect(authService.register).toHaveBeenCalledWith(expect.objectContaining({
    role: 'doctor', hpcsa_number: 'mp 0729515', practice_number: '', confirm_password: 'Password1' })));
  expect(await screen.findByText('PENDING PAGE')).toBeInTheDocument();
});

test('server field errors (duplicate HPCSA) are displayed', async () => {
  authService.register.mockRejectedValue({ response: { status: 409, data: { message: 'This HPCSA number is already registered.', errors: { hpcsa_number: 'This HPCSA number is already registered.' } } } });
  app('/register');
  await userEvent.click(screen.getByRole('radio', { name: /Doctor/ }));
  await userEvent.type(screen.getByLabelText('Full name'), 'Dr Jane Smith');
  await userEvent.type(screen.getByLabelText('Email address'), 'd@x.co');
  await userEvent.type(screen.getByLabelText(/HPCSA registration number/), 'MP0729515');
  await userEvent.type(screen.getByLabelText('Password'), 'Password1');
  await userEvent.type(screen.getByLabelText('Confirm password'), 'Password1');
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: /submit for verification/i }));
  expect((await screen.findAllByText('This HPCSA number is already registered.')).length).toBeGreaterThan(0);
});

test('role cards are just a logo and a title (Patient / Doctor), nothing else', () => {
  app('/login');
  const patient = screen.getByRole('radio', { name: 'Patient' });
  const doctor = screen.getByRole('radio', { name: 'Doctor' });
  expect(patient).toHaveTextContent(/^Patient$/);          // title only, no description text
  expect(doctor).toHaveTextContent(/^Doctor$/);
  expect(patient.querySelector('svg')).not.toBeNull();     // logo
  expect(doctor.querySelector('svg')).not.toBeNull();
  expect(screen.getByTestId('logo-user')).toBeInTheDocument();
  expect(screen.getByTestId('logo-doctor')).toBeInTheDocument();
  expect(screen.queryByText(/Scan my skin|HPCSA registered/)).toBeNull();
});
