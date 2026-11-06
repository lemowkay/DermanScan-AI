import React, { useRef } from 'react';
import { FaHospitalUser, FaUserMd, FaUserShield } from 'react-icons/fa';

const ROLES = [
  { value: 'user', title: 'Patient', Icon: FaHospitalUser },
  { value: 'doctor', title: 'Doctor', Icon: FaUserMd },
  { value: 'admin', title: 'Admin', Icon: FaUserShield },
];

const RoleCards = ({ value, onChange, legend = 'I am a…', disabled = false }) => {
  const refs = useRef([]);

  const onKeyDown = (e, i) => {
    let next = null;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = (i + 1) % ROLES.length;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = (i - 1 + ROLES.length) % ROLES.length;
    }

    if (next !== null) {
      e.preventDefault();
      onChange(ROLES[next].value);
      refs.current[next]?.focus();
    }
  };

  return (
    <div role="radiogroup" aria-label={legend}>
      <p className="input-label" aria-hidden="true">{legend}</p>

      <div className="grid grid-cols-3 gap-3">
        {ROLES.map(({ value: v, title, Icon }, i) => {
          const selected = value === v;

          return (
            <button
              key={v}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(v)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={
                'flex flex-col items-center justify-center text-center py-5 px-3 rounded-2xl border-2 transition-all ' +
                (selected
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md'
                  : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-primary-300')
              }
            >
              <span
                data-testid={`logo-${v}`}
                className={
                  'w-16 h-16 rounded-2xl flex items-center justify-center mb-3 text-3xl transition-colors ' +
                  (selected
                    ? 'gradient-primary text-white shadow-lg shadow-primary-500/25'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300')
                }
              >
                <Icon aria-hidden="true" />
              </span>

              <span className="block font-bold text-base text-gray-900 dark:text-white">
                {title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RoleCards;