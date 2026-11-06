import os
import uuid
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.consultation import Consultation, Doctor
from models.scan import ScanRecord
from models.user import User
from utils.file_validation import FileValidationError, validate_image_upload, MAX_FILE_BYTES
from utils.model import describe, get_model
from utils.permissions import roles_required

scan_bp = Blueprint('scan', __name__)


def scan_payload(scan):
    data = scan.to_dict()
    data['description'] = describe(scan.disease_name)
    return data


def _image_file_path(scan):
    """Resolve the stored file inside UPLOAD_FOLDER only (basename guards
    against path traversal and also handles older rows that stored a full path)."""
    if not scan.image_path:
        return None
    path = os.path.join(current_app.config['UPLOAD_FOLDER'], os.path.basename(scan.image_path))
    return path if os.path.isfile(path) else None


def can_view_scan_image(user, scan):
    if scan.user_id == user.id:
        return True
    if user.role == 'doctor' and user.verification_status == 'approved' and user.is_active:
        doctor = Doctor.query.filter_by(user_id=user.id).first()
        if doctor:
            return Consultation.query.filter(
                Consultation.scan_id == scan.id, Consultation.doctor_id == doctor.id,
                Consultation.report_include_image.is_(True), Consultation.report_withdrawn_at.is_(None),
                Consultation.report_snapshot.isnot(None),
                Consultation.status.in_(('pending', 'confirmed', 'completed'))).first() is not None
    return False


@scan_bp.route('/upload', methods=['POST'])
@roles_required('user')
def upload_scan():
    user_id = int(get_jwt_identity())

    files = [f for f in request.files.getlist('image') if f is not None]
    if not files:
        return jsonify({'message': 'No image file provided', 'code': 'no_file'}), 400
    if len(files) > 1:
        return jsonify({'message': 'Please upload one image at a time.', 'code': 'too_many_files'}), 400

    try:
        image = validate_image_upload(files[0], MAX_FILE_BYTES)
    except FileValidationError as exc:
        return jsonify({'message': exc.message, 'code': exc.code}), exc.status

    # Randomised server-side name: the client-supplied name is never used.
    upload_folder = current_app.config['UPLOAD_FOLDER']
    os.makedirs(upload_folder, exist_ok=True)
    filename = '%s.%s' % (uuid.uuid4().hex, image.ext)
    filepath = os.path.join(upload_folder, filename)

    try:
        with open(filepath, 'xb') as fh:
            fh.write(image.data)
        result = get_model(current_app.config.get('MODEL_PATH')).predict(image.data)
        scan = ScanRecord(
            scan_id='SCN-' + uuid.uuid4().hex[:8].upper(),
            user_id=user_id,
            image_path=filename,
            disease_name=result['disease_name'],
            confidence_score=result['confidence_score'],
            severity=result['severity'],
            symptoms=result['symptoms'],
            recommendations=result['recommendations'],
            model_version=result['model_version'],
            status='completed',
        )
        db.session.add(scan)
        db.session.commit()
    except Exception:
        db.session.rollback()
        if os.path.exists(filepath):
            os.remove(filepath)  # never keep a file that has no record
        current_app.logger.exception('Scan upload failed')
        return jsonify({'message': 'We could not analyse this image. Please try again.', 'code': 'analysis_failed'}), 500

    return jsonify({'message': 'Scan completed successfully', 'scan': scan_payload(scan)}), 201


@scan_bp.route('/results/<scan_id>', methods=['GET'])
@roles_required('user')
def get_results(scan_id):
    user_id = int(get_jwt_identity())
    scan = ScanRecord.query.filter_by(scan_id=scan_id).first()
    if not scan or scan.user_id != user_id:
        # Same answer for "missing" and "someone else's" - no record probing.
        return jsonify({'message': 'Scan not found'}), 404
    return jsonify({'scan': scan_payload(scan)}), 200


@scan_bp.route('/results/<scan_id>/image', methods=['GET'])
@jwt_required()
def get_scan_image(scan_id):
    """Authenticated image delivery - images are never served from a public URL."""
    user = db.session.get(User, int(get_jwt_identity()))
    scan = ScanRecord.query.filter_by(scan_id=scan_id).first()
    if not user or not scan or not can_view_scan_image(user, scan):
        return jsonify({'message': 'Image not found'}), 404
    path = _image_file_path(scan)
    if not path:
        return jsonify({'message': 'Image not found'}), 404
    resp = send_file(path, conditional=False)
    resp.headers['Cache-Control'] = 'private, no-store'
    resp.headers['Content-Disposition'] = 'inline'
    return resp


@scan_bp.route('/history', methods=['GET'])
@roles_required('user')
def get_history():
    user_id = int(get_jwt_identity())
    page = max(request.args.get('page', 1, type=int), 1)
    per_page = min(max(request.args.get('per_page', 10, type=int), 1), 50)
    search = request.args.get('search', '').strip()
    date_from = request.args.get('date_from', '').strip()

    query = ScanRecord.query.filter_by(user_id=user_id)
    if search:
        like = '%' + search + '%'
        query = query.filter(db.or_(ScanRecord.disease_name.ilike(like), ScanRecord.scan_id.ilike(like)))
    if date_from:
        try:
            query = query.filter(ScanRecord.created_at >= datetime.strptime(date_from, '%Y-%m-%d'))
        except ValueError:
            return jsonify({'message': 'date_from must be YYYY-MM-DD'}), 400

    scans = query.order_by(ScanRecord.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        'scans': [s.to_dict() for s in scans.items],
        'total': scans.total,
        'pages': scans.pages,
        'current_page': page,
    }), 200


@scan_bp.route('/<int:scan_id>', methods=['GET'])
@roles_required('user')
def get_scan_by_id(scan_id):
    user_id = int(get_jwt_identity())
    scan = db.session.get(ScanRecord, scan_id)
    if not scan or scan.user_id != user_id:
        return jsonify({'message': 'Scan not found'}), 404
    return jsonify({'scan': scan_payload(scan)}), 200
