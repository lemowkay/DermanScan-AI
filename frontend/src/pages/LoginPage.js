import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FiLogIn, FiEye, FiEyeOff, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import AuthShell from '../components/layout/AuthShell';
import Field from '../components/common/Field';
import RoleCards from '../components/common/RoleCards';
import { useAuth, homeFor } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';

const LoginPage = () => {
  const { login, isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [role, setRole] = useState('user');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(() => {
    const n = sessionStorage.getItem('authNotice');
    sessionStorage.removeItem('authNotice');
    return n || '';
  });

  if (!loading && isAuthenticated) return <Navigate to={homeFor(user)} replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const u = await login(form.email.trim(), form.password, role);
      const from = location.state?.from;
      navigate(from && u.role === 'user' ? from : homeFor(u), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not sign in. Please try again.'));
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your DermaScan AI account"
      footer={<>New here? <Link to="/register" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">Create an account</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error && (
          <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            <FiAlertCircle className="mt-0.5 flex-shrink-0" aria-hidden="true" /><span>{error}</span>
          </div>
        )}
        <RoleCards value={role} onChange={(r) => { setRole(r); setError(''); }} legend="Sign in as" disabled={submitting} />
        <Field id="email" label="Email address" type="email" autoComplete="email" required
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
        <Field id="password" label="Password">
          <div className="relative">
            <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" required
              className="input-field pr-12" value={form.password} placeholder="Your password"
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-gray-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600">
              {show ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
            </button>
          </div>
        </Field>
        <div className="text-right -mt-2">
          <Link to="/forgot-password" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">Forgot password?</Link>
        </div>
        <button type="submit" disabled={submitting || !form.email || !form.password} className="btn-primary w-full py-3.5 flex items-center justify-center space-x-2">
          {submitting ? <><FiRefreshCw className="animate-spin" aria-hidden="true" /><span>Signing in…</span></> : <><FiLogIn aria-hidden="true" /><span>Sign In</span></>}
        </button>
      </form>
    </AuthShell>
  );
};

export default LoginPage;
