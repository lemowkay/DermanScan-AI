"""Booking an appointment WITH a report attached (this replaces the old standalone referral)."""
from datetime import datetime, timedelta

from extensions import db
from models.consultation import AppointmentEvent, Consultation
from utils.report_share import CONSENT_VERSION
from .conftest import auth, register
from .helpers import book_with_report, doc_token, next_weekday, outbox, text_of
from .test_roles import login


# ------------------------------------------------------------- consent + preview
def test_report_needs_explicit_current_consent(client, patient, scan_id, doctors):
    assert book_with_report(client, patient, doctors['portal'], scan_id, consent=False).status_code == 400
    assert book_with_report(client, patient, doctors['portal'], scan_id, consent='true').status_code == 400
    r = book_with_report(client, patient, doctors['portal'], scan_id, consent_version='old')
    assert r.status_code == 400 and r.get_json()['code'] == 'consent_outdated'
    assert Consultation.query.count() == 0                                    # nothing was booked or shared


def test_preview_lists_what_will_be_attached(client, patient, scan_id):
    r = client.post('/api/consultation/report-preview', headers=auth(patient), json={'scan_id': scan_id, 'options': {'include_image': True}}).get_json()
    by = {s['key']: s for s in r['sections']}
    assert by['identity']['detail'] == 'Pat Patient' and 'email' not in str(by['identity']).lower().replace('your name', '')
    assert by['include_image']['included'] is True and by['include_recommendations']['included'] is False
    assert r['is_demo'] is True and r['consent_version'] == CONSENT_VERSION and 'withdraw' in r['consent_text']
    other = register(client, 'o@o.co').get_json()['token']
    assert client.post('/api/consultation/report-preview', headers=auth(other), json={'scan_id': scan_id}).status_code == 404


def test_cannot_attach_someone_elses_report(client, scan_id, doctors):
    other = register(client, 'o@o.co').get_json()['token']
    assert book_with_report(client, other, doctors['portal'], scan_id).status_code == 404


# ------------------------------------------------------------- the doctor receives an APPOINTMENT with the report
def test_doctor_receives_appointment_with_attached_report(client, app, patient, scan_id, doctors):
    r = book_with_report(client, patient, doctors['portal'], scan_id)
    assert r.status_code == 201
    c = r.get_json()['consultation']
    assert c['status'] == 'pending' and c['has_report'] is True and c['report_scan_id'] == scan_id and c['report_opened_at'] is None

    doc = doc_token(client)
    appts = client.get('/api/doctor/appointments', headers=auth(doc)).get_json()['appointments']
    assert len(appts) == 1 and appts[0]['notes'] == 'itches at night' and appts[0]['patient_name'] == 'Pat Patient'
    assert appts[0]['has_report'] is True and appts[0]['report_condition'] == 'Actinic Keratosis' and appts[0]['report_has_image'] is True
    assert 'referral' not in str(appts[0]).lower()

    rep = client.get('/api/doctor/appointments/%d/report' % c['id'], headers=auth(doc)).get_json()['report']
    assert rep['results']['condition'] == 'Actinic Keratosis' and rep['results']['is_demo'] is True and rep['ai_recommendations']
    assert rep['patient'] == {'name': 'Pat Patient'}                                   # no email shared
    assert client.get('/api/scan/results/%s/image' % scan_id, headers=auth(doc)).status_code == 200

    mine = client.get('/api/consultation/list', headers=auth(patient)).get_json()['consultations'][0]
    assert mine['report_opened_at'] is not None                                        # patient can see it was opened
    events = [e['event'] for e in client.get('/api/consultation/%d/events' % c['id'], headers=auth(patient)).get_json()['events']]
    assert events[:2] == ['booked', 'report_attached'] and 'report_opened_by_doctor' in events


def test_report_is_encrypted_at_rest(client, patient, scan_id, doctors):
    book_with_report(client, patient, doctors['portal'], scan_id)
    raw = db.session.execute(db.text('select report_snapshot from consultations')).scalar()
    assert raw and 'Actinic' not in raw and 'Pat Patient' not in raw


