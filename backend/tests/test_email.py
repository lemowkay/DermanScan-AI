from email.message import EmailMessage

from extensions import db
from models.email_log import EmailLog
from models.user import User
from utils.email_service import render, _clean
from .conftest import auth, register
from .helpers import book_with_report, doc_token, outbox, text_of
from .test_roles import make_admin, reg_doctor, login as rlogin


def test_booking_emails_patient_and_doctor_without_any_health_data(client, app, patient, scan_id, doctors):
    r = book_with_report(client, patient, doctors['portal'], scan_id, notes='SECRET symptom details')
    assert r.status_code == 201 and r.get_json()['email'] == 'queued'
    to = {m['To']: m for m in outbox(app)}
    assert set(to) == {'pat@example.com', 'portal@clinic.test'}                        # only the two account owners
    pat, doc = text_of(to['pat@example.com']), text_of(to['portal@clinic.test'])
    assert 'Pending' in pat and 'NOT confirmed' in pat and 'report is attached' in pat
    assert 'report is attached' in doc and 'Pat Patient' not in doc
    for t in (pat, doc):
        for secret in ('Actinic', 'Keratosis', 'SECRET', '94.2', 'Mild', 'confidence', 'itches'):
            assert secret not in t, secret
    assert not any(part.get_filename() for m in to.values() for part in m.walk())          # no attachments


def test_retry_does_not_resend_and_failed_validation_sends_nothing(client, app, patient, scan_id, doctors):
    book_with_report(client, patient, doctors['portal'], scan_id, consent=False)
    assert outbox(app) == []
    k = {'idempotency_key': 'k1'}
    book_with_report(client, patient, doctors['portal'], scan_id, **k)
    book_with_report(client, patient, doctors['portal'], scan_id, **k)
    assert len(outbox(app)) == 2


def test_completed_notifies_patient_without_feedback_text(client, app, patient, scan_id, doctors):
    from datetime import datetime, timedelta
    from extensions import db
    from models.consultation import Consultation
    doc = doc_token(client)
    cid = book_with_report(client, patient, doctors['portal'], scan_id).get_json()['consultation']['id']
    client.post('/api/doctor/appointments/%d/confirm' % cid, headers=auth(doc), json={})
    c = db.session.get(Consultation, cid); c.appointment_date = datetime.now() - timedelta(minutes=5); db.session.commit()
    app.extensions['outbox'].clear()
    client.post('/api/doctor/appointments/%d/complete' % cid, headers=auth(doc), json={'note': 'SECRET-DIAGNOSIS-NOTE please see me'})
    m = outbox(app)[-1]
    t = text_of(m)
    assert m['To'] == 'pat@example.com' and 'completed' in m['Subject'] and 'follow-up note' in t
    assert 'SECRET-DIAGNOSIS-NOTE' not in t


def test_admin_approval_and_rejection_notify_doctor(client, app):
    reg_doctor(client)
    admin = make_admin(app)
    uid = client.get('/api/admin/doctors', headers=auth(admin)).get_json()['doctors'][0]['id']
    client.post('/api/admin/doctors/%d/approve' % uid, headers=auth(admin), json={'checked_on_register': True})
    m = outbox(app)[-1]
    assert m['To'] == 'dr@clinic.test' and 'verified' in m['Subject'] and 'HPCSA' in text_of(m)
    client.post('/api/admin/doctors/%d/reject' % uid, headers=auth(admin), json={'reason': 'PRIVATE REASON TEXT'})
    m = outbox(app)[-1]
    assert 'Update on your' in m['Subject'] and 'PRIVATE REASON TEXT' not in text_of(m)
    # failed approvals (no iRegister confirmation) send nothing
    n = len(outbox(app))
    client.post('/api/admin/doctors/%d/approve' % uid, headers=auth(admin), json={})
    assert len(outbox(app)) == n


def test_email_log_records_outcome_without_body(client, app, patient, scan_id, doctors):
    book_with_report(client, patient, doctors['portal'], scan_id)
    rows = {r.to_email: r for r in EmailLog.query.all()}
    row = rows['pat@example.com']
    assert row.status == 'sent' and row.template == 'appointment_requested'
    assert not hasattr(row, 'body')
    admin = make_admin(app)
    assert client.get('/api/admin/email-log', headers=auth(admin)).status_code == 200
    assert client.get('/api/admin/email-log', headers=auth(patient)).status_code == 403


def test_email_failure_never_breaks_the_action(client, app, patient, scan_id, doctors):
    app.config.update(MAIL_BACKEND='smtp', SMTP_HOST='127.0.0.1', SMTP_PORT=1, SMTP_SECURITY='none')  # nothing listens
    r = book_with_report(client, patient, doctors['portal'], scan_id)
    assert r.status_code == 201 and r.get_json()['consultation']['status'] == 'pending'
    assert EmailLog.query.filter_by(to_email='pat@example.com').one().status == 'failed'


def test_console_mode_never_claims_to_send(client, app, patient, scan_id, doctors):
    app.config.update(MAIL_BACKEND='console')
    r = book_with_report(client, patient, doctors['portal'], scan_id)
    assert r.get_json()['email'] == 'not_configured'
    assert {x.status for x in EmailLog.query.all()} == {'not_configured'}


def test_templates_escape_and_strip_injection(app):
    with app.test_request_context():
        subject, text, html = render('appointment_requested', {'name': '<script>alert(1)</script>', 'doctor_name': 'Dr\r\nBcc: evil@x.co',
                                                              'when': 'Mon 5 Jan 2099, 09:00', 'has_report': True})
        assert '<script>' not in html and '&lt;script&gt;' in html
        assert '\n' not in subject and '\r' not in subject
        assert _clean('a\r\nb') == 'a b'
        msg = EmailMessage(); msg['Subject'] = subject  # must not raise


def test_password_reset_email_when_configured(client, app):
    register(client)
    r = client.post('/api/auth/forgot-password', json={'email': 'pat@example.com'}).get_json()
    assert r['email_delivery'] == 'configured' and 'dev_reset_link' not in r
    m = outbox(app)[0]
    assert m['To'] == 'pat@example.com' and 'reset-password?token=' in text_of(m)
    # unknown address: same response, no email
    client.post('/api/auth/forgot-password', json={'email': 'nobody@x.co'})
    assert len(outbox(app)) == 1
