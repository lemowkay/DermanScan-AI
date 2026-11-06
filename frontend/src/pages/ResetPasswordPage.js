import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiLock, FiRefreshCw, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import AuthShell from '../components/layout/AuthShell';
import Field from '../components/common/Field';
import { authService, getErrorMessage } from '../services/api';
import { validatePassword } from './RegisterPage';

const ResetPasswordPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    const problem = validatePassword(form.password) || (form.password !== form.confirm ? 'Passwords do not match.' : '');
    if (problem) { setError(problem); return; }
    setError(''); setSubmitting(true);
    try { await authService.resetPassword(token, form.password); setDone(true); }
    catch (err) { setError(getErrorMessage(err)); }
    finally { setSubmitting(false); }
  };

  return (
    <AuthShell title="Choose a new password">
      {!token ? (
        <p role="alert" className="text-red-600 dark:text-red-400">This reset link is incomplete. <Link className="underline" to="/forgot-password">Request a new one</Link>.</p>
      ) : done ? (
        <div className="text-center space-y-4" role="status">
          <FiCheckCircle className="text-medical-500 text-4xl mx-auto" aria-hidden="true" />
          <p className="text-gray-700 dark:text-gray-300">Your password has been updated.</p>
          <Link to="/login" className="btn-primary inline-block">Sign in</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          {error && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              <FiAlertCircle className="mt-0.5 flex-shrink-0" aria-hidden="true" /><span>{error}</span>
            </div>
          )}
          <Field id="password" label="New password" type="password" autoComplete="new-password" required hint="At least 8 characters, with a letter and a number."
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Field id="confirm" label="Confirm new password" type="password" autoComplete="new-password" required
            value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          <button type="submit" disabled={submitting} className="btn-primary w-full py-3.5 flex items-center justify-center space-x-2">
            {submitting ? <><FiRefreshCw className="animate-spin" aria-hidden="true" /><span>Saving…</span></> : <><FiLock aria-hidden="true" /><span>Update password</span></>}
          </button>
        </form>
      )}
    </AuthShell>
  );
};

export default ResetPasswordPage;