def test_only_selected_items_are_shared(client, patient, scan_id, doctors):
    c = book_with_report(client, patient, doctors['portal'], scan_id, options={'include_image': False, 'include_recommendations': False}).get_json()['consultation']
    doc = doc_token(client)
    rep = client.get('/api/doctor/appointments/%d/report' % c['id'], headers=auth(doc)).get_json()['report']
    assert 'image' not in rep and 'ai_recommendations' not in rep and rep['results']['condition']
    assert client.get('/api/scan/results/%s/image' % scan_id, headers=auth(doc)).status_code == 404


def test_booking_without_a_report_still_works(client, patient, doctors):
    day = next_weekday()
    r = client.post('/api/consultation/appointment', headers=auth(patient), json={'doctor_id': doctors['portal'], 'type': 'chat', 'appointment_date': '%s 10:00' % day})
    assert r.status_code == 201 and r.get_json()['consultation']['has_report'] is False
    doc = doc_token(client)
    cid = r.get_json()['consultation']['id']
    assert client.get('/api/doctor/appointments/%d/report' % cid, headers=auth(doc)).status_code == 404


def test_other_doctor_and_other_patient_cannot_see_the_report(client, app, patient, scan_id, doctors):
    from .test_booking import approved_doctor
    c = book_with_report(client, patient, doctors['portal'], scan_id).get_json()['consultation']
    _, otok, *_ = approved_doctor(client, app, email='dr2@clinic.test', hpcsa='MP0999999')
    assert client.get('/api/doctor/appointments/%d/report' % c['id'], headers=auth(otok)).status_code == 404
    assert client.get('/api/scan/results/%s/image' % scan_id, headers=auth(otok)).status_code == 404
    other = register(client, 'o@o.co').get_json()['token']
    assert client.get('/api/consultation/%d/events' % c['id'], headers=auth(other)).status_code == 404
    assert client.get('/api/scan/results/%s/image' % scan_id, headers=auth(other)).status_code == 404
    assert client.get('/api/doctor/appointments/%d/report' % c['id'], headers=auth(patient)).status_code == 403


# ------------------------------------------------------------- access follows the appointment
def test_declined_or_cancelled_appointment_revokes_report_access(client, patient, scan_id, doctors):
    doc = doc_token(client)
    a = book_with_report(client, patient, doctors['portal'], scan_id, '09:00').get_json()['consultation']['id']
    client.post('/api/doctor/appointments/%d/decline' % a, headers=auth(doc), json={'reason': 'On leave'})
    assert client.get('/api/doctor/appointments/%d/report' % a, headers=auth(doc)).status_code == 404
    assert client.get('/api/scan/results/%s/image' % scan_id, headers=auth(doc)).status_code == 404
    assert client.get('/api/doctor/appointments', headers=auth(doc)).get_json()['appointments'][0]['has_report'] is False
    b = book_with_report(client, patient, doctors['portal'], scan_id, '09:30').get_json()['consultation']['id']
    assert client.get('/api/scan/results/%s/image' % scan_id, headers=auth(doc)).status_code == 200
    client.post('/api/consultation/%d/cancel' % b, headers=auth(patient))
    assert client.get('/api/scan/results/%s/image' % scan_id, headers=auth(doc)).status_code == 404


def test_confirmed_and_completed_keep_access_and_reschedule_keeps_the_report(client, patient, scan_id, doctors):
    doc = doc_token(client)
    cid = book_with_report(client, patient, doctors['portal'], scan_id).get_json()['consultation']['id']
    client.post('/api/doctor/appointments/%d/confirm' % cid, headers=auth(doc), json={})
    assert client.get('/api/doctor/appointments/%d/report' % cid, headers=auth(doc)).status_code == 200
    r = client.post('/api/consultation/%d/reschedule' % cid, headers=auth(patient), json={'appointment_date': '%s 11:00' % next_weekday()})
    assert r.status_code == 200 and r.get_json()['consultation']['has_report'] is True
    c = db.session.get(Consultation, cid); c.status = 'confirmed'; c.appointment_date = datetime.now() - timedelta(minutes=5); db.session.commit()
    client.post('/api/doctor/appointments/%d/complete' % cid, headers=auth(doc), json={'note': 'Follow up'})
    assert client.get('/api/doctor/appointments/%d/report' % cid, headers=auth(doc)).status_code == 200


