from datetime import datetime, timedelta

from extensions import db
from models.consultation import Consultation, Doctor
from models.user import User
from .conftest import auth, register
from .helpers import next_weekday, outbox, text_of
from .test_roles import login, make_admin, reg_doctor


def approved_doctor(client, app, email='dr@clinic.test', hpcsa='MP0729515'):
    reg_doctor(client, email=email, hpcsa=hpcsa)
    admin = make_admin(app) if not User.query.filter_by(email='admin@x.test').first() else login(client, 'admin@x.test', 'user', 'Admin12345').get_json()['token']
    uid = User.query.filter_by(email=email).first().id
    client.post('/api/admin/doctors/%d/approve' % uid, headers=auth(admin), json={'checked_on_register': True})
    doc = Doctor.query.filter_by(user_id=uid).first()
    return doc.id, login(client, email, 'doctor').get_json()['token'], admin, uid


def slots(client, tok, doc_id, day):
    return client.get('/api/consultation/doctors/%d/slots?date=%s' % (doc_id, day.isoformat()), headers=auth(tok)).get_json()


def book(client, tok, doc_id, day, hhmm, **kw):
    body = {'doctor_id': doc_id, 'type': 'video', 'notes': 'rash on arm', 'appointment_date': '%s %s' % (day.isoformat(), hhmm)}
    body.update(kw)
    return client.post('/api/consultation/appointment', headers=auth(tok), json=body)


# ---------------- registered doctors appear (once verified) ----------------
def test_registered_doctor_appears_only_after_approval_and_can_edit_profile(client, app):
    patient = register(client).get_json()['token']
    reg_doctor(client)
    doc_tok = login(client, 'dr@clinic.test', 'doctor').get_json()['token']
    names = lambda: [d['name'] for d in client.get('/api/consultation/doctors', headers=auth(patient)).get_json()['doctors']]
    assert 'Dr Jane Doe' not in names()                                         # pending: hidden

    # a pending doctor can prepare their profile, but not use doctor features
    r = client.put('/api/doctor/profile', headers=auth(doc_tok), json={'specialty': 'Dermatologist', 'hospital': 'City Clinic', 'experience': '9 years',
                                                                       'bio': 'I treat skin conditions.', 'phone': '+27 51 123 4567'})
    assert r.status_code == 200 and r.get_json()['listed'] is False
    assert client.get('/api/doctor/appointments', headers=auth(doc_tok)).status_code == 403
    assert 'Dr Jane Doe' not in names()

    admin = make_admin(app); uid = User.query.filter_by(email='dr@clinic.test').first().id
    client.post('/api/admin/doctors/%d/approve' % uid, headers=auth(admin), json={'checked_on_register': True})
    listing = client.get('/api/consultation/doctors', headers=auth(patient)).get_json()['doctors']
    d = [x for x in listing if x['name'] == 'Dr Jane Doe'][0]
    assert d['specialty'] == 'Dermatologist' and d['hospital'] == 'City Clinic' and d['bio'] and d['verified'] and d['bookable']

    # revoke hides again; doctor can also switch themselves off
    client.post('/api/admin/doctors/%d/reject' % uid, headers=auth(admin), json={'reason': 'lapsed'})
    assert 'Dr Jane Doe' not in names()


def test_doctor_can_hide_themselves_and_validation(client, app):
    doc_id, tok, *_ = approved_doctor(client, app)
    patient = register(client).get_json()['token']
    assert client.put('/api/doctor/profile', headers=auth(tok), json={'available': False}).status_code == 200
    assert doc_id not in [d['id'] for d in client.get('/api/consultation/doctors', headers=auth(patient)).get_json()['doctors']]
    assert client.put('/api/doctor/profile', headers=auth(tok), json={'phone': 'abc'}).status_code == 400
    assert client.put('/api/doctor/profile', headers=auth(tok), json={'bio': 'x' * 601}).status_code == 400
    assert client.put('/api/doctor/profile', headers=auth(tok), json={'specialty': ''}).status_code == 400
    assert client.put('/api/doctor/profile', headers=auth(register(client, 'x@x.co').get_json()['token']), json={}).status_code == 403


