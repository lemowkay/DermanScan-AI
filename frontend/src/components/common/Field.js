import React from 'react';
import { FiAlertCircle } from 'react-icons/fi';

const Field = ({ id, label, error, hint, children, ...inputProps }) => {
  const errId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div>
      <label htmlFor={id} className="input-label">{label}</label>
      {children || (
        <input
          id={id}
          className={'input-field ' + (error ? '!border-red-400 dark:!border-red-500' : '')}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={[error && errId, hint && hintId].filter(Boolean).join(' ') || undefined}
          {...inputProps}
        />
      )}
      {hint && !error && <p id={hintId} className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{hint}</p>}
      {error && (
        <p id={errId} className="text-sm text-red-600 dark:text-red-400 mt-1.5 flex items-start gap-1" role="alert">
          <FiAlertCircle className="mt-0.5 flex-shrink-0" aria-hidden="true" /><span>{error}</span>
        </p>
      )}
    </div>
  );
};

export default Field;
