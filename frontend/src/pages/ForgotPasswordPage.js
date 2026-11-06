import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMail, FiRefreshCw, FiAlertCircle, FiInfo } from 'react-icons/fi';
import AuthShell from '../components/layout/AuthShell';
import Field from '../components/common/Field';
import { authService, getErrorMessage } from '../services/api';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await authService.forgotPassword(email.trim());
      setResult(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="Enter your account email to get a reset link"
      footer={<Link to="/login" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">Back to sign in</Link>}>
      {result ? (
        <div className="space-y-4" role="status">
          <p className="text-gray-700 dark:text-gray-300">{result.message}</p>
          {result.email_delivery === 'configured' ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">Check your inbox (and spam folder). The link is valid for 1 hour.</p>
          ) : (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
              <FiInfo className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>Email is not set up on this server, so no email was sent. The administrator can find the link in the server log.</span>
            </div>
          )}
          {result.dev_reset_link && (
            <div className="text-sm">
              <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Development mode link:</p>
              <a href={result.dev_reset_link.replace(/^https?:\/\/[^/]+/, '')} className="text-primary-600 dark:text-primary-400 underline break-all">Open reset page</a>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          {error && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              <FiAlertCircle className="mt-0.5 flex-shrink-0" aria-hidden="true" /><span>{error}</span>
            </div>
          )}
          <Field id="email" label="Email address" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" disabled={submitting || !email} className="btn-primary w-full py-3.5 flex items-center justify-center space-x-2">
            {submitting ? <><FiRefreshCw className="animate-spin" aria-hidden="true" /><span>Sending…</span></> : <><FiMail aria-hidden="true" /><span>Send reset link</span></>}
          </button>
        </form>
      )}
    </AuthShell>
  );
};

export default ForgotPasswordPage;
