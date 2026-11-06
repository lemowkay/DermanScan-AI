import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ScanPage from './pages/ScanPage';
import ResultsPage from './pages/ResultsPage';
import TreatmentPage from './pages/TreatmentPage';
import ReportPage from './pages/ReportPage';
import ConsultationPage from './pages/ConsultationPage';
import AppointmentPage from './pages/AppointmentPage';
import HistoryPage from './pages/HistoryPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import DoctorPendingPage from './pages/DoctorPendingPage';
import DoctorProfilePage from './pages/DoctorProfilePage';
import DoctorAppointmentsPage from './pages/DoctorAppointmentsPage';

const patient = (el) => <ProtectedRoute roles={['user']}>{el}</ProtectedRoute>;

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/features" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/dashboard" element={patient(<DashboardPage />)} />
      <Route path="/scan" element={patient(<ScanPage />)} />
      <Route path="/results/:id" element={patient(<ResultsPage />)} />
      <Route path="/treatment/:id" element={patient(<TreatmentPage />)} />
      <Route path="/report/:id" element={patient(<ReportPage />)} />
      <Route path="/doctors" element={patient(<ConsultationPage />)} />
      <Route path="/appointments" element={patient(<AppointmentPage />)} />
      <Route path="/history" element={patient(<HistoryPage />)} />
      <Route path="/referrals" element={<Navigate to="/doctors" replace />} />

      <Route path="/doctor/pending" element={<ProtectedRoute roles={['doctor']} allowUnverifiedDoctor><DoctorPendingPage /></ProtectedRoute>} />
      <Route path="/doctor/profile" element={<ProtectedRoute roles={['doctor']} allowUnverifiedDoctor><DoctorProfilePage /></ProtectedRoute>} />
      <Route path="/doctor/appointments" element={<ProtectedRoute roles={['doctor']}><DoctorAppointmentsPage /></ProtectedRoute>} />
      <Route path="/doctor/inbox" element={<Navigate to="/doctor/appointments" replace />} />
      <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboardPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
