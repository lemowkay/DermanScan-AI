import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCamera, FiDownload, FiPrinter, FiMail, FiAlertTriangle, FiShield, FiClock, FiTrendingUp, FiArrowLeft, FiFileText, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import AuthImage from '../components/common/AuthImage';
import AppointmentStatus from '../components/common/AppointmentStatus';
import BookAppointmentButton from '../components/booking/BookAppointmentButton';
import { scanService, consultationService, getErrorMessage } from '../services/api';
import { formatDateTime } from '../utils/format';

const ResultsPage = () => {
  const { id } = useParams();
  const [scan, setScan] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    scanService.getResults(id)
      .then((res) => { if (!cancelled) setScan(res.data.scan); })
      .catch((err) => { if (!cancelled) setError(err.response?.status === 404 ? 'We could not find this scan. It may not exist or may belong to another account.' : getErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    consultationService.getConsultations({ scan_id: id }).then((res) => { if (!cancelled) setAppointments(res.data.consultations); }).catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  const addAppointment = (c) => setAppointments((prev) => [c, ...prev.filter((x) => x.id !== c.id)]);

  const result = scan && {
    id: scan.scan_id,
    date: formatDateTime(scan.created_at),
    disease: scan.disease_name,
    description: scan.description,
    confidence: scan.confidence_score,
    severity: scan.severity,
    symptoms: scan.symptoms,
    model: scan.model_version,
    isDemo: scan.is_demo,
    hasImage: scan.has_image,
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'Mild': 'from-yellow-400 to-amber-500',
      'Moderate': 'from-orange-400 to-red-500',
      'Severe': 'from-red-500 to-rose-600',
      'Benign': 'from-medical-400 to-primary-500',
    };
    return colors[severity] || 'from-gray-400 to-gray-500';
  };

  const getSeverityBg = (severity) => {
    const colors = {
      'Mild': 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
      'Moderate': 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
      'Severe': 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
      'Benign': 'bg-medical-50 dark:bg-medical-900/20 text-medical-700 dark:text-medical-400 border-medical-200 dark:border-medical-800',
    };
    return colors[severity] || 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400';
  };

  if (loading || error) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
        <Navbar />
        <div className="pt-28 max-w-xl mx-auto px-4 text-center">
          {loading ? (
            <p role="status" className="text-gray-500 flex items-center justify-center gap-2"><FiRefreshCw className="animate-spin" aria-hidden="true" />Loading your results…</p>
          ) : (
            <div role="alert" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8">
              <FiAlertCircle className="text-red-500 text-4xl mx-auto mb-3" aria-hidden="true" />
              <p className="text-gray-700 dark:text-gray-300 mb-5">{error}</p>
              <Link to="/dashboard" className="btn-primary inline-block">Back to Dashboard</Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
      <Navbar />
      <div className="pt-20 lg:pt-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <Link to="/dashboard" className="inline-flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-2">
                <FiArrowLeft />
                <span>Back to Dashboard</span>
              </Link>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Analysis Results</h1>
              <p className="text-gray-500 dark:text-gray-400">Scan ID: {result.id}</p>
            </motion.div>
            <div className="hidden sm:flex items-center space-x-2 print-hidden">
              <button type="button" onClick={() => window.print()} className="btn-secondary text-sm py-2.5 px-4 flex items-center space-x-2">
                <FiPrinter />
                <span>Print</span>
              </button>
              <Link to={'/report/' + result.id} className="btn-secondary text-sm py-2.5 px-4 flex items-center space-x-2">
                <FiDownload />
                <span>PDF</span>
              </Link>
              <Link to={'/report/' + result.id} className="btn-secondary text-sm py-2.5 px-4 flex items-center space-x-2">
                <FiMail />
                <span>Email</span>
              </Link>
            </div>
          </div>

          <div className="lg:hidden mb-6 print-hidden">
            <BookAppointmentButton scanId={result.id} onBooked={addAppointment} block />
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
              >
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                  <FiCamera className="text-primary-500" />
                  <span>Uploaded Image</span>
                </h2>
                <div className="rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-700/50">
                  <AuthImage scanId={result.id} hasImage={result.hasImage} alt="Your uploaded skin image" className="w-full h-64 sm:h-80 object-contain" />
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
              >
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                  <FiAlertTriangle className="text-medical-500" />
                  <span>Diagnosis Details</span>
                </h2>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Detected Condition</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{result.disease}</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Description</p>
                    <p className="text-gray-900 dark:text-white leading-relaxed">{result.description}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
              >
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Detected Symptoms</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {result.symptoms.map((symptom, i) => (
                    <div key={i} className="flex items-center space-x-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                      <div className="w-2 h-2 rounded-full bg-primary-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{symptom}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <div className="space-y-6">
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
              >
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">AI Analysis Summary</h2>
                <div className="space-y-4">
                  <div className="text-center p-4">
                    <div className="relative w-32 h-32 mx-auto mb-4">
                      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-100 dark:text-gray-700" />
                        <circle cx="18" cy="18" r="16" fill="none" strokeWidth="2"
                          stroke="url(#gradient)" strokeDasharray={100} strokeDashoffset={100 - result.confidence}
                          className="transition-all duration-1000 ease-out"
                        />
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#0ea5e9" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-extrabold gradient-text">{result.confidence}%</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Confidence Score</p>
                  </div>

                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Severity Level</span>
                      <span className={'inline-flex px-3 py-1 rounded-full text-xs font-bold border ' + getSeverityBg(result.severity)}>
                        {result.severity}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: result.severity === 'Mild' ? '25%' : result.severity === 'Moderate' ? '55%' : '85%' }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className={'h-full rounded-full bg-gradient-to-r ' + getSeverityColor(result.severity)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                    <FiClock className="text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Analysis Date</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{result.date}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                    <FiTrendingUp className="text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Model Version</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white break-all">{result.model}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                <div className="hidden lg:block mb-3 print-hidden"><BookAppointmentButton scanId={result.id} onBooked={addAppointment} block /></div>
            
                <Link to={'/report/' + result.id}
                  className="block w-full btn-secondary text-center py-4 text-base"
                >
                  <span className="flex items-center justify-center space-x-2">
                    <FiFileText />
                    <span>Consultation Report</span>
                  </span>
                </Link>
              </motion.div>

              {appointments.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-5 print-hidden">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Appointments with this report</h2>
                  <ul className="space-y-3">
                    {appointments.map((a) => (
                      <li key={a.id} className="text-sm">
                        <div className="flex items-center justify-between gap-2"><span className="font-medium text-gray-900 dark:text-white truncate">{a.doctor_name}</span><AppointmentStatus status={a.status} /></div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(a.appointment_date)}{a.report_withdrawn ? ' · report withdrawn' : ''}</p>
                      </li>
                    ))}
                  </ul>
                  <Link to="/doctors" className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:underline mt-3 inline-block">Manage appointments</Link>
                </div>
              )}

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 flex items-start space-x-3"
              >
                <FiShield className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  <strong>AI Disclaimer:</strong> This analysis is for informational purposes only and should not replace professional medical advice. Please consult a certified dermatologist for proper diagnosis and treatment.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ResultsPage;