def test_unverified_doctor_cannot_be_booked_even_with_a_report(client, app, scan_id, patient):
    from utils.report_share import CONSENT_VERSION
    reg_doctor(client)
    d = Doctor.query.filter_by(email='dr@clinic.test').first()
    day = next_weekday()
    r = book(client, patient, d.id, day, '09:00', scan_id=scan_id, consent=True, consent_version=CONSENT_VERSION)
    assert r.status_code == 404
    assert book(client, patient, d.id, day, '09:00').status_code == 404
    assert client.get('/api/consultation/doctors/%d/slots?date=%s' % (d.id, day), headers=auth(patient)).status_code == 404


# ---------------- slots and booking ----------------
def test_slots_respect_hours_weekends_and_booked(client, app):
    doc_id, _, *_ = approved_doctor(client, app)
    pat = register(client).get_json()['token']
    day = next_weekday()
    s = slots(client, pat, doc_id, day)
    assert s['bookable'] and s['slots'][0] == '08:00' and s['slots'][-1] == '16:30' and len(s['slots']) == 18
    sat = day + timedelta(days=(5 - day.weekday()) % 7 or 7)
    assert slots(client, pat, doc_id, sat)['slots'] == []
    assert book(client, pat, doc_id, day, '10:00').status_code == 201
    assert '10:00' not in slots(client, pat, doc_id, day)['slots']
    assert client.get('/api/consultation/doctors/%d/slots?date=nope' % doc_id, headers=auth(pat)).status_code == 400


def test_booking_validation(client, app):
    doc_id, *_ = approved_doctor(client, app)
    pat = register(client).get_json()['token']
    day = next_weekday()
    assert book(client, pat, doc_id, day, '10:15').status_code == 409                       # off-grid
    assert book(client, pat, doc_id, day, '07:00').status_code == 409                       # outside hours
    assert book(client, pat, doc_id, day, '17:00').status_code == 409
    assert book(client, pat, doc_id, datetime.now().date() - timedelta(days=1), '10:00').status_code == 409   # past
    assert book(client, pat, doc_id, day, '10:00', type='teleport').status_code == 400
    assert book(client, pat, doc_id, day, '10:00', doctor_id=99999).status_code == 404
    assert client.post('/api/consultation/appointment', headers=auth(pat), json={}).status_code == 400
    assert book(client, pat, doc_id, day + timedelta(days=200), '10:00').status_code == 409  # too far ahead


def test_double_booking_blocked_then_freed_by_cancel(client, app):
    doc_id, *_ = approved_doctor(client, app)
    a = register(client, 'a@x.co').get_json()['token']; b = register(client, 'b@x.co').get_json()['token']
    day = next_weekday()
    first = book(client, a, doc_id, day, '09:00')
    assert first.status_code == 201
    r = book(client, b, doc_id, day, '09:00')
    assert r.status_code == 409 and r.get_json()['code'] == 'slot_unavailable'
    cid = first.get_json()['consultation']['id']
    assert client.post('/api/consultation/%d/cancel' % cid, headers=auth(b)).status_code == 404       # not theirs
    assert client.post('/api/consultation/%d/cancel' % cid, headers=auth(a)).status_code == 200
    assert client.post('/api/consultation/%d/cancel' % cid, headers=auth(a)).status_code == 400       # already cancelled
    assert book(client, b, doc_id, day, '09:00').status_code == 201


