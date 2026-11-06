"""Doctor-side endpoints: own directory profile + appointment requests."""
import re
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

from extensions import db
from models.consultation import Consultation, Doctor
from models.user import User
from routes.consultation import fmt_when, log_event
from utils.email_service import send_template
from utils.permissions import roles_required

doctor_bp = Blueprint('doctor', __name__)
PHONE_RE = re.compile(r'^[0-9+()\- ]{7,20}$')


def _me():
    return db.session.get(User, int(get_jwt_identity()))


def _my_doctor(user):
    """The doctor's directory row (created on demand for accounts that predate it)."""
    d = Doctor.query.filter_by(user_id=user.id).first()
    if not d:
        d = Doctor(name=user.name, specialty='Medical Practitioner', available=True, user_id=user.id,
                   email=None if Doctor.query.filter_by(email=user.email).first() else user.email)
        db.session.add(d)
        db.session.commit()
    return d


@doctor_bp.route('/profile', methods=['GET'])
@roles_required('doctor', allow_unverified_doctor=True)
def get_profile():
    user = _me()
    d = _my_doctor(user)
    return jsonify({'doctor': d.to_private_dict(), 'verification_status': user.verification_status,
                    'listed': d.is_listed}), 200


@doctor_bp.route('/profile', methods=['PUT'])
@roles_required('doctor', allow_unverified_doctor=True)
def update_profile():
    user = _me()
    d = _my_doctor(user)
    data = request.get_json(silent=True) or {}
    errors = {}

    def text(key, label, lo, hi, required=False):
        v = data.get(key)
        if v is None:
            return getattr(d, key)
        v = str(v).strip()
        if (required and len(v) < lo) or len(v) > hi:
            errors[key] = '%s must be %d-%d characters.' % (label, lo, hi) if required else '%s must be at most %d characters.' % (label, hi)
        return v or None

    specialty = text('specialty', 'Specialty', 2, 100, required=True)
    hospital = text('hospital', 'Practice / hospital', 0, 200)
    experience = text('experience', 'Experience', 0, 50)
    bio = text('bio', 'About', 0, 600)
    phone = data.get('phone', d.phone)
    phone = (str(phone).strip() or None) if phone is not None else None
    if phone and not PHONE_RE.match(phone):
        errors['phone'] = 'Enter a valid phone number.'
    if errors:
        return jsonify({'message': next(iter(errors.values())), 'errors': errors}), 400

    d.specialty, d.hospital, d.experience, d.bio, d.phone = specialty, hospital, experience, bio, phone
    if 'available' in data:
        d.available = bool(data['available'])
    db.session.commit()
    return jsonify({'message': 'Profile saved', 'doctor': d.to_private_dict(), 'listed': d.is_listed}), 200


def _appt(c):
    out = c.to_dict()
    out['patient_name'] = c.patient.name if c.patient else None
    out.pop('patient_id', None)
    out.pop('report_scan_id', None)
    # Report attached to this booking (only while the appointment is live and not withdrawn)
    visible = c.report_visible_to_doctor
    out['has_report'] = visible
    out['report_withdrawn'] = c.report_withdrawn_at is not None
    if visible:
        snap = c.snapshot_dict()
        out['report_condition'] = snap.get('results', {}).get('condition')
        out['report_severity'] = snap.get('results', {}).get('severity')
        out['report_has_image'] = bool(c.report_include_image)
    return out


@doctor_bp.route('/appointments', methods=['GET'])
@roles_required('doctor')
def list_appointments():
    d = _my_doctor(_me())
    q = Consultation.query.filter_by(doctor_id=d.id)
    status = request.args.get('status')
    if status in ('pending', 'confirmed', 'completed', 'declined', 'cancelled'):
        q = q.filter_by(status=status)
    rows = q.order_by(Consultation.appointment_date.asc()).all()
    return jsonify({'appointments': [_appt(c) for c in rows]}), 200


