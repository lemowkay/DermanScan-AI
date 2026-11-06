import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { FiRefreshCw } from 'react-icons/fi';
import { useAuth, homeFor } from '../context/AuthContext';

/** Redirects anonymous visitors to /login and wrong-role users to their home. */
const ProtectedRoute = ({ children, roles, allowUnverifiedDoctor = false }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50 dark:bg-gray-900" role="status" aria-live="polite">
        <FiRefreshCw className="animate-spin text-primary-500 text-3xl" aria-hidden="true" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  // Doctors only reach doctor features once an admin has verified them.
  if (user.role === 'doctor' && user.verification_status !== 'approved' && !allowUnverifiedDoctor) return <Navigate to="/doctor/pending" replace />;
  return children;
};

export default ProtectedRoute;
