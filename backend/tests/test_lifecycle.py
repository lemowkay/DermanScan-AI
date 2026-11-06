from datetime import datetime, timedelta

from extensions import db
from models.consultation import Consultation
from utils.reminders import send_due_reminders
from .conftest import auth, register
from .test_booking import approved_doctor, book, next_weekday, slots
from .test_email import outbox, text_of


def setup_booking(client, app, hhmm='09:00', confirm=True):
    doc_id, dtok, admin, uid = approved_doctor(client, app)
    pat = register(client).get_json()['token']
    day = next_weekday()
    cid = book(client, pat, doc_id, day, hhmm).get_json()['consultation']['id']
    if confirm:
        client.post('/api/doctor/appointments/%d/confirm' % cid, headers=auth(dtok), json={'note': 'ok'})
    return doc_id, dtok, pat, day, cid


def resched(client, tok, cid, day, hhmm):
    return client.post('/api/consultation/%d/reschedule' % cid, headers=auth(tok), json={'appointment_date': '%s %s' % (day.isoformat(), hhmm)})


def force(cid, **fields):
    c = db.session.get(Consultation, cid)
    for k, v in fields.items():
        setattr(c, k, v)
    db.session.commit()


# ============================ rescheduling ============================
def test_reschedule_confirmed_goes_back_to_pending_and_frees_old_slot(client, app):
    doc_id, dtok, pat, day, cid = setup_booking(client, app)
    app.extensions['outbox'].clear()
    r = resched(client, pat, cid, day, '11:00')
    assert r.status_code == 200
    c = r.get_json()['consultation']
    assert c['status'] == 'pending' and c['appointment_date'].endswith('11:00:00') and c['reschedule_count'] == 1 and c['doctor_note'] is None
    s = slots(client, pat, doc_id, day)['slots']
    assert '09:00' in s and '11:00' not in s                                       # old freed, new taken
    to = {m['To']: m for m in outbox(app)}
    assert 'dr@clinic.test' in to and 'moved' in to['dr@clinic.test']['Subject'] and 'Pending again' in text_of(to['dr@clinic.test'])
    assert 'Pending' in text_of(to['pat@example.com'])                              # patient told it is NOT confirmed
    # the doctor sees it as pending again and can confirm the new time
    assert client.get('/api/doctor/appointments?status=pending', headers=auth(dtok)).get_json()['appointments'][0]['id'] == cid
    assert client.post('/api/doctor/appointments/%d/confirm' % cid, headers=auth(dtok)).status_code == 200


def test_reschedule_rules(client, app):
    doc_id, dtok, pat, day, cid = setup_booking(client, app)
    other = register(client, 'o@o.co').get_json()['token']
    assert resched(client, other, cid, day, '10:00').status_code == 404                  # not theirs
    assert resched(client, pat, cid, day, '09:00').status_code == 400                    # same time
    assert resched(client, pat, cid, day, '10:15').status_code == 409                    # off grid
    assert resched(client, pat, cid, day, '18:00').status_code == 409                    # outside hours
    assert resched(client, pat, cid, datetime.now().date() - timedelta(days=1), '10:00').status_code == 409
    assert client.post('/api/consultation/%d/reschedule' % cid, headers=auth(pat), json={'appointment_date': 'x'}).status_code == 400
    assert client.post('/api/consultation/%d/reschedule' % cid, json={}).status_code == 401
    assert client.post('/api/consultation/%d/reschedule' % cid, headers=auth(dtok), json={}).status_code == 403   # doctors cannot use patient endpoint


def test_cannot_reschedule_into_a_taken_slot(client, app):
    doc_id, dtok, pat, day, cid = setup_booking(client, app)
    other = register(client, 'o@o.co').get_json()['token']
    book(client, other, doc_id, day, '10:00')
    r = resched(client, pat, cid, day, '10:00')
    assert r.status_code == 409 and r.get_json()['code'] == 'slot_unavailable'
    assert db.session.get(Consultation, cid).appointment_date.strftime('%H:%M') == '09:00'      # unchanged on failure