def test_directory_only_doctor_is_listed_but_not_bookable(client, app):
    d = Doctor(name='Dr Walkin', specialty='Derm', available=True); db.session.add(d); db.session.commit()
    pat = register(client).get_json()['token']
    entry = [x for x in client.get('/api/consultation/doctors', headers=auth(pat)).get_json()['doctors'] if x['name'] == 'Dr Walkin'][0]
    assert entry['bookable'] is False and entry['verified'] is False
    assert slots(client, pat, d.id, next_weekday())['slots'] == []
    r = book(client, pat, d.id, next_weekday(), '09:00')
    assert r.status_code == 400 and r.get_json()['code'] == 'not_bookable'


# ---------------- doctor handles requests ----------------
def test_doctor_confirm_decline_flow_with_emails_and_isolation(client, app):
    doc_id, dtok, admin, _ = approved_doctor(client, app)
    other_id, otok, *_ = approved_doctor(client, app, email='dr2@clinic.test', hpcsa='MP0999999')
    pat = register(client).get_json()['token']
    day = next_weekday()
    c1 = book(client, pat, doc_id, day, '09:00').get_json()['consultation']['id']
    c2 = book(client, pat, doc_id, day, '09:30').get_json()['consultation']['id']

    appts = client.get('/api/doctor/appointments', headers=auth(dtok)).get_json()['appointments']
    assert len(appts) == 2 and appts[0]['patient_name'] == 'Pat Patient' and appts[0]['notes'] == 'rash on arm'
    assert client.get('/api/doctor/appointments', headers=auth(otok)).get_json()['appointments'] == []   # isolation
    assert client.post('/api/doctor/appointments/%d/confirm' % c1, headers=auth(otok)).status_code == 404
    assert client.get('/api/doctor/appointments', headers=auth(pat)).status_code == 403

    app.extensions['outbox'].clear()
    r = client.post('/api/doctor/appointments/%d/confirm' % c1, headers=auth(dtok), json={'note': 'Bring previous scans'})
    assert r.status_code == 200 and r.get_json()['appointment']['status'] == 'confirmed'
    m = outbox(app)[-1]
    assert m['To'] == 'pat@example.com' and 'confirmed' in m['Subject'] and 'Bring previous scans' not in text_of(m)
    assert client.post('/api/doctor/appointments/%d/confirm' % c1, headers=auth(dtok)).status_code == 400   # not pending anymore

    assert client.post('/api/doctor/appointments/%d/decline' % c2, headers=auth(dtok), json={'reason': 'On leave'}).status_code == 200
    mine = client.get('/api/consultation/list', headers=auth(pat)).get_json()['consultations']
    by = {c['id']: c for c in mine}
    assert by[c1]['status'] == 'confirmed' and by[c1]['doctor_note'] == 'Bring previous scans' and by[c1]['doctor_name'] == 'Dr Jane Doe'
    assert by[c2]['status'] == 'declined'
    assert '09:30' in slots(client, pat, doc_id, day)['slots']                   # declined slot is free again


def test_booking_sends_patient_and_doctor_emails_without_health_details(client, app):
    doc_id, *_ = approved_doctor(client, app)
    pat = register(client).get_json()['token']
    app.extensions['outbox'].clear()
    book(client, pat, doc_id, next_weekday(), '11:00', notes='SECRET symptom details')
    to = {m['To']: m for m in outbox(app)}
    assert set(to) == {'pat@example.com', 'dr@clinic.test'}
    assert 'Pending' in text_of(to['pat@example.com']) and 'NOT confirmed' in text_of(to['pat@example.com'])
    for m in to.values():
        assert 'SECRET' not in text_of(m) and 'Pat Patient' not in text_of(to['dr@clinic.test'])


def test_cancel_notifies_doctor(client, app):
    doc_id, *_ = approved_doctor(client, app)
    pat = register(client).get_json()['token']
    cid = book(client, pat, doc_id, next_weekday(), '13:00').get_json()['consultation']['id']
    app.extensions['outbox'].clear()
    client.post('/api/consultation/%d/cancel' % cid, headers=auth(pat))
    assert outbox(app)[-1]['To'] == 'dr@clinic.test' and 'cancelled' in outbox(app)[-1]['Subject']
