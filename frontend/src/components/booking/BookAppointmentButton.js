import React, { useState } from 'react';
import { FiCalendar } from 'react-icons/fi';
import BookWithReportModal from './BookWithReportModal';

/** book an appointment with this report attached. */
const BookAppointmentButton = ({ scanId, onBooked, block = false, className = '' }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
        className={`btn-primary flex items-center justify-center space-x-2 ${block ? 'w-full py-4 text-base' : 'text-sm py-2.5 px-4'} ${className}`}>
        <FiCalendar aria-hidden="true" />
        <span>Refer to a Doctor</span>
      </button>
      {open && <BookWithReportModal scanId={scanId} onClose={() => setOpen(false)} onBooked={onBooked} />}
    </>
  );
};

export default BookAppointmentButton;
