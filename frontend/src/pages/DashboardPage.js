import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCamera, FiFileText, FiUserCheck, FiArrowRight, FiClock, FiActivity, FiTrendingUp, FiSearch, FiDownload } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import BookAppointmentButton from '../components/booking/BookAppointmentButton';
import { scanService, consultationService } from '../services/api';
import { formatDateTime } from '../utils/format';

const DashboardPage = () => {
  const { user } = useAuth();
  const [scans, setScans] = useState([]);
  const [totalScans, setTotalScans] = useState(0);
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      scanService.getHistory({ per_page: 5 }),
      consultationService.getConsultations().catch(() => ({ data: { consultations: [] } })),
    ]).then(([h, c]) => {
      if (cancelled) return;
      setScans(h.data.scans.map((x) => ({ id: x.scan_id, date: formatDateTime(x.created_at), iso: x.created_at, disease: x.disease_name, confidence: x.confidence_score, severity: x.severity, status: x.status })));
      setTotalScans(h.data.total);
      setConsultations(c.data.consultations);
    }).catch(() => { if (!cancelled) setLoadError('We could not load your dashboard. Please refresh the page.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const pendingAppointments = consultations.filter((c) => c.status === 'pending').length;
  const reportsShared = consultations.filter((c) => c.has_report).length;
  const stats = [
    { icon: FiCamera, label: 'Total Scans', value: String(totalScans), color: 'from-primary-500 to-sky-500', bg: 'bg-primary-50 dark:bg-primary-900/20' },
    { icon: FiUserCheck, label: 'Appointments', value: String(consultations.length), color: 'from-sky-500 to-primary-600', bg: 'bg-sky-50 dark:bg-sky-900/20' },
    { icon: FiFileText, label: 'Reports Shared With Doctors', value: String(reportsShared), color: 'from-medical-500 to-primary-500', bg: 'bg-medical-50 dark:bg-medical-900/20' },
    { icon: FiClock, label: 'Awaiting Doctor Confirmation', value: String(pendingAppointments), color: 'from-primary-600 to-sky-500', bg: 'bg-primary-50 dark:bg-primary-900/20' },
  ];

  const activity = [
    ...scans.map((x) => ({ action: 'Scan completed', detail: x.disease, when: x.iso, color: 'primary' })),
    ...consultations.map((x) => ({ action: 'Appointment ' + x.status, detail: `${x.doctor_name}${x.has_report ? ' · report attached' : ''}`, when: x.created_at, color: 'sky' })),
  ].sort((p, q) => new Date(q.when) - new Date(p.when)).slice(0, 5);

  const filteredScans = scans.filter(s =>
    s.disease.toLowerCase().includes(search.toLowerCase()) ||
    s.id.toLowerCase().includes(search.toLowerCase())
  );

  const getSeverityColor = (severity) => {
    const colors = {
      'Mild': 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
      'Moderate': 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
      'Severe': 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
      'Benign': 'bg-medical-50 dark:bg-medical-900/20 text-medical-600 dark:text-medical-400',
    };
    return colors[severity] || 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400';
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
      <Navbar />
      <div className="pt-20 lg:pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
              Welcome back, {user?.name?.split(' ')[0] || 'User'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Here's your skin health overview</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="stat-card group cursor-default"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon size={24} className="text-primary-600 dark:text-primary-400"/>
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stat.value}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                    <FiClock className="text-primary-500" />
                    <span>Recent Analysis History</span>
                  </h2>
                  <div className="relative w-full sm:w-64">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="search" aria-label="Search scans" value={search} onChange={(e) => setSearch(e.target.value)}
                      className="input-field pl-10 py-2 text-sm" placeholder="Search scans..." />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700">
                        <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Scan ID</th>
                        <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                        <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Disease</th>
                        <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Confidence</th>
                        <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Severity</th>
                        <th className="text-right py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredScans.map((scan, i) => (
                        <motion.tr key={scan.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                          className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        >
                          <td className="py-4 px-2">
                            <span className="text-sm font-mono font-medium text-primary-600 dark:text-primary-400">{scan.id}</span>
                          </td>
                          <td className="py-4 px-2 text-sm text-gray-600 dark:text-gray-400">{scan.date}</td>
                          <td className="py-4 px-2 text-sm font-medium text-gray-900 dark:text-white">{scan.disease}</td>
                          <td className="py-4 px-2">
                            <div className="flex items-center space-x-2">
                              <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full gradient-primary rounded-full" style={{ width: `${scan.confidence}%` }} />
                              </div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{scan.confidence}%</span>
                            </div>
                          </td>
                          <td className="py-4 px-2">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getSeverityColor(scan.severity)}`}>
                              {scan.severity}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-right">
                            <Link to={`/results/${scan.id}`} className="inline-flex items-center space-x-1 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
                              <span>View</span>
                              <FiArrowRight />
                            </Link>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {loadError && <p role="alert" className="text-center py-8 text-red-600 dark:text-red-400">{loadError}</p>}
                {loading && <p role="status" className="text-center py-8 text-gray-500">Loading your scans…</p>}
                {!loading && !loadError && filteredScans.length === 0 && (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <FiSearch className="text-4xl mx-auto mb-3 opacity-50" />
                    <p>{scans.length === 0 ? 'No scans yet.' : 'No scans found matching your search'}</p>
                    {scans.length === 0 && <Link to="/scan" className="btn-primary inline-block mt-4">Start your first scan</Link>}
                  </div>
                )}
              </motion.div>
            </div>

            <div className="space-y-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
              >
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                  <FiActivity className="text-medical-500" />
                  <span>Quick Actions</span>
                </h2>
                <div className="space-y-3">
                  <Link to="/scan" className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary-50 to-sky-50 dark:from-primary-900/20 dark:to-sky-900/20 group hover:shadow-md transition-all">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                        <FiCamera className="text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">New Scan</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Upload a skin image</div>
                      </div>
                    </div>
                    <FiArrowRight className="text-primary-500 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link to="/appointments" className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-medical-50 to-sky-50 dark:from-medical-900/20 dark:to-sky-900/20 group hover:shadow-md transition-all">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-medical-500 to-sky-500 flex items-center justify-center">
                        <FiFileText className="text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">My Appointments</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Book, track or change appointments</div>
                      </div>
                    </div>
                    <FiArrowRight className="text-primary-500 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  
                  <Link to="/history" className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-medical-50 to-primary-50 dark:from-medical-900/20 dark:to-primary-900/20 group hover:shadow-md transition-all">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-medical-500 to-primary-500 flex items-center justify-center">
                        <FiDownload className="text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">View Reports</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Download previous reports</div>
                      </div>
                    </div>
                    <FiArrowRight className="text-primary-500 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
              >
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
                <div className="space-y-4">
                  {activity.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No activity yet. Start with a new scan.</p>}
                  {activity.map((item, i) => (
                    <div key={i} className="flex items-start space-x-3">
                      <div className={'w-2 h-2 rounded-full mt-2 ' + ({ primary: 'bg-primary-500', medical: 'bg-medical-500', sky: 'bg-sky-500' }[item.color])} aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{item.action}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.detail}</p>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">{formatDateTime(item.when)}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default DashboardPage;
