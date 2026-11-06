from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.scan import ScanRecord
from models.consultation import Consultation, Doctor
from utils.permissions import roles_required, current_user
from utils.hpcsa import IREGISTER_URL
from flask import request
from utils.email_service import send_template
from datetime import datetime

admin_bp = Blueprint('admin', __name__)

admin_required = roles_required('admin')

@admin_bp.route('/users', methods=['GET'])
@admin_required
def get_users():
    users = User.query.order_by(User.created_at.desc()).all()
    out = []
    for u in users:
        d = u.to_dict()
        d['scan_count'] = len(u.scans)
        out.append(d)
    return jsonify({'users': out, 'total': len(out)}), 200

@admin_bp.route('/analytics', methods=['GET'])
@admin_required
def get_analytics():
    total_users = User.query.count()
    total_scans = ScanRecord.query.count()
    total_consultations = Consultation.query.count()
    total_reports_shared = Consultation.query.filter(Consultation.report_snapshot.isnot(None)).count()
    recent_scans = ScanRecord.query.order_by(ScanRecord.created_at.desc()).limit(5).all()

    return jsonify({
        'total_users': total_users,
        'total_scans': total_scans,
        'total_consultations': total_consultations,
        'total_reports_shared': total_reports_shared,
        'recent_scans': [s.to_dict() for s in recent_scans]
    }), 200

@admin_bp.route('/disease-trends', methods=['GET'])
@admin_required
def get_disease_trends():
    from sqlalchemy import func
    trends = db.session.query(
        ScanRecord.disease_name,
        func.count(ScanRecord.id).label('count')
    ).group_by(ScanRecord.disease_name).order_by(func.count(ScanRecord.id).desc()).all()

    return jsonify({
        'trends': [{'disease': t.disease_name, 'count': t.count} for t in trends]
    }), 200

@admin_bp.route('/consultations', methods=['GET'])
@admin_required
def get_admin_consultations():
    consultations = Consultation.query.order_by(Consultation.created_at.desc()).limit(20).all()
    out = []
    for c in consultations:
        d = c.to_dict()
        d['patient_name'] = c.patient.name if c.patient else None
        d['doctor_name'] = c.doctor.name if c.doctor else None
        out.append(d)
    return jsonify({'consultations': out}), 200

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    import os
    from flask import current_app
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404
    if user.id == int(get_jwt_identity()) or user.role == 'admin':
        return jsonify({'message': 'Admin accounts cannot be deleted here.'}), 400
    files = [s.image_path for s in user.scans if s.image_path]
    from models.consultation import Doctor
    Doctor.query.filter_by(user_id=user.id).update({'user_id': None})
    db.session.delete(user)
    db.session.commit()
    for name in files:  # remove the user's images too (right to erasure)
        try:
            os.remove(os.path.join(current_app.config['UPLOAD_FOLDER'], os.path.basename(name)))
        except OSError:
            pass
    return jsonify({'message': 'User deleted successfully'}), 200


# ----------------------- doctor verification (admin only) -----------------------

def _doctor_row(u):
    d = u.to_dict()
    d['has_profile'] = Doctor.query.filter_by(user_id=u.id).first() is not None
    return d


@admin_bp.route('/doctors', methods=['GET'])
@admin_required
def list_doctor_accounts():
    status = request.args.get('status')
    q = User.query.filter_by(role='doctor')
    if status in ('pending', 'approved', 'rejected'):
        q = q.filter_by(verification_status=status)
    users = q.order_by(User.created_at.desc()).all()
    return jsonify({'doctors': [_doctor_row(u) for u in users], 'iregister_url': IREGISTER_URL}), 200


def _get_doctor_user(user_id):
    u = db.session.get(User, user_id)
    return u if u and u.role == 'doctor' else None


@admin_bp.route('/doctors/<int:user_id>/approve', methods=['POST'])
@admin_required
def approve_doctor(user_id):
    u = _get_doctor_user(user_id)
    if not u:
        return jsonify({'message': 'Doctor account not found'}), 404
    data = request.get_json(silent=True) or {}
    # The admin must affirm they checked the HPCSA register themselves.
    if data.get('checked_on_register') is not True:
        return jsonify({'message': 'Confirm that you verified this HPCSA number on the HPCSA iRegister before approving.'}), 400
    if not u.hpcsa_number:
        return jsonify({'message': 'This account has no HPCSA number and cannot be approved.'}), 400
    u.verification_status = 'approved'
    u.verified_at = datetime.utcnow()
    u.verified_by = current_user().id
    u.verification_notes = (data.get('notes') or '').strip()[:255] or None
    doctor = Doctor.query.filter_by(user_id=u.id).first()
    if not doctor:   # directory profile used by the patient booking picker
        doctor = Doctor(name=u.name, specialty='Medical Practitioner', email=u.email, available=True, user_id=u.id)
        db.session.add(doctor)
    doctor.available = True
    db.session.commit()
    send_template('doctor_approved', u.email, {'name': u.name})
    return jsonify({'message': 'Doctor approved', 'doctor': _doctor_row(u)}), 200


@admin_bp.route('/doctors/<int:user_id>/reject', methods=['POST'])
@admin_required
def reject_doctor(user_id):
    """Rejects a pending doctor OR revokes an approved one. Takes effect on the
    doctor's very next request (permissions are read from the DB every time)."""
    u = _get_doctor_user(user_id)
    if not u:
        return jsonify({'message': 'Doctor account not found'}), 404
    reason = ((request.get_json(silent=True) or {}).get('reason') or '').strip()
    if len(reason) < 3:
        return jsonify({'message': 'Please give a reason (it is shown to the doctor).'}), 400
    u.verification_status = 'rejected'
    u.verified_at = datetime.utcnow()
    u.verified_by = current_user().id
    u.verification_notes = reason[:255]
    doctor = Doctor.query.filter_by(user_id=u.id).first()
    if doctor:
        doctor.available = False
    db.session.commit()
    send_template('doctor_rejected', u.email, {'name': u.name})
    return jsonify({'message': 'Doctor rejected', 'doctor': _doctor_row(u)}), 200


@admin_bp.route('/email-log', methods=['GET'])
@admin_required
def email_log():
    """Delivery outcomes only (no message bodies are ever stored)."""
    from models.email_log import EmailLog
    rows = EmailLog.query.order_by(EmailLog.created_at.desc()).limit(100).all()
    return jsonify({'emails': [r.to_dict() for r in rows]}), 200
