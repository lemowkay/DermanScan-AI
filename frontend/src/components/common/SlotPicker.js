import React, { useEffect, useState } from 'react';
import { consultationService, getErrorMessage } from '../../services/api';

const SlotPicker = ({ doctorId, date, value, onChange, refreshToken = 0, label = 'Available times' }) => {
  const [slots, setSlots] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { onChange(''); }, [doctorId, date]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!doctorId || !date) { setSlots(null); return undefined; }
    let cancelled = false;
    setLoading(true); setError('');
    consultationService.getSlots(doctorId, date)
      .then((r) => { if (!cancelled) setSlots(r.data.slots); })
      .catch((e) => { if (!cancelled) { setSlots([]); setError(getErrorMessage(e, 'Could not load time slots.')); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [doctorId, date, refreshToken]);

  return (
    <div role="radiogroup" aria-label={label}>
      <p className="input-label" aria-hidden="true">Time</p>
      {!doctorId || !date ? <p className="text-sm text-gray-500 dark:text-gray-400">Choose a date to see free times.</p>
        : loading ? <p role="status" className="text-sm text-gray-500">Loading times…</p>
        : error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
        : slots && slots.length === 0 ? <p role="status" className="text-sm text-amber-800 dark:text-amber-300">No free times on this date. Try another day.</p>
        : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-2">
            {(slots || []).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={value === t} onClick={() => onChange(t)}
                className={'py-2 rounded-lg text-sm font-medium border ' + (value === t ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-primary-400')}>{t}</button>
            ))}
          </div>
        )}
    </div>
  );
};

export default SlotPicker;
