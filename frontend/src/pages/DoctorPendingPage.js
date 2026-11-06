import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { FiClock, FiXCircle, FiRefreshCw } from 'react-icons/fi';
import Navbar from '../components/layout/Navbar';
import { useAuth, homeFor } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';

const DoctorPendingPage = () => {
  const { user, refresh, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (user.verification_status === 'approved') return <Navigate to={homeFor(user)} replace />;
  const rejected = user.verification_status === 'rejected';

  const check = async () => {
    setBusy(true); setError('');
    try { await refresh(); } catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
      <Navbar />
      <main className="pt-28 px-4">
        <div className="max-w-lg mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 sm:p-8 text-center" role="status">
          <div className={'w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ' + (rejected ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30')}>
            {rejected ? <FiXCircle className="text-red-600 text-3xl" aria-hidden="true" /> : <FiClock className="text-amber-600 text-3xl" aria-hidden="true" />}
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {rejected ? 'Verification was not approved' : 'Verification pending'}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
            {rejected
              ? 'An administrator could not approve your HPCSA registration, so doctor features are disabled.'
              : 'Thank you for registering. An administrator will confirm your HPCSA registration. Until then you cannot receive or view patient appointments.'}
          </p>
          {rejected && user.verification_notes && (
            <p className="text-sm bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-xl p-3 mb-4">Reason: {user.verification_notes}</p>
          )}
          <dl className="text-sm text-left bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-5 space-y-1">
            <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Name</dt><dd className="font-medium text-gray-900 dark:text-white">{user.name}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">HPCSA number</dt><dd className="font-mono font-medium text-gray-900 dark:text-white">{user.hpcsa_number}</dd></div>
            {user.practice_number && <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Practice number</dt><dd className="font-medium text-gray-900 dark:text-white">{user.practice_number}</dd></div>}
          </dl>
          {!rejected && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Meanwhile, <Link to="/doctor/profile" className="text-primary-600 dark:text-primary-400 font-semibold underline">complete your profile</Link>. You will appear in the doctor directory, and patients can book you, as soon as you are verified.
            </p>
          )}
          {error && <p role="alert" className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={check} disabled={busy} className="btn-primary flex-1 flex items-center justify-center space-x-2">
              <FiRefreshCw className={busy ? 'animate-spin' : ''} aria-hidden="true" /><span>Check status</span>
            </button>
            <button type="button" onClick={logout} className="btn-secondary flex-1">Sign out</button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DoctorPendingPage;