def _mine(consultation_id):
    d = _my_doctor(_me())
    c = db.session.get(Consultation, consultation_id)
    return c if c and c.doctor_id == d.id else None


@doctor_bp.route('/appointments/<int:consultation_id>/confirm', methods=['POST'])
@roles_required('doctor')
def confirm(consultation_id):
    c = _mine(consultation_id)
    if not c:
        return jsonify({'message': 'Appointment not found'}), 404
    if c.status != 'pending':
        return jsonify({'message': 'Only pending requests can be confirmed.'}), 400
    if c.appointment_date < datetime.now():
        return jsonify({'message': 'This time has already passed.'}), 400
    c.status, c.responded_at = 'confirmed', datetime.utcnow()
    c.doctor_note = ((request.get_json(silent=True) or {}).get('note') or '').strip()[:255] or None
    log_event(c, 'confirmed', 'doctor')
    db.session.commit()
    send_template('appointment_confirmed', c.patient.email, {'name': c.patient.name, 'doctor_name': c.doctor.name, 'when': fmt_when(c.appointment_date)})
    return jsonify({'appointment': _appt(c)}), 200


@doctor_bp.route('/appointments/<int:consultation_id>/decline', methods=['POST'])
@roles_required('doctor')
def decline(consultation_id):
    c = _mine(consultation_id)
    if not c:
        return jsonify({'message': 'Appointment not found'}), 404
    if c.status not in ('pending', 'confirmed'):
        return jsonify({'message': 'This request can no longer be declined.'}), 400
    c.status, c.responded_at = 'declined', datetime.utcnow()
    c.doctor_note = ((request.get_json(silent=True) or {}).get('reason') or '').strip()[:255] or None
    log_event(c, 'declined', 'doctor')
    db.session.commit()
    send_template('appointment_declined', c.patient.email, {'name': c.patient.name, 'doctor_name': c.doctor.name, 'when': fmt_when(c.appointment_date)})
    return jsonify({'appointment': _appt(c)}), 200


@doctor_bp.route('/appointments/<int:consultation_id>/complete', methods=['POST'])
@roles_required('doctor')
def complete(consultation_id):
    """Mark a CONFIRMED appointment as done. Only the booked doctor, and only once it has started."""
    c = _mine(consultation_id)
    if not c:
        return jsonify({'message': 'Appointment not found'}), 404
    if c.status != 'confirmed':
        return jsonify({'message': 'Only confirmed appointments can be marked completed.'}), 400
    if c.appointment_date > datetime.now():
        return jsonify({'message': 'This appointment has not started yet.', 'code': 'not_started'}), 400
    c.status, c.responded_at = 'completed', datetime.utcnow()
    note = ((request.get_json(silent=True) or {}).get('note') or '').strip()[:255]
    if note:
        c.doctor_note = note
    log_event(c, 'completed', 'doctor')
    db.session.commit()
    # Tell the patient (feedback itself stays in the app, never in the email).
    send_template('appointment_completed', c.patient.email, {'name': c.patient.name, 'doctor_name': c.doctor.name,
                  'when': fmt_when(c.appointment_date), 'has_note': bool(c.doctor_note)})
    return jsonify({'appointment': _appt(c)}), 200


@doctor_bp.route('/appointments/<int:consultation_id>/report', methods=['GET'])
@roles_required('doctor')
def view_report(consultation_id):
    """The report the patient attached to THIS booking. Each open is logged for the patient to see."""
    c = _mine(consultation_id)
    if not c or not c.report_visible_to_doctor:
        return jsonify({'message': 'No report is available for this appointment.'}), 404
    if c.report_opened_at is None:
        c.report_opened_at = datetime.utcnow()
    log_event(c, 'report_opened_by_doctor', 'doctor')
    db.session.commit()
    return jsonify({'report': c.snapshot_dict(), 'appointment': _appt(c)}), 200
