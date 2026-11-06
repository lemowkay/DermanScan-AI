import React, { useCallback, useEffect, useState } from 'react';
import { FiCheck, FiX, FiExternalLink, FiRefreshCw, FiShield } from 'react-icons/fi';
import { adminService, getErrorMessage } from '../../services/api';
import { formatDateTime } from '../../utils/format';

const TABS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']];

const DoctorVerificationPanel = () => {
  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [url, setUrl] = useState('https://www.hpcsa.co.za');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);     
  const [checked, setChecked] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminService.getDoctorAccounts(tab)
      .then((r) => { setItems(r.data.doctors); setUrl(r.data.iregister_url || url); setError(''); })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const open = (id, mode) => { setActive({ id, mode }); setChecked(false); setText(''); setError(''); };
  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (active.mode === 'approve') await adminService.approveDoctor(active.id, { checked_on_register: checked, notes: text });
      else await adminService.rejectDoctor(active.id, text);
      setActive(null); load();
    } catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 sm:p-6 mb-8" aria-labelledby="dv-title">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 id="dv-title" className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><FiShield aria-hidden="true" />Doctor verification</h2>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 dark:text-primary-400 inline-flex items-center gap-1 hover:underline">
          HPCSA iRegister <FiExternalLink aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Look up each HPCSA number on the iRegister (name, number and status must match) before approving. Approval grants access to patient appointments; rejecting an approved doctor revokes access immediately.</p>
      <div role="tablist" aria-label="Verification status" className="flex gap-2 mb-4">
        {TABS.map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={'px-4 py-2 rounded-xl text-sm font-medium ' + (tab === v ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200')}>{l}</button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
      {loading && <p role="status" className="text-sm text-gray-500 flex items-center gap-2"><FiRefreshCw className="animate-spin" aria-hidden="true" />Loading…</p>}
      {!loading && items.length === 0 && <p className="text-sm text-gray-500">No {tab} doctors.</p>}
      <ul className="space-y-3">
        {items.map((d) => (
          <li key={d.id} className="rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white">{d.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 break-all">{d.email}</p>
                <p className="text-sm mt-1"><span className="text-gray-500 dark:text-gray-400">HPCSA:</span> <span className="font-mono font-bold text-gray-900 dark:text-white">{d.hpcsa_number}</span>
                  {d.practice_number && <span className="text-gray-500 dark:text-gray-400"> · Practice {d.practice_number}</span>}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Registered {formatDateTime(d.created_at)}{d.verified_at ? ` · Decided ${formatDateTime(d.verified_at)}` : ''}</p>
                {d.verification_notes && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Note: {d.verification_notes}</p>}
              </div>
              <div className="flex gap-2">
                {d.verification_status !== 'approved' && <button type="button" onClick={() => open(d.id, 'approve')} className="btn-primary text-sm py-2 px-3 flex items-center gap-1"><FiCheck aria-hidden="true" />Approve</button>}
                {d.verification_status !== 'rejected' && <button type="button" onClick={() => open(d.id, 'reject')} className="btn-secondary text-sm py-2 px-3 flex items-center gap-1 !text-red-600"><FiX aria-hidden="true" />{d.verification_status === 'approved' ? 'Revoke' : 'Reject'}</button>}
              </div>
            </div>
            {active?.id === d.id && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
                {active.mode === 'approve' && (
                  <label className="flex items-start gap-3 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
                    <input type="checkbox" className="mt-1 w-5 h-5 rounded text-primary-600" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                    <span>I looked up <strong className="font-mono">{d.hpcsa_number}</strong> on the HPCSA iRegister and the name and active registration match.</span>
                  </label>
                )}
                <div>
                  <label htmlFor={`note-${d.id}`} className="input-label">{active.mode === 'approve' ? 'Note (optional)' : 'Reason (shown to the doctor)'}</label>
                  <input id={`note-${d.id}`} className="input-field" maxLength={255} value={text} onChange={(e) => setText(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={submit} disabled={busy || (active.mode === 'approve' ? !checked : text.trim().length < 3)} className="btn-primary text-sm py-2 px-4">
                    {busy ? 'Saving…' : active.mode === 'approve' ? 'Confirm approval' : 'Confirm'}
                  </button>
                  <button type="button" onClick={() => setActive(null)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default DoctorVerificationPanel;
