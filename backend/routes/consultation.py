import json
import os
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

from extensions import db
from models.consultation import MAX_RESCHEDULES, AppointmentEvent, Consultation, Doctor
from models.scan import ScanRecord
from models.user import User
from utils.report_share import CONSENT_TEXT, CONSENT_VERSION, build_share
from utils.email_service import mail_configured, send_template
from utils.permissions import roles_required

consultation_bp = Blueprint('consultation', __name__)

# Booking rules (times are the server's local time = the clinic's time zone).
WORK_START_HOUR = int(os.getenv('APPOINTMENT_START_HOUR', '8'))
WORK_END_HOUR = int(os.getenv('APPOINTMENT_END_HOUR', '17'))
SLOT_MINUTES = int(os.getenv('APPOINTMENT_SLOT_MINUTES', '30'))
WORKDAYS = (0, 1, 2, 3, 4)                     # Monday-Friday
MAX_DAYS_AHEAD = 90
ACTIVE = ('pending', 'confirmed')              # statuses that occupy a slot


def log_event(c, event, role='system', detail=None):
    db.session.add(AppointmentEvent(consultation_id=c.id, event=event, actor_role=role, detail=(detail or '')[:255]))


def fmt_when(dt):
    return dt.strftime('%a %d %b %Y, %H:%M')


def day_slots(doctor, day):
    """Free, bookable start times for one doctor on one date."""
    if day.weekday() not in WORKDAYS or day > (datetime.now() + timedelta(days=MAX_DAYS_AHEAD)).date():
        return []
    start = datetime.combine(day, datetime.min.time())
    taken = {c.appointment_date for c in Consultation.query.filter(
        Consultation.doctor_id == doctor.id, Consultation.status.in_(ACTIVE),
        Consultation.appointment_date >= start, Consultation.appointment_date < start + timedelta(days=1)).all()}
    now = datetime.now()
    out, t = [], start.replace(hour=WORK_START_HOUR)
    end = start.replace(hour=WORK_END_HOUR)
    while t + timedelta(minutes=SLOT_MINUTES) <= end:
        if t > now and t not in taken:
            out.append(t)
        t += timedelta(minutes=SLOT_MINUTES)
    return out


@consultation_bp.route('/doctors', methods=['GET'])
@roles_required('user')
def get_doctors():
    """Directory: only doctors patients may see (verified, or directory-only entries)."""
    doctors = [d for d in Doctor.query.order_by(Doctor.name).all() if d.is_listed]
    return jsonify({'doctors': [d.to_dict() for d in doctors]}), 200


