import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiSave, FiRefreshCw, FiCheckCircle, FiClock, FiEye, FiEyeOff } from 'react-icons/fi';
import Navbar from '../components/layout/Navbar';
import Field from '../components/common/Field';
import { doctorService, getErrorMessage } from '../services/api';

const EMPTY = { specialty: '', hospital: '', experience: '', phone: '', bio: '', available: true };

const DoctorProfilePage = () => {
  const [form, setForm] = useState(EMPTY);
  const [meta, setMeta] = useState({ listed: false, status: 'pending', verified: false });
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    doctorService.getProfile().then((r) => {
      const d = r.data.doctor;
      setForm({ specialty: d.specialty === 'Medical Practitioner' ? '' : d.specialty || '', hospital: d.hospital || '', experience: d.experience || '',
        phone: d.phone || '', bio: d.bio || '', available: d.available });
      setMeta({ listed: r.data.listed, status: r.data.verification_status, verified: d.verified });
    }).catch((e) => setMsg({ ok: false, text: getErrorMessage(e) })).finally(() => setLoading(false));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(null); setErrors({});
    try {
      const r = await doctorService.saveProfile({ ...form, specialty: form.specialty.trim() || 'Medical Practitioner' });
      setMeta((m) => ({ ...m, listed: r.data.listed }));
      setMsg({ ok: true, text: 'Profile saved.' });
    } catch (err) {
      setErrors(err.response?.data?.errors || {});
      setMsg({ ok: false, text: getErrorMessage(err) });
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
      <Navbar />
      <main className="pt-24 px-4 pb-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">My profile</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-5">This is what patients see in the doctor directory.</p>

          <div role="status" className={'flex items-start gap-2 p-3 rounded-xl text-sm mb-5 border ' + (meta.listed
            ? 'bg-medical-50 dark:bg-medical-900/20 border-medical-200 dark:border-medical-800 text-medical-800 dark:text-medical-300'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300')}>
            {meta.listed ? <FiEye className="mt-0.5 flex-shrink-0" aria-hidden="true" /> : <FiEyeOff className="mt-0.5 flex-shrink-0" aria-hidden="true" />}
            <span>
              {meta.listed ? 'You are visible to patients and can receive appointment requests.'
                : meta.status !== 'approved' ? 'You will appear in the directory once an administrator verifies your HPCSA registration. You can complete your profile now.'
                : 'You are hidden from patients because “Accepting appointments” is switched off.'}
            </span>
          </div>

          {loading ? <p role="status" className="text-gray-500 flex items-center gap-2"><FiRefreshCw className="animate-spin" aria-hidden="true" />Loading…</p> : (
            <form onSubmit={save} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-5 sm:p-6 space-y-5" noValidate>
              <Field id="specialty" label="Specialty" value={form.specialty} onChange={set('specialty')} error={errors.specialty} placeholder="e.g. Dermatologist" />
              <Field id="hospital" label="Practice / hospital" value={form.hospital} onChange={set('hospital')} error={errors.hospital} />
              <div className="grid sm:grid-cols-2 gap-5">
                <Field id="experience" label="Experience" value={form.experience} onChange={set('experience')} error={errors.experience} placeholder="e.g. 12 years" />
                <Field id="phone" label="Practice phone (shown to patients)" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} placeholder="+27 51 123 4567" />
              </div>
              <Field id="bio" label="About you" error={errors.bio} hint={`${form.bio.length}/600 characters`}>
                <textarea id="bio" rows={4} maxLength={600} className="input-field resize-none" value={form.bio} onChange={set('bio')} />
              </Field>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-1 w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} />
                <span className="text-sm text-gray-700 dark:text-gray-200"><strong>Accepting appointments.</strong> Untick to hide yourself from patients without losing your account.</span>
              </label>
              {msg && <p role={msg.ok ? 'status' : 'alert'} className={'text-sm flex items-center gap-1 ' + (msg.ok ? 'text-medical-700 dark:text-medical-400' : 'text-red-600 dark:text-red-400')}>{msg.ok && <FiCheckCircle aria-hidden="true" />}{msg.text}</p>}
              <div className="flex flex-col sm:flex-row gap-3">
                <button type="submit" disabled={saving} className="btn-primary flex items-center justify-center space-x-2">
                  {saving ? <><FiRefreshCw className="animate-spin" aria-hidden="true" /><span>Saving…</span></> : <><FiSave aria-hidden="true" /><span>Save profile</span></>}
                </button>
                {meta.status === 'approved' && <Link to="/doctor/appointments" className="btn-secondary text-center flex items-center justify-center space-x-2"><FiClock aria-hidden="true" /><span>My appointments</span></Link>}
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};

export default DoctorProfilePage;
