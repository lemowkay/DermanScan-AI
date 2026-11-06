import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiUsers, FiCamera, FiFileText, FiUserCheck, FiTrendingUp, FiActivity, FiBarChart2, FiTrash2, FiMail, FiMoreVertical } from 'react-icons/fi';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { adminService, getErrorMessage } from '../services/api';
import { formatDateTime } from '../utils/format';
import DoctorVerificationPanel from '../components/admin/DoctorVerificationPanel';

const AdminDashboardPage = () => {
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [trends, setTrends] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminService.getAnalytics(), adminService.getUsers(), adminService.getDiseaseTrends(), adminService.getConsultations()])
      .then(([a, u, t, c]) => { setAnalytics(a.data); setUsers(u.data.users); setTrends(t.data.trends); setConsultations(c.data.consultations); })
      .catch((e) => setError(getErrorMessage(e, 'Could not load admin data.')))
      .finally(() => setLoading(false));
  }, []);

  const removeUser = async (u) => {
    if (!window.confirm(`Permanently delete ${u.email} and all of their scans and appointments? This cannot be undone.`)) return;
    try { await adminService.deleteUser(u.id); setUsers((prev) => prev.filter((x) => x.id !== u.id)); }
    catch (e) { setError(getErrorMessage(e)); }
  };

  const stats = [
    { icon: FiUsers, label: 'Total Users', value: analytics?.total_users ?? '–', color: 'from-primary-500 to-sky-500', bg: 'bg-primary-50 dark:bg-primary-900/20' },
    { icon: FiCamera, label: 'Total Scans', value: analytics?.total_scans ?? '–', color: 'from-medical-500 to-primary-500', bg: 'bg-medical-50 dark:bg-medical-900/20' },
    { icon: FiFileText, label: 'Reports Shared With Doctors', value: analytics?.total_reports_shared ?? '–', color: 'from-sky-500 to-primary-600', bg: 'bg-sky-50 dark:bg-sky-900/20' },
    { icon: FiUserCheck, label: 'Consultations', value: analytics?.total_consultations ?? '–', color: 'from-primary-600 to-sky-500', bg: 'bg-primary-50 dark:bg-primary-900/20' },
  ];
  const totalTrend = trends.reduce((n, t) => n + t.count, 0) || 1;
  const diseaseTrends = trends.map((t) => ({ disease: t.disease || 'Unknown', count: t.count, percentage: Math.round((t.count / totalTrend) * 1000) / 10 }));

  const getTrendColor = (trend) => {
    return trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-medical-500' : 'text-gray-400';
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
      <Navbar />
      <div className="pt-20 lg:pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Monitor platform analytics and manage users</p>
              </div>
              <span className="px-4 py-2 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-sm font-medium border border-primary-100 dark:border-primary-800">
                Admin Access
              </span>
            </div>
          </motion.div>

          {error && <p role="alert" className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">{error}</p>}
          {loading && <p role="status" className="mb-4 text-gray-500">Loading…</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="stat-card group cursor-default"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={'w-12 h-12 rounded-xl ' + stat.bg + ' flex items-center justify-center group-hover:scale-110 transition-transform'}>
                    <stat.icon size={24} className="text-primary-600 dark:text-primary-400" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stat.value}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          <DoctorVerificationPanel />

          <div className="grid lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-2">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                    <FiUsers className="text-primary-500" />
                    <span>Manage Users</span>
                  </h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{users.length} users</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700">
                        <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Name</th>
                        <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Email</th>
                        <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Scans</th>
                        <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        <th className="text-right py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user, i) => (
                        <tr key={user.id}
                          className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        >
                          <td className="py-4 px-2">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold">
                                {user.name.charAt(0)}
                              </div>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</span>
                            </div>
                          </td>
                          <td className="py-4 px-2 text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                          <td className="py-4 px-2 text-sm font-medium text-gray-900 dark:text-white">{user.scan_count}</td>
                          <td className="py-4 px-2">
                            <span className={'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ' + (user.is_active ? 'bg-medical-50 dark:bg-medical-900/20 text-medical-600 dark:text-medical-400' : 'bg-gray-50 dark:bg-gray-700/50 text-gray-500')}>
                              {user.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <button type="button" onClick={() => removeUser(user)} disabled={user.role === 'admin'} aria-label={'Delete ' + user.email} className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                                <FiTrash2 className="text-sm" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>

            <div className="space-y-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
              >
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                  <FiBarChart2 className="text-primary-500" />
                  <span>Disease Trends</span>
                </h2>
                <div className="space-y-4">
                  {diseaseTrends.length === 0 && <p className="text-sm text-gray-500">No scans yet.</p>}
                  {diseaseTrends.slice(0, 5).map((item, i) => (
                    <div key={item.disease}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.disease}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400">{item.count}</span>
                          <span className="text-xs font-medium text-gray-500">{item.percentage}%</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full gradient-primary rounded-full" style={{ width: item.percentage + '%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
              >
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                  <FiActivity className="text-medical-500" />
                  <span>Recent Consultations</span>
                </h2>
                <div className="space-y-3">
                  {consultations.length === 0 && <p className="text-sm text-gray-500">No consultation requests yet.</p>}
                  {consultations.slice(0, 5).map((c, i) => {
                    const item = { patient: c.patient_name || 'Patient', doctor: c.doctor_name || 'Doctor', status: c.status.charAt(0).toUpperCase() + c.status.slice(1), time: formatDateTime(c.created_at) };
                    return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{item.patient}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.doctor}</p>
                      </div>
                      <div className="text-right">
                        <span className={'inline-flex px-2 py-0.5 rounded-full text-xs font-medium ' + (item.status === 'Completed' ? 'bg-medical-50 dark:bg-medical-900/20 text-medical-600' : item.status === 'Confirmed' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600' : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600')}>
                          {item.status}
                        </span>
                        <p className="text-xs text-gray-400 mt-1">{item.time}</p>
                      </div>
                    </div>
                    );
                  })}
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

export default AdminDashboardPage;