@consultation_bp.route('/doctors/<int:doctor_id>/slots', methods=['GET'])
@roles_required('user')
def get_slots(doctor_id):
    doctor = db.session.get(Doctor, doctor_id)
    if not doctor or not doctor.is_listed:
        return jsonify({'message': 'Doctor not found'}), 404
    try:
        day = datetime.strptime(request.args.get('date', ''), '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'message': 'date must be YYYY-MM-DD'}), 400
    return jsonify({
        'doctor_id': doctor.id, 'date': day.isoformat(), 'bookable': doctor.bookable,
        'slots': [t.strftime('%H:%M') for t in day_slots(doctor, day)] if doctor.bookable else [],
    }), 200


@consultation_bp.route('/report-preview', methods=['POST'])
@roles_required('user')
def report_preview():
    """Server-built summary of exactly what will be attached (shown before the patient consents)."""
    user = db.session.get(User, int(get_jwt_identity()))
    data = request.get_json(silent=True) or {}
    scan = ScanRecord.query.filter_by(scan_id=data.get('scan_id') or '').first()
    if not scan or scan.user_id != user.id:
        return jsonify({'message': 'Scan not found'}), 404
    _, sections, flags = build_share(scan, user, data.get('options'))
    return jsonify({'sections': sections, 'is_demo': flags['is_demo'],
                    'consent_text': CONSENT_TEXT, 'consent_version': CONSENT_VERSION}), 200


@consultation_bp.route('/appointment', methods=['POST'])
@roles_required('user')
def create_appointment():
    """Book an appointment. Optionally attach one of the patient's reports (scan_id + explicit consent)."""
    user = db.session.get(User, int(get_jwt_identity()))
    data = request.get_json(silent=True) or {}

    # Safe retry: the same key from the same patient returns the booking already made.
    key = (data.get('idempotency_key') or '').strip()[:64] or None
    if key:
        existing = Consultation.query.filter_by(idempotency_key=key, patient_id=user.id).first()
        if existing:
            return jsonify({'message': 'Appointment already requested', 'consultation': existing.to_dict(), 'email': 'queued' if mail_configured() else 'not_configured'}), 200

    doctor_id = data.get('doctor_id')
    appointment_type = data.get('type', 'video')
    appointment_date = data.get('appointment_date')
    notes = data.get('notes', '')

    if not doctor_id or not appointment_date:
        return jsonify({'message': 'Doctor and appointment date are required'}), 400
    doctor = db.session.get(Doctor, int(doctor_id)) if str(doctor_id).isdigit() else None
    if not doctor or not doctor.is_listed:
        return jsonify({'message': 'Doctor not found'}), 404
    if not doctor.bookable:
        return jsonify({'message': 'This doctor does not take online bookings yet.', 'code': 'not_bookable'}), 400
    try:
        when = datetime.strptime(appointment_date, '%Y-%m-%d %H:%M')
    except (TypeError, ValueError):
        return jsonify({'message': 'Invalid appointment date/time.'}), 400
    if appointment_type not in ('video', 'chat', 'in-person'):
        return jsonify({'message': 'Invalid consultation type.'}), 400

    # Optional report attachment: requires ownership + explicit, current consent.
    snapshot = flags = scan = None
    if data.get('scan_id'):
        scan = ScanRecord.query.filter_by(scan_id=data['scan_id']).first()
        if not scan or scan.user_id != user.id:
            return jsonify({'message': 'Report not found'}), 404
        if data.get('consent') is not True:
            return jsonify({'message': 'You must give consent before your report can be shared with the doctor.', 'code': 'consent_required'}), 400
        if data.get('consent_version') != CONSENT_VERSION:
            return jsonify({'message': 'The consent wording has changed. Please review and confirm again.', 'code': 'consent_outdated'}), 400
        snapshot, _, flags = build_share(scan, user, data.get('options'))

    if when not in day_slots(doctor, when.date()):
        return jsonify({'message': 'That time slot is not available. Please pick another.', 'code': 'slot_unavailable'}), 409

    consultation = Consultation(patient_id=user.id, doctor_id=doctor.id, type=appointment_type, status='pending',
                                notes=(notes or '')[:2000], appointment_date=when, idempotency_key=key)
    if scan is not None:
        consultation.scan_id = scan.id
        consultation.report_snapshot = json.dumps(snapshot)
        consultation.report_include_image = flags['include_image']
        consultation.report_consent_at = datetime.utcnow()
        consultation.report_consent_version = CONSENT_VERSION
    db.session.add(consultation)
    db.session.flush()
    
    first = Consultation.query.filter(Consultation.doctor_id == doctor.id, Consultation.appointment_date == when,
                                      Consultation.status.in_(ACTIVE)).order_by(Consultation.id).first()
    if first.id != consultation.id:
        db.session.rollback()
        return jsonify({'message': 'Someone just booked that slot. Please pick another.', 'code': 'slot_unavailable'}), 409
    log_event(consultation, 'booked', 'user', 'Appointment requested')
    if scan is not None:
        log_event(consultation, 'report_attached', 'user', 'Consent version %s' % CONSENT_VERSION)
    db.session.commit()

  
    has_report = scan is not None
    send_template('appointment_requested', user.email, {'name': user.name, 'doctor_name': doctor.name, 'when': fmt_when(when), 'has_report': has_report})
    if doctor.account:
        send_template('appointment_new', doctor.account.email, {'name': doctor.name, 'when': fmt_when(when), 'has_report': has_report})
    return jsonify({'message': 'Appointment requested', 'consultation': consultation.to_dict(),
                    'email': 'queued' if mail_configured() else 'not_configured'}), 201


@consultation_bp.route('/list', methods=['GET'])
@roles_required('user')
def get_consultations():
    user_id = int(get_jwt_identity())
    q = Consultation.query.filter_by(patient_id=user_id)
    scan_ref = request.args.get('scan_id')
    if scan_ref:
        q = q.join(ScanRecord, Consultation.scan_id == ScanRecord.id).filter(ScanRecord.scan_id == scan_ref)
    rows = q.order_by(Consultation.appointment_date.desc()).all()
    return jsonify({'consultations': [c.to_dict() for c in rows]}), 200


@consultation_bp.route('/<int:consultation_id>/cancel', methods=['POST'])
@roles_required('user')
def cancel_appointment(consultation_id):
    user = db.session.get(User, int(get_jwt_identity()))
    c = db.session.get(Consultation, consultation_id)
    if not c or c.patient_id != user.id:
        return jsonify({'message': 'Appointment not found'}), 404
    if c.status not in ACTIVE:
        return jsonify({'message': 'This appointment can no longer be cancelled.'}), 400
    c.status, c.responded_at = 'cancelled', datetime.utcnow()
    log_event(c, 'cancelled', 'user')
    db.session.commit()
    if c.doctor and c.doctor.account:
        send_template('appointment_cancelled', c.doctor.account.email, {'name': c.doctor.name, 'when': fmt_when(c.appointment_date)})
    return jsonify({'message': 'Appointment cancelled', 'consultation': c.to_dict()}), 200


@consultation_bp.route('/<int:consultation_id>/withdraw-report', methods=['POST'])
@roles_required('user')
def withdraw_report(consultation_id):
    """Take the attached report away from the doctor (POPIA: withdraw consent). The appointment stays."""
    user = db.session.get(User, int(get_jwt_identity()))
    c = db.session.get(Consultation, consultation_id)
    if not c or c.patient_id != user.id:
        return jsonify({'message': 'Appointment not found'}), 404
    if not c.has_report:
        return jsonify({'message': 'There is no attached report to withdraw.'}), 400
    c.report_snapshot, c.report_include_image, c.report_withdrawn_at = None, False, datetime.utcnow()
    log_event(c, 'report_withdrawn', 'user', 'Patient withdrew consent')
    db.session.commit()
    return jsonify({'message': 'Report withdrawn. The doctor can no longer see it.', 'consultation': c.to_dict()}), 200


@consultation_bp.route('/<int:consultation_id>/events', methods=['GET'])
@roles_required('user')
def appointment_events(consultation_id):
    """The patient's own audit trail: who did what with this appointment/report."""
    user = db.session.get(User, int(get_jwt_identity()))
    c = db.session.get(Consultation, consultation_id)
    if not c or c.patient_id != user.id:
        return jsonify({'message': 'Appointment not found'}), 404
    return jsonify({'events': [e.to_dict() for e in c.events]}), 200


@consultation_bp.route('/<int:consultation_id>/reschedule', methods=['POST'])
@roles_required('user')
def reschedule_appointment(consultation_id):
    """Move an appointment to another free slot. It goes back to PENDING: the doctor
    agreed to the old time, so they must confirm the new one."""
    user = db.session.get(User, int(get_jwt_identity()))
    c = db.session.get(Consultation, consultation_id)
    if not c or c.patient_id != user.id:
        return jsonify({'message': 'Appointment not found'}), 404
    if not c.can_change:
        return jsonify({'message': 'This appointment can no longer be changed.'}), 400
    if (c.reschedule_count or 0) >= MAX_RESCHEDULES:
        return jsonify({'message': 'This appointment has been rescheduled %d times already. Please cancel and book again.' % MAX_RESCHEDULES,
                        'code': 'reschedule_limit'}), 400
    doctor = c.doctor
    if not doctor or not doctor.bookable:
        return jsonify({'message': 'This doctor is not taking online bookings right now.', 'code': 'not_bookable'}), 400
    try:
        when = datetime.strptime((request.get_json(silent=True) or {}).get('appointment_date', ''), '%Y-%m-%d %H:%M')
    except (TypeError, ValueError):
        return jsonify({'message': 'Invalid appointment date/time.'}), 400
    if when == c.appointment_date:
        return jsonify({'message': 'That is your current time. Please choose a different slot.'}), 400
    if when not in day_slots(doctor, when.date()):
        return jsonify({'message': 'That time slot is not available. Please pick another.', 'code': 'slot_unavailable'}), 409

    old = c.appointment_date
    c.appointment_date, c.status = when, 'pending'
    c.reschedule_count = (c.reschedule_count or 0) + 1
    c.reminder_sent_at, c.doctor_note, c.responded_at = None, None, None
    db.session.flush()
    log_event(c, 'rescheduled', 'user', '%s -> %s' % (fmt_when(old), fmt_when(when)))
    first = Consultation.query.filter(Consultation.doctor_id == doctor.id, Consultation.appointment_date == when,
                                      Consultation.status.in_(ACTIVE)).order_by(Consultation.id).first()
    if first.id != c.id:                       # lost a race for the slot
        db.session.rollback()
        return jsonify({'message': 'Someone just booked that slot. Please pick another.', 'code': 'slot_unavailable'}), 409
    db.session.commit()

    send_template('appointment_requested', user.email, {'name': user.name, 'doctor_name': doctor.name, 'when': fmt_when(when)})
    if doctor.account:
        send_template('appointment_rescheduled', doctor.account.email, {'name': doctor.name, 'when': fmt_when(when), 'old_when': fmt_when(old)})
    return jsonify({'message': 'Appointment rescheduled. It needs the doctor to confirm the new time.', 'consultation': c.to_dict()}), 200


@consultation_bp.route('/message', methods=['POST'])
@roles_required('user')
def send_message():
    data = request.get_json(silent=True) or {}
    return jsonify({'message': 'Message sent successfully'}), 200