def test_patient_can_withdraw_the_report_but_keep_the_appointment(client, patient, scan_id, doctors):
    doc = doc_token(client)
    cid = book_with_report(client, patient, doctors['portal'], scan_id).get_json()['consultation']['id']
    r = client.post('/api/consultation/%d/withdraw-report' % cid, headers=auth(patient))
    assert r.status_code == 200 and r.get_json()['consultation']['has_report'] is False and r.get_json()['consultation']['report_withdrawn'] is True
    assert db.session.get(Consultation, cid).report_snapshot is None                         # content erased, not just hidden
    assert client.get('/api/doctor/appointments/%d/report' % cid, headers=auth(doc)).status_code == 404
    assert client.get('/api/scan/results/%s/image' % scan_id, headers=auth(doc)).status_code == 404
    appt = client.get('/api/doctor/appointments', headers=auth(doc)).get_json()['appointments'][0]
    assert appt['status'] == 'pending' and appt['has_report'] is False and appt['report_withdrawn'] is True
    assert client.post('/api/consultation/%d/withdraw-report' % cid, headers=auth(patient)).status_code == 400
    assert 'report_withdrawn' in [e.event for e in AppointmentEvent.query.filter_by(consultation_id=cid)]
    other = register(client, 'o@o.co').get_json()['token']
    assert client.post('/api/consultation/%d/withdraw-report' % cid, headers=auth(other)).status_code == 404


# ------------------------------------------------------------- retries, filters, slots
def test_retry_with_same_key_is_safe(client, app, patient, scan_id, doctors):
    k = {'idempotency_key': 'retry-1'}
    first = book_with_report(client, patient, doctors['portal'], scan_id, **k)
    again = book_with_report(client, patient, doctors['portal'], scan_id, **k)
    assert first.status_code == 201 and again.status_code == 200
    assert first.get_json()['consultation']['id'] == again.get_json()['consultation']['id'] and Consultation.query.count() == 1
    assert len(outbox(app)) == 2                                                             # patient + doctor, once


def test_slot_rules_still_apply_with_a_report(client, patient, scan_id, doctors):
    other = register(client, 'o@o.co').get_json()['token']
    assert book_with_report(client, other, doctors['portal'], scan_id).status_code == 404    # not their scan
    assert book_with_report(client, patient, doctors['portal'], scan_id, '10:15').status_code == 409
    assert book_with_report(client, patient, doctors['portal'], scan_id, '09:00').status_code == 201
    r = book_with_report(client, register(client, 'p2@x.co').get_json()['token'], doctors['portal'], scan_id, '09:00')
    assert r.status_code in (404, 409)
    assert Consultation.query.count() == 1


def test_list_by_report(client, patient, scan_id, doctors):
    book_with_report(client, patient, doctors['portal'], scan_id, '09:00')
    day = next_weekday()
    client.post('/api/consultation/appointment', headers=auth(patient), json={'doctor_id': doctors['portal'], 'appointment_date': '%s 10:00' % day})
    assert len(client.get('/api/consultation/list', headers=auth(patient)).get_json()['consultations']) == 2
    only = client.get('/api/consultation/list?scan_id=%s' % scan_id, headers=auth(patient)).get_json()['consultations']
    assert len(only) == 1 and only[0]['report_scan_id'] == scan_id


def test_old_referral_endpoints_are_gone(client, patient):
    assert client.post('/api/referral', headers=auth(patient), json={}).status_code == 404
    assert client.get('/api/referral/inbox', headers=auth(patient)).status_code == 404


def test_admin_analytics_counts_reports_shared(client, app, patient, scan_id, doctors):
    from .test_roles import make_admin
    book_with_report(client, patient, doctors['portal'], scan_id)
    admin = make_admin(app)
    assert client.get('/api/admin/analytics', headers=auth(admin)).get_json()['total_reports_shared'] == 1