def test_reschedule_limit_and_closed_states(client, app):
    doc_id, dtok, pat, day, cid = setup_booking(client, app, confirm=False)
    for hh in ('10:00', '10:30', '11:00'):
        assert resched(client, pat, cid, day, hh).status_code == 200
    r = resched(client, pat, cid, day, '11:30')
    assert r.status_code == 400 and r.get_json()['code'] == 'reschedule_limit'
    assert client.get('/api/consultation/list', headers=auth(pat)).get_json()['consultations'][0]['can_reschedule'] is False
    # cancelled / declined / completed / started appointments cannot be rescheduled
    for status in ('cancelled', 'declined', 'completed'):
        force(cid, status=status, reschedule_count=0)
        assert resched(client, pat, cid, day, '14:00').status_code == 400, status
    force(cid, status='confirmed', appointment_date=datetime.now() - timedelta(hours=1))
    assert resched(client, pat, cid, day, '14:00').status_code == 400


def test_reschedule_blocked_if_doctor_no_longer_bookable(client, app):
    doc_id, dtok, pat, day, cid = setup_booking(client, app)
    client.put('/api/doctor/profile', headers=auth(dtok), json={'available': False})
    r = resched(client, pat, cid, day, '14:00')
    assert r.status_code == 400 and r.get_json()['code'] == 'not_bookable'


# ============================ completed ============================
def test_complete_flow_and_guards(client, app):
    doc_id, dtok, pat, day, cid = setup_booking(client, app)
    done = lambda tok=dtok: client.post('/api/doctor/appointments/%d/complete' % cid, headers=auth(tok), json={'note': 'Follow-up in 2 weeks'})
    r = done()
    assert r.status_code == 400 and r.get_json()['code'] == 'not_started'                  # future appointment
    force(cid, appointment_date=datetime.now() - timedelta(minutes=5))
    _, otok, *_ = approved_doctor(client, app, email='dr2@clinic.test', hpcsa='MP0999999')
    assert done(otok).status_code == 404                                                    # another doctor
    assert done(pat).status_code == 403                                                     # patient
    r = done()
    assert r.status_code == 200 and r.get_json()['appointment']['status'] == 'completed'
    assert done().status_code == 400                                                        # already completed
    mine = client.get('/api/consultation/list', headers=auth(pat)).get_json()['consultations'][0]
    assert mine['status'] == 'completed' and mine['doctor_note'] == 'Follow-up in 2 weeks' and mine['can_change'] is False
    assert client.post('/api/consultation/%d/cancel' % cid, headers=auth(pat)).status_code == 400
    assert client.get('/api/doctor/appointments?status=completed', headers=auth(dtok)).get_json()['appointments'][0]['id'] == cid


def test_only_confirmed_can_be_completed(client, app):
    doc_id, dtok, pat, day, cid = setup_booking(client, app, confirm=False)
    force(cid, appointment_date=datetime.now() - timedelta(minutes=5))                      # pending + started
    assert client.post('/api/doctor/appointments/%d/complete' % cid, headers=auth(dtok)).status_code == 400


def test_completed_appointment_does_not_block_its_slot(client, app):
    doc_id, dtok, pat, day, cid = setup_booking(client, app)
    force(cid, status='completed')
    assert '09:00' in slots(client, pat, doc_id, day)['slots']


# ============================ reminders ============================
def soon(hours):
    return datetime.now() + timedelta(hours=hours)


def test_reminder_goes_to_patient_and_doctor_once_for_confirmed_only(client, app):
    doc_id, dtok, pat, day, cid = setup_booking(client, app)
    force(cid, appointment_date=soon(3))
    app.extensions['outbox'].clear()
    assert send_due_reminders(app) == 1
    to = {m['To']: m for m in outbox(app)}
    assert set(to) == {'pat@example.com', 'dr@clinic.test'}
    assert all('Reminder' in m['Subject'] for m in to.values())
    assert 'Pat Patient' not in text_of(to['dr@clinic.test']) and 'rash' not in ''.join(text_of(m) for m in to.values())
    assert send_due_reminders(app) == 0 and len(outbox(app)) == 2                           # exactly once, even if run again


