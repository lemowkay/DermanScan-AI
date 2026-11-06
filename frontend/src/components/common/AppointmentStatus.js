import React from 'react';

const MAP = {
  pending: ['Pending', 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'],
  confirmed: ['Confirmed', 'bg-medical-50 text-medical-800 border-medical-200 dark:bg-medical-900/20 dark:text-medical-300 dark:border-medical-800'],
  completed: ['Completed', 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800'],
  declined: ['Declined', 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'],
  cancelled: ['Cancelled', 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700/50 dark:text-gray-300 dark:border-gray-600'],
};

export const initials = (name = '') => {
  const parts = name.replace(/^(dr\.?|prof\.?)\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return (parts[0] || '?').charAt(0).toUpperCase();      
};

const AppointmentStatus = ({ status }) => {
  const [label, cls] = MAP[status] || [status, MAP.cancelled[1]];
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${cls}`}>{label}</span>;
};

export default AppointmentStatus;
