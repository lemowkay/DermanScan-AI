import io

from extensions import db
from models.consultation import Doctor
from models.user import User
from .conftest import auth, make_image, register


def reg_doctor(client, email='dr@clinic.test', hpcsa='MP 0729515', **kw):
    body = {'name': 'Dr Jane Doe', 'email': email, 'password': 'Password1', 'confirm_password': 'Password1', 'role': 'doctor',
            'hpcsa_number': hpcsa, 'practice_number': '0123456', 'accepted_terms': True}
    body.update(kw)
    return client.post('/api/auth/register', json=body)


def login(client, email, role, pw='Password1'):
    return client.post('/api/auth/login', json={'email': email, 'password': pw, 'role': role})


def make_admin(app):
    a = User(name='Admin', email='admin@x.test', role='admin', verification_status='not_required'); a.set_password('Admin12345')
    db.session.add(a); db.session.commit()
    return login(app.test_client(), 'admin@x.test', 'user', 'Admin12345').get_json()['token']


# ---------------- registration ----------------
def test_doctor_registration_is_pending_and_normalises_number(client):
    r = reg_doctor(client)
    assert r.status_code == 201
    u = r.get_json()['user']
    assert u['role'] == 'doctor' and u['verification_status'] == 'pending' and u['hpcsa_number'] == 'MP0729515'


def test_hpcsa_required_and_format_checked(client):
    assert reg_doctor(client, hpcsa='').status_code == 400
    r = reg_doctor(client, hpcsa='12345')
    assert r.status_code == 400 and 'hpcsa_number' in r.get_json()['errors']
    assert reg_doctor(client, hpcsa='MP 0729515', practice_number='<script>').status_code == 400


def test_practice_number_optional(client):
    assert reg_doctor(client, practice_number='').status_code == 201


def test_confirm_password_must_match(client):
    assert reg_doctor(client, confirm_password='Different1').status_code == 400
    r = client.post('/api/auth/register', json={'name': 'Pat', 'email': 'p@p.co', 'password': 'Password1', 'confirm_password': 'x',
                                                  'role': 'user', 'accepted_terms': True})
    assert r.status_code == 400 and 'confirm_password' in r.get_json()['errors']


def test_duplicate_hpcsa_rejected(client):
    assert reg_doctor(client).status_code == 201
    r = reg_doctor(client, email='other@clinic.test', hpcsa='mp-0729515')
    assert r.status_code == 409


def test_cannot_register_as_admin_or_unknown_role(client):
    for role in ('admin', 'superuser', ''):
        assert reg_doctor(client, role=role, email='x%s@x.co' % role).status_code == 400


def test_patient_ignores_injected_hpcsa(client):
    r = client.post('/api/auth/register', json={'name': 'Pat', 'email': 'p@p.co', 'password': 'Password1', 'confirm_password': 'Password1',
                                                  'role': 'user', 'hpcsa_number': 'MP0729515', 'accepted_terms': True})
    assert r.get_json()['user']['hpcsa_number'] is None and r.get_json()['user']['verification_status'] == 'not_required'


# ---------------- login role cards ----------------
def test_login_role_must_match_account(client):
    register(client)
    reg_doctor(client)
    assert login(client, 'pat@example.com', 'user').status_code == 200
    r = login(client, 'pat@example.com', 'doctor')
    assert r.status_code == 403 and r.get_json()['code'] == 'role_mismatch'
    assert login(client, 'dr@clinic.test', 'doctor').status_code == 200
    assert login(client, 'dr@clinic.test', 'user').status_code == 403
    assert client.post('/api/auth/login', json={'email': 'pat@example.com', 'password': 'Password1'}).status_code == 400  # role required
    # a wrong password never reveals the role mismatch
    assert login(client, 'pat@example.com', 'doctor', 'WrongPass1').status_code == 401


# ---------------- backend permission enforcement ----------------
def test_pending_doctor_has_no_privileges(client, app):
    reg_doctor(client)
    tok = login(client, 'dr@clinic.test', 'doctor').get_json()['token']
    assert client.get('/api/auth/profile', headers=auth(tok)).get_json()['user']['verification_status'] == 'pending'
    r = client.get('/api/doctor/appointments', headers=auth(tok))
    assert r.status_code == 403 and r.get_json()['code'] == 'doctor_not_verified'
    assert client.get('/api/admin/users', headers=auth(tok)).status_code == 403
    # a profile exists (so they can fill it in) but is NOT visible to patients while pending
    d = Doctor.query.filter_by(email='dr@clinic.test').first()
    assert d is not None and d.is_listed is False


