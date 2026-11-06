import React, { useEffect, useState } from 'react';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import AuthImage from '../common/AuthImage';
import { doctorService, getErrorMessage } from '../../services/api';
import { formatDateTime } from '../../utils/format';


const AttachedReport = ({ appointmentId }) => {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    doctorService.report(appointmentId)
      .then((r) => { if (!cancelled) setReport(r.data.report); })
      .catch((e) => { if (!cancelled) setError(e.response?.status === 404 ? 'This report is no longer available (it may have been withdrawn).' : getErrorMessage(e)); });
    return () => { cancelled = true; };
  }, [appointmentId]);

  if (error) return <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>;
  if (!report) return <p role="status" className="text-sm text-gray-500 flex items-center gap-2 mt-2"><FiRefreshCw className="animate-spin" aria-hidden="true" />Opening report…</p>;

  const r = report.results || {};
  const Row = ({ k, v }) => <div className="flex justify-between gap-3 text-sm py-1.5"><dt className="text-gray-500 dark:text-gray-400">{k}</dt><dd className="font-medium text-gray-900 dark:text-white text-right">{v}</dd></div>;
  return (
    <div className="mt-3 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4" data-testid="attached-report">
      <dl className="divide-y divide-gray-100 dark:divide-gray-700">
        <Row k="Report" v={report.report_reference} />
        <Row k="Assessment date" v={formatDateTime(report.assessment_date)} />
        <Row k="Condition (AI)" v={r.condition} />
        <Row k="Confidence" v={`${r.confidence_score}%`} />
        <Row k="Severity" v={r.severity} />
        <Row k="Model" v={r.model_version} />
      </dl>
      {r.symptoms?.length > 0 && <div><p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Detected symptoms</p><ul className="list-disc ml-5 text-sm text-gray-700 dark:text-gray-300">{r.symptoms.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      {report.ai_recommendations && <div><p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">AI recommendations</p><ul className="list-disc ml-5 text-sm text-gray-700 dark:text-gray-300 space-y-1">{report.ai_recommendations.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      {report.image && <div><p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Skin image</p><AuthImage scanId={report.report_reference} alt="Patient skin image" className="w-full h-64 object-contain rounded-xl" /></div>}
    </div>
  );
};

export default AttachedReport;
