import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiDownload, FiPrinter, FiMail, FiCamera, FiUser, FiCalendar, FiShield, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { useAuth } from '../context/AuthContext';
import AuthImage from '../components/common/AuthImage';
import BookAppointmentButton from '../components/booking/BookAppointmentButton';
import { scanService, consultationService, getErrorMessage } from '../services/api';
import { formatDateTime } from '../utils/format';

const ReportPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const reportRef = useRef(null);

  const [scan, setScan] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [reviewNote, setReviewNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    scanService.getResults(id)
      .then((res) => { if (!cancelled) setScan(res.data.scan); })
      .catch((err) => { if (!cancelled) setError(err.response?.status === 404 ? 'We could not find this report.' : getErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    // Show a doctor's note only if a doctor actually wrote one on an appointment that used this report.
    consultationService.getConsultations({ scan_id: id }).then((res) => {
      const withNote = res.data.consultations.find((c) => ['confirmed', 'completed'].includes(c.status) && c.doctor_note);
      if (!cancelled && withNote) setReviewNote(`${withNote.doctor_name}: ${withNote.doctor_note}`);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  const report = scan && {
    id: scan.scan_id,
    date: formatDateTime(scan.created_at),
    disease: scan.disease_name,
    confidence: `${scan.confidence_score}%`,
    severity: scan.severity,
    symptoms: scan.symptoms,
    recommendations: scan.recommendations,
    isDemo: scan.is_demo,
    hasImage: scan.has_image,
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current || pdfBusy) return;
    setPdfBusy(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const w = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const h = (canvas.height * w) / canvas.width;
      const img = canvas.toDataURL('image/jpeg', 0.92);
      let y = 0;
      pdf.addImage(img, 'JPEG', 0, y, w, h);
      while (h - (-y) > pageH) { y -= pageH; pdf.addPage(); pdf.addImage(img, 'JPEG', 0, y, w, h); }
      pdf.save(`DermaScan-Report-${report.id}.pdf`);
    } catch (e) {
      alert('Could not create the PDF. Please use Print and choose "Save as PDF".');
    } finally { setPdfBusy(false); }
  };


  const handleEmail = () => {
    window.location.href = 'mailto:?subject=' + encodeURIComponent('Consultation Report - ' + report.id);
  };

  if (loading || error) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
        <Navbar />
        <div className="pt-28 max-w-xl mx-auto px-4 text-center">
          {loading ? <p role="status" className="text-gray-500 flex items-center justify-center gap-2"><FiRefreshCw className="animate-spin" aria-hidden="true" />Loading report…</p> : (
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div>
              <Link to={'/results/' + id} className="inline-flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-2">
                <FiArrowLeft />
                <span>Back to Results</span>
              </Link>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Consultation Report</h1>
              <p className="text-gray-500 dark:text-gray-400">Report ID: {report.id}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 print-hidden">
              <BookAppointmentButton scanId={report.id} />
              <button type="button" onClick={handlePrint} className="btn-secondary text-sm py-2.5 px-4 flex items-center space-x-2">
                <FiPrinter />
                <span>Print</span>
              </button>
              <button type="button" disabled={pdfBusy} onClick={handleDownloadPDF} className="btn-primary text-sm py-2.5 px-4 flex items-center space-x-2">
                {pdfBusy ? <FiRefreshCw className="animate-spin" /> : <FiDownload />}
                <span>{pdfBusy ? 'Creating…' : 'PDF'}</span>
              </button>
              <button type="button" onClick={handleEmail} className="btn-secondary text-sm py-2.5 px-4 flex items-center space-x-2">
                <FiMail />
                <span>Email</span>
              </button>
            </div>
          </div>

          <div ref={reportRef} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-primary-600 via-sky-500 to-medical-500 p-5 sm:p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <FiCamera className="text-xl" />
                    <span className="text-lg font-bold">DermaScan AI</span>
                  </div>
                  <h2 className="text-2xl font-bold">Consultation Report</h2>
                  <p className="text-white/80 text-sm mt-1">AI-Powered Skin Disease Analysis</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">Report #{report.id}</p>
                  <p className="text-xs text-white/70">{report.date}</p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-8 space-y-8">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Patient Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                      <FiUser className="text-primary-500" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Patient Name</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name || 'Patient Name'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                      <FiCalendar className="text-primary-500" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Report Date</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{report.date}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Image Analysis</h3>
                  <div className="rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-700/50">
                    <AuthImage scanId={report.id} hasImage={report.hasImage} alt="Uploaded skin image" className="w-full h-40 object-contain" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Diagnosis Results</h3>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-primary-50 to-sky-50 dark:from-primary-900/20 dark:to-sky-900/20">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Predicted Condition</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{report.disease}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-medical-50 to-primary-50 dark:from-medical-900/20 dark:to-primary-900/20">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Confidence Score</p>
                    <p className="text-lg font-bold text-medical-600 dark:text-medical-400">{report.confidence}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-sky-50 to-primary-50 dark:from-sky-900/20 dark:to-primary-900/20">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Severity Level</p>
                    <p className="text-lg font-bold text-sky-600 dark:text-sky-400">{report.severity}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Detected Symptoms</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {report.symptoms.map((symptom, i) => (
                    <div key={i} className="flex items-center space-x-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                      <div className="w-2 h-2 rounded-full bg-primary-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{symptom}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">AI Recommendations</h3>
                <div className="space-y-3">
                  {report.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start space-x-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                      <span className={'w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-sky-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0'}>
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Doctor's Notes</h3>
                <textarea rows={4}
                  className="input-field resize-none"
                  placeholder="No doctor has added a note for this report yet."
                  value={reviewNote}
                  readOnly
                />
              </div>

              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 flex items-start space-x-3">
                <FiShield className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-400 mb-1">AI Disclaimer</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    This report was generated by an AI system and is intended for informational purposes only. It does not constitute a medical diagnosis.
                    Please consult a qualified healthcare professional for proper evaluation and treatment.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700 px-8 py-4">
              <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                <span>Generated by DermaScan AI v3.1</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ReportPage;