def test_roles_are_enforced_server_side(client, patient, scan_id, doctors):
    doc = login(client, 'portal@clinic.test', 'doctor', 'Doctor123').get_json()['token']
    # doctor cannot use patient endpoints
    assert client.get('/api/scan/history', headers=auth(doc)).status_code == 403
    assert client.post('/api/scan/upload', headers=auth(doc), data={'image': (io.BytesIO(make_image()), 'a.png', 'image/png')},
                       content_type='multipart/form-data').status_code == 403
    assert client.get('/api/consultation/doctors', headers=auth(doc)).status_code == 403
    # patient cannot use doctor or admin endpoints
    assert client.get('/api/doctor/appointments', headers=auth(patient)).status_code == 403
    assert client.get('/api/admin/doctors', headers=auth(patient)).status_code == 403
    assert client.post('/api/admin/doctors/1/approve', headers=auth(patient), json={'checked_on_register': True}).status_code == 403
    # no token at all
    assert client.get('/api/admin/doctors').status_code == 401


def test_admin_approval_workflow(client, app):
    reg_doctor(client)
    admin = make_admin(app)
    pend = client.get('/api/admin/doctors?status=pending', headers=auth(admin)).get_json()['doctors']
    assert len(pend) == 1 and pend[0]['hpcsa_number'] == 'MP0729515'
    uid = pend[0]['id']
    # must affirm the iRegister check
    assert client.post('/api/admin/doctors/%d/approve' % uid, headers=auth(admin), json={}).status_code == 400
    ok = client.post('/api/admin/doctors/%d/approve' % uid, headers=auth(admin), json={'checked_on_register': True, 'notes': 'Active on iRegister'})
    assert ok.status_code == 200 and ok.get_json()['doctor']['verification_status'] == 'approved'

    doc = login(client, 'dr@clinic.test', 'doctor').get_json()['token']   # same token still valid; privileges now granted
    assert client.get('/api/doctor/appointments', headers=auth(doc)).status_code == 200
    # now appears in the directory and can be booked
    patient = register(client).get_json()['token']
    listing = client.get('/api/consultation/doctors', headers=auth(patient)).get_json()['doctors']
    assert any(d['name'] == 'Dr Jane Doe' and d['bookable'] and d['verified'] for d in listing)
    assert all('email' not in d for d in listing)   # doctors' emails are never shown to patients

    # revoke: effect is immediate on the existing token
    rj = client.post('/api/admin/doctors/%d/reject' % uid, headers=auth(admin), json={'reason': 'Registration lapsed'})
    assert rj.status_code == 200
    assert client.get('/api/doctor/appointments', headers=auth(doc)).status_code == 403
    d = Doctor.query.filter_by(user_id=uid).first()
    assert d.available is False


def test_reject_requires_reason_and_blocks_access(client, app):
    reg_doctor(client)
    admin = make_admin(app)
    uid = client.get('/api/admin/doctors', headers=auth(admin)).get_json()['doctors'][0]['id']
    assert client.post('/api/admin/doctors/%d/reject' % uid, headers=auth(admin), json={'reason': ''}).status_code == 400
    assert client.post('/api/admin/doctors/%d/reject' % uid, headers=auth(admin), json={'reason': 'Number not found on iRegister'}).status_code == 200
    doc = login(client, 'dr@clinic.test', 'doctor').get_json()
    assert doc['user']['verification_status'] == 'rejected' and 'iRegister' in doc['user']['verification_notes']
    assert client.get('/api/doctor/appointments', headers=auth(doc['token'])).status_code == 403


def test_disabled_account_loses_access_immediately(client, patient, app):
    u = User.query.filter_by(email='pat@example.com').first(); u.is_active = False; db.session.commit()
    assert client.get('/api/scan/history', headers=auth(patient)).status_code == 401


def test_rejected_doctor_cannot_view_attached_report_image(client, patient, scan_id, doctors):
    from datetime import datetime, timedelta
    from utils.report_share import CONSENT_VERSION
    u = User.query.filter_by(email='portal@clinic.test').first()
    d = datetime.now().date() + timedelta(days=2)
    while d.weekday() > 4:
        d += timedelta(days=1)
    r = client.post('/api/consultation/appointment', headers=auth(patient), json={
        'doctor_id': doctors['portal'], 'type': 'video', 'appointment_date': '%s 09:00' % d, 'scan_id': scan_id,
        'consent': True, 'consent_version': CONSENT_VERSION, 'options': {'include_image': True}})
    assert r.status_code == 201, r.get_json()
    tok = login(client, 'portal@clinic.test', 'doctor', 'Doctor123').get_json()['token']
    assert client.get('/api/scan/results/%s/image' % scan_id, headers=auth(tok)).status_code == 200
    u.verification_status = 'rejected'; db.session.commit()
    assert client.get('/api/scan/results/%s/image' % scan_id, headers=auth(tok)).status_code == 404