def test_reminder_window_and_status_rules(client, app):
    doc_id, dtok, pat, day, cid = setup_booking(client, app, confirm=False)
    force(cid, appointment_date=soon(3))
    assert send_due_reminders(app) == 0                                                      # pending: no reminder
    force(cid, status='confirmed', appointment_date=soon(30))
    assert send_due_reminders(app) == 0                                                      # outside 24h window
    force(cid, appointment_date=datetime.now() - timedelta(hours=1))
    assert send_due_reminders(app) == 0                                                      # already started
    force(cid, appointment_date=soon(5), status='cancelled')
    assert send_due_reminders(app) == 0                                                      # cancelled
    force(cid, status='confirmed')
    assert send_due_reminders(app, now=datetime.now()) == 1


def test_no_reminders_claimed_when_email_not_configured(client, app):
    doc_id, dtok, pat, day, cid = setup_booking(client, app)
    force(cid, appointment_date=soon(3))
    app.config.update(MAIL_BACKEND='console')
    assert send_due_reminders(app) == 0
    assert db.session.get(Consultation, cid).reminder_sent_at is None                        # nothing lost
    app.config.update(MAIL_BACKEND='memory')                                                 # email set up later -> reminder still sent
    assert send_due_reminders(app) == 1


def test_rescheduling_gives_the_new_time_its_own_reminder(client, app):
    doc_id, dtok, pat, day, cid = setup_booking(client, app)
    force(cid, appointment_date=soon(3))
    assert send_due_reminders(app) == 1
    resched(client, pat, cid, day, '15:00')                                                  # back to pending, claim cleared
    assert db.session.get(Consultation, cid).reminder_sent_at is None
    client.post('/api/doctor/appointments/%d/confirm' % cid, headers=auth(dtok))
    force(cid, appointment_date=soon(2))
    assert send_due_reminders(app) == 1


def test_claim_is_atomic_so_parallel_workers_cannot_double_send(client, app):
    doc_id, dtok, pat, day, cid = setup_booking(client, app)
    force(cid, appointment_date=soon(3))
    # a "second process" claims it between our SELECT and UPDATE
    first = Consultation.query.filter(Consultation.id == cid, Consultation.reminder_sent_at.is_(None)).update({'reminder_sent_at': datetime.utcnow()})
    db.session.commit()
    again = Consultation.query.filter(Consultation.id == cid, Consultation.reminder_sent_at.is_(None)).update({'reminder_sent_at': datetime.utcnow()})
    assert first == 1 and again == 0


def test_failed_delivery_releases_the_claim_and_is_retried(client, app):
    doc_id, dtok, pat, day, cid = setup_booking(client, app)
    force(cid, appointment_date=soon(3))
    app.config.update(MAIL_BACKEND='smtp', SMTP_HOST='127.0.0.1', SMTP_PORT=1, SMTP_SECURITY='none')   # nothing listens
    assert send_due_reminders(app) == 0
    assert db.session.get(Consultation, cid).reminder_sent_at is None                                  # not lost
    app.config.update(MAIL_BACKEND='memory')                                                           # SMTP back
    app.extensions['outbox'] = []
    assert send_due_reminders(app) == 1 and len(outbox(app)) == 2


def test_reminders_are_delivered_before_the_function_returns(client, app):
    """Regression: a one-shot cron process used to exit before queued emails were sent."""
    doc_id, dtok, pat, day, cid = setup_booking(client, app)
    force(cid, appointment_date=soon(3))
    app.config['MAIL_SYNC'] = False                      # production-like (async) setting
    app.extensions['outbox'] = []
    assert send_due_reminders(app) == 1
    assert len(outbox(app)) == 2                         # already delivered, no waiting on threads
