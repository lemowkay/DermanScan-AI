import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { FiUserPlus, FiEye, FiEyeOff, FiRefreshCw, FiAlertCircle, FiInfo } from 'react-icons/fi';
import AuthShell from '../components/layout/AuthShell';
import Field from '../components/common/Field';
import RoleCards from '../components/common/RoleCards';
import { useAuth, homeFor } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const HPCSA_RE = /^[A-Z]{2,3}\d{5,8}$/;
const PRACTICE_RE = /^[A-Za-z0-9\-/ ]{3,20}$/;

export const normalizeHpcsa = (v) => v.replace(/[\s-]+/g, '').toUpperCase();

export const validatePassword = (pw) => {
  if (pw.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must contain at least one letter and one number.';
  return '';
};

const EMPTY = { name: '', email: '', password: '', confirm: '', hpcsa: '', practice: '', accepted: false };

const RegisterPage = () => {
  const { register, isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('user');
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isDoctor = role === 'doctor';
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (!loading && isAuthenticated) return <Navigate to={homeFor(user)} replace />;

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Please enter your full name.';
    if (!EMAIL_RE.test(form.email.trim())) e.email = 'Please enter a valid email address.';
    const pw = validatePassword(form.password);
    if (pw) e.password = pw;
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match.';
    if (isDoctor) {
      const h = normalizeHpcsa(form.hpcsa);
      if (!h) e.hpcsa = 'HPCSA registration number is required for doctors.';
      else if (!HPCSA_RE.test(h)) e.hpcsa = 'Enter a valid HPCSA number, e.g. MP 0123456.';
      if (form.practice.trim() && !PRACTICE_RE.test(form.practice.trim())) e.practice = 'Use only letters, numbers, spaces, - and /.';
    }
    if (!form.accepted) e.accepted = 'You must accept the Terms of Service and Privacy Policy.';
    return e;
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    if (submitting) return;
    const e = validate();
    setErrors(e);
    setFormError('');
    if (Object.keys(e).length) return;
    setSubmitting(true);
    try {
      const payload = {
        role, name: form.name.trim(), email: form.email.trim(), password: form.password,
        confirm_password: form.confirm, accepted_terms: true,
        ...(isDoctor ? { hpcsa_number: form.hpcsa.trim(), practice_number: form.practice.trim() } : {}),
      };
      const u = await register(payload);
      navigate(homeFor(u), { replace: true });
    } catch (err) {
      const se = err.response?.data?.errors;
      if (se) setErrors((prev) => ({ ...prev, confirm: se.confirm_password, hpcsa: se.hpcsa_number, practice: se.practice_number, ...se }));
      else setFormError(getErrorMessage(err, 'Could not create your account. Please try again.'));
      if (se && err.response?.data?.message) setFormError(err.response.data.message);
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle={isDoctor ? 'Register as a healthcare professional' : 'Start analysing your skin health with AI'}
      footer={<>Already registered? <Link to="/login" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">Sign in</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <RoleCards value={role} onChange={(r) => { setRole(r); setErrors({}); setFormError(''); }} legend="Register as" disabled={submitting} />
        {formError && (
          <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            <FiAlertCircle className="mt-0.5 flex-shrink-0" aria-hidden="true" /><span>{formError}</span>
          </div>
        )}
        <Field id="name" label="Full name" autoComplete="name" required error={errors.name}
          value={form.name} onChange={set('name')} placeholder={isDoctor ? 'Dr Jane Smith' : 'Jane Smith'} />
        <Field id="email" label="Email address" type="email" autoComplete="email" required error={errors.email}
          value={form.email} onChange={set('email')} placeholder="you@example.com" />

        {isDoctor && (
          <div className="space-y-5 p-4 rounded-2xl bg-primary-50/60 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-800">
            <Field id="hpcsa" label="HPCSA registration number" required error={errors.hpcsa} autoComplete="off"
              hint="Format: 2–3 letters then digits, e.g. MP 0123456" value={form.hpcsa} onChange={set('hpcsa')} placeholder="MP 0123456" />
            <Field id="practice" label="Practice number (optional)" error={errors.practice} autoComplete="off"
              value={form.practice} onChange={set('practice')} placeholder="e.g. 0123456" />
            <p className="text-xs text-primary-900 dark:text-primary-200 flex items-start gap-2">
              <FiInfo className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>We do not trust the number you type. Your account will stay <strong>pending</strong> until an administrator confirms your registration on the HPCSA iRegister. You will not be able to receive patient appointments until then.</span>
            </p>
          </div>
        )}

        <Field id="password" label="Password" error={errors.password} hint="At least 8 characters, with a letter and a number.">
          <div className="relative">
            <input id="password" type={show ? 'text' : 'password'} autoComplete="new-password" required className="input-field pr-12"
              aria-invalid={errors.password ? 'true' : 'false'} value={form.password} onChange={set('password')} />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-gray-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600">
              {show ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
            </button>
          </div>
        </Field>
        <Field id="confirm" label="Confirm password" type={show ? 'text' : 'password'} autoComplete="new-password" required error={errors.confirm}
          value={form.confirm} onChange={set('confirm')} />
        <div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1 w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 flex-shrink-0"
              checked={form.accepted} onChange={(e) => setForm({ ...form, accepted: e.target.checked })}
              aria-invalid={errors.accepted ? 'true' : 'false'} aria-describedby={errors.accepted ? 'accepted-error' : undefined} />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              I agree to the Terms of Service and Privacy Policy, and understand health information is processed as personal
              information under POPIA.
            </span>
          </label>
          {errors.accepted && <p id="accepted-error" role="alert" className="text-sm text-red-600 dark:text-red-400 mt-1.5">{errors.accepted}</p>}
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full py-3.5 flex items-center justify-center space-x-2">
          {submitting ? <><FiRefreshCw className="animate-spin" aria-hidden="true" /><span>Creating account…</span></>
            : <><FiUserPlus aria-hidden="true" /><span>{isDoctor ? 'Submit for verification' : 'Create Account'}</span></>}
        </button>
      </form>
    </AuthShell>
  );
};

export default RegisterPage;
