
export const formatDateTime = (value) => {
  if (!value) return '';

  // Backend stores appointment times as local wall-clock times.
  // Do not interpret timezone-free values as UTC.
  const normalized = value.replace(' ', 'T');

  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);

  let date;

  if (hasTimezone) {
    date = new Date(normalized);
  } else {
    const match = normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
    );

    if (!match) return '';

    const [, year, month, day, hour, minute, second = '0'] = match;

    date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
  }

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

export const formatDate = (value) =>
  value ? formatDateTime(value).split(',').slice(0, 2).join(',') : '';


//export const formatDate = (iso) => (iso ? formatDateTime(iso).split(',').slice(0, 2).join(',') : '');

export const severityBg = (severity) => ({
  Mild: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
  Moderate: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
  Severe: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
  Benign: 'bg-medical-50 dark:bg-medical-900/20 text-medical-700 dark:text-medical-400',
}[severity] || 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400');
