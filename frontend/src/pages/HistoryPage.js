
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiSearch,
  FiDownload,
  FiFilter,
  FiCalendar,
  FiClock,
  FiArrowRight,
  FiCamera,
  FiTrash2
} from 'react-icons/fi';

import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { scanService } from '../services/api';
import { formatDateTime } from '../utils/format';

const HistoryPage = () => {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [data, setData] = useState({
    scans: [],
    total: 0,
    pages: 1
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(t);
  }, [search]);

  // Reset page when date filter changes
  useEffect(() => {
    setPage(1);
  }, [dateFilter]);

  // Load scan history
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');

    const params = {
      page,
      per_page: 10
    };

    if (debounced) {
      params.search = debounced;
    }

    if (dateFilter !== 'all') {
      const d = new Date();
      d.setDate(d.getDate() - Number(dateFilter));
      params.date_from = d.toISOString().slice(0, 10);
    }

    scanService.getHistory(params)
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            'We could not load your scan history. Please try again.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, debounced, dateFilter]);

  // Delete scan
  const handleDeleteScan = async (scanId) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this scan? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setDeletingId(scanId);
      setError('');

      await scanService.deleteScan(scanId);

      setData((prev) => {
        const updatedScans = prev.scans.filter(
          (scan) => scan.scan_id !== scanId
        );

        return {
          ...prev,
          scans: updatedScans,
          total: Math.max(0, prev.total - 1)
        };
      });

    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Failed to delete scan. Please try again.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const scans = data.scans.map((x) => {
    const when = formatDateTime(x.created_at).split(', ');

    return {
      id: x.scan_id,
      date: x.created_at ? x.created_at.slice(0, 10) : '',
      time: when[when.length - 1],
      disease: x.disease_name,
      confidence: x.confidence_score,
      severity: x.severity,
      status: x.status
    };
  });

  const filteredScans = scans;

  const getSeverityColor = (severity) => {
    const colors = {
      Mild: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
      Moderate: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
      Severe: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
      Benign: 'bg-medical-50 dark:bg-medical-900/20 text-medical-600 dark:text-medical-400'
    };

    return colors[severity] ||
      'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400';
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
      <Navbar />

      <div className="pt-20 lg:pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
              Scan History
            </h1>

            <p className="text-gray-500 dark:text-gray-400 mt-2">
              View and manage all your previous skin analysis scans
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
          >

            {/* Search and filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">

              <div className="relative w-full sm:w-80">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

                <input
                  type="search"
                  aria-label="Search scans"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-field pl-10 py-3 text-sm"
                  placeholder="Search by disease name or ID..."
                />
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <FiFilter className="text-gray-400" />

                <select
                  aria-label="Filter by date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="input-field py-3 text-sm w-full sm:w-auto"
                >
                  <option value="all">All Time</option>
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 90 Days</option>
                </select>
              </div>

            </div>

            {/* Scan history table */}
            <div className="overflow-x-auto">
              <table className="w-full">

                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">

                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Scan ID
                    </th>

                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <div className="flex items-center space-x-1">
                        <FiCalendar className="text-xs" />
                        <span>Date</span>
                      </div>
                    </th>

                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <div className="flex items-center space-x-1">
                        <FiClock className="text-xs" />
                        <span>Time</span>
                      </div>
                    </th>

                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Disease
                    </th>

                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Confidence
                    </th>

                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Severity
                    </th>

                    <th className="text-right py-3 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>

                  </tr>
                </thead>

                <tbody>
                  {filteredScans.map((scan, i) => (
                    <motion.tr
                      key={scan.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >

                      <td className="py-4 px-3">
                        <span className="text-sm font-mono font-medium text-primary-600 dark:text-primary-400">
                          {scan.id}
                        </span>
                      </td>

                      <td className="py-4 px-3 text-sm text-gray-600 dark:text-gray-400">
                        {scan.date}
                      </td>

                      <td className="py-4 px-3 text-sm text-gray-600 dark:text-gray-400">
                        {scan.time}
                      </td>

                      <td className="py-4 px-3">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {scan.disease}
                        </span>
                      </td>

                      <td className="py-4 px-3">
                        <div className="flex items-center space-x-2 max-w-[120px]">

                          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full gradient-primary rounded-full"
                              style={{ width: scan.confidence + '%' }}
                            />
                          </div>

                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-10 text-right">
                            {scan.confidence}%
                          </span>

                        </div>
                      </td>

                      <td className="py-4 px-3">
                        <span
                          className={
                            'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ' +
                            getSeverityColor(scan.severity)
                          }
                        >
                          {scan.severity}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-3 text-right">
                        <div className="flex items-center justify-end space-x-2">

                          {/* View */}
                          <Link
                            to={'/results/' + scan.id}
                            className="inline-flex items-center space-x-1 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                          >
                            <span>View</span>
                            <FiArrowRight />
                          </Link>

                          {/* Download */}
                          <Link
                            to={'/report/' + scan.id}
                            aria-label={'Open report ' + scan.id}
                            title="Download report"
                            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                          >
                            <FiDownload className="text-sm" />
                          </Link>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteScan(scan.id)}
                            disabled={deletingId === scan.id}
                            aria-label={'Delete scan ' + scan.id}
                            title="Delete scan"
                            className="p-2 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deletingId === scan.id ? (
                              <span className="text-xs">...</span>
                            ) : (
                              <FiTrash2 className="text-sm" />
                            )}
                          </button>

                        </div>
                      </td>

                    </motion.tr>
                  ))}
                </tbody>

              </table>
            </div>

            {/* Error */}
            {error && (
              <p
                role="alert"
                className="text-center py-8 text-red-600 dark:text-red-400"
              >
                {error}
              </p>
            )}

            {/* Loading */}
            {loading && (
              <p role="status" className="text-center py-8 text-gray-500">
                Loading…
              </p>
            )}

            {/* Empty state */}
            {!loading && !error && filteredScans.length === 0 && (
              <div className="text-center py-16">

                <div className="w-20 h-20 mx-auto rounded-2xl bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center mb-4">
                  <FiCamera className="text-4xl text-gray-300 dark:text-gray-600" />
                </div>

                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  No Scans Found
                </h3>

                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  No scan records match your search criteria.
                </p>

                <Link
                  to="/scan"
                  className="btn-primary inline-flex items-center space-x-2"
                >
                  <FiCamera />
                  <span>Start New Scan</span>
                </Link>

              </div>
            )}

            {/* Pagination */}
            {!loading && filteredScans.length > 0 && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {filteredScans.length} of {data.total} scans
                </p>

                <div className="flex items-center space-x-2">

                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span
                    className="px-3 py-1 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-sm font-medium"
                    aria-current="page"
                  >
                    {page} / {Math.max(data.pages, 1)}
                  </span>

                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                    disabled={page >= data.pages}
                    className="px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all disabled:opacity-40"
                  >
                    Next
                  </button>

                </div>
              </div>
            )}

          </motion.div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default HistoryPage;
