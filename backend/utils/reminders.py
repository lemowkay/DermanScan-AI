
import threading
import time
from datetime import datetime, timedelta

from extensions import db
from models.consultation import Consultation
from utils.email_service import mail_configured, send_template


def _fmt(dt):
    return dt.strftime('%a %d %b %Y, %H:%M')


def send_due_reminders(app, now=None):
    """Returns the number of appointments reminded."""
    with app.app_context():
        if not mail_configured(app):
            return 0
        now = now or datetime.now()
        horizon = now + timedelta(hours=float(app.config['REMINDER_HOURS_BEFORE']))
        due = Consultation.query.filter(Consultation.status == 'confirmed', Consultation.reminder_sent_at.is_(None),
                                        Consultation.appointment_date > now, Consultation.appointment_date <= horizon).all()
        sent = 0
        for c in due:
            claimed = Consultation.query.filter(Consultation.id == c.id, Consultation.reminder_sent_at.is_(None),
                                                Consultation.status == 'confirmed') \
                .update({'reminder_sent_at': datetime.utcnow()}, synchronize_session=False)
            db.session.commit()
            if claimed != 1:
                continue
            when = _fmt(c.appointment_date)
            statuses = []
            try:
                statuses.append(send_template('appointment_reminder', c.patient.email,
                                              {'name': c.patient.name, 'doctor_name': c.doctor.name, 'when': when, 'type': c.type}, sync=True))
                if c.doctor.account:
                    statuses.append(send_template('appointment_reminder', c.doctor.account.email,
                                                  {'name': c.doctor.name, 'when': when, 'type': c.type, 'for_doctor': True}, sync=True))
            except Exception:
                app.logger.exception('Reminder failed for consultation %s', c.id)
                statuses.append('failed')
            if all(st != 'sent' for st in statuses):
                Consultation.query.filter(Consultation.id == c.id).update({'reminder_sent_at': None}, synchronize_session=False)
                db.session.commit()
                app.logger.error('Reminder for consultation %s could not be delivered; will retry', c.id)
                continue
            sent += 1
        return sent


def start_reminder_loop(app):
    interval = max(1, int(app.config['REMINDER_CHECK_MINUTES'])) * 60

    def loop():
        time.sleep(20)                     
        while True:
            try:
                n = send_due_reminders(app)
                if n:
                    app.logger.info('Sent %d appointment reminder(s)', n)
            except Exception:
                app.logger.exception('Reminder loop error')
            time.sleep(interval)

    threading.Thread(target=loop, name='appointment-reminders', daemon=True).start()
