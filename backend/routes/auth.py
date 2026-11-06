
import re
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

from extensions import db
from models.user import User
from models.consultation import Doctor
from utils import ratelimit
from utils.email_service import mail_configured, send_template
from utils.hpcsa import (
    get_verifier,
    is_valid_hpcsa_format,
    is_valid_practice_number,
    normalize_hpcsa
)

auth_bp = Blueprint('auth', __name__)

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$')
LOGIN_LIMIT, LOGIN_WINDOW = 8, 15 * 60
_DUMMY_HASH = generate_password_hash('dummy-password-for-timing')

# Public registration: Admin accounts cannot self-register.
SELF_REGISTER_ROLES = ('user', 'doctor')

# Login: Existing Admin accounts can sign in.
LOGIN_ROLES = ('user', 'doctor', 'admin')

ROLE_LABEL = {
    'user': 'patient',
    'doctor': 'doctor',
    'admin': 'administrator'
}


def _json():
    return request.get_json(silent=True) or {}


def password_problem(password):
    if not isinstance(password, str) or len(password) < 8:
        return 'Password must be at least 8 characters long.'
    if len(password) > 128:
        return 'Password must be 128 characters or fewer.'
    if not re.search(r'[A-Za-z]', password) or not re.search(r'\d', password):
        return 'Password must contain at least one letter and one number.'
    return None


def _token_serializer():
    return URLSafeTimedSerializer(
        current_app.config['SECRET_KEY'],
        salt='password-reset'
    )


@auth_bp.route('/register', methods=['POST'])
def register():
    data = _json()

    role = data.get('role', 'user')
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')
    confirm = data.get('confirm_password')

    errors = {}

    if role not in SELF_REGISTER_ROLES:
        return jsonify({
            'message': 'Invalid account type.',
            'errors': {
                'role': 'Choose Patient or Doctor.'
            }
        }), 400

    if len(name) < 2 or len(name) > 100:
        errors['name'] = 'Please enter your full name (2-100 characters).'

    if not EMAIL_RE.match(email) or len(email) > 120:
        errors['email'] = 'Please enter a valid email address.'

    problem = password_problem(password)
    if problem:
        errors['password'] = problem

    if not isinstance(confirm, str) or confirm != password:
        errors['confirm_password'] = 'Passwords do not match.'

    if data.get('accepted_terms') is not True:
        errors['accepted_terms'] = (
            'You must accept the Terms of Service and Privacy Policy to register.'
        )

    hpcsa, practice, lookup = None, None, None

    if role == 'doctor':
        hpcsa = normalize_hpcsa(data.get('hpcsa_number'))
        practice = (data.get('practice_number') or '').strip() or None

        if not hpcsa:
            errors['hpcsa_number'] = (
                'HPCSA registration number is required for doctors.'
            )
        elif not is_valid_hpcsa_format(hpcsa):
            errors['hpcsa_number'] = (
                'Enter a valid HPCSA number, e.g. MP 0123456.'
            )

        if practice and not is_valid_practice_number(practice):
            errors['practice_number'] = (
                'Practice number may only contain letters, numbers, spaces, - and /.'
            )

    if errors:
        return jsonify({
            'message': next(iter(errors.values())),
            'errors': errors
        }), 400

    if User.query.filter_by(email=email).first():
        return jsonify({
            'message': 'An account with this email already exists. Try signing in.',
            'errors': {
                'email': 'This email is already registered.'
            }
        }), 409

    verification_status = 'not_required'
    verification_notes = None

    if role == 'doctor':
        if User.query.filter_by(hpcsa_number=hpcsa).first():
            return jsonify({
                'message': 'This HPCSA number is already registered. If this is a mistake, please contact support.',
                'errors': {
                    'hpcsa_number': 'This HPCSA number is already registered.'
                }
            }), 409

        lookup = get_verifier().lookup(hpcsa, name)

        if lookup.status == 'not_found':
            return jsonify({
                'message': 'We could not find this HPCSA registration number. Please check it and try again.',
                'errors': {
                    'hpcsa_number': 'HPCSA number not found.'
                }
            }), 400

        verification_status = 'pending'

    user = User(
        name=name,
        email=email,
        role=role,
        terms_accepted_at=datetime.utcnow(),
        verification_status=verification_status,
        hpcsa_number=hpcsa,
        practice_number=practice,
        verification_notes=verification_notes
    )

    user.set_password(password)

    db.session.add(user)
    db.session.flush()

    if role == 'doctor':
        taken = Doctor.query.filter_by(email=email).first() is not None

        db.session.add(
            Doctor(
                name=name,
                specialty='Medical Practitioner',
                email=None if taken else email,
                available=True,
                user_id=user.id
            )
        )

    db.session.commit()

    token = create_access_token(identity=str(user.id))

    msg = (
        'Registration received. Your doctor account is pending verification '
        'and cannot access patient referrals until an administrator approves it.'
        if role == 'doctor'
        else 'Account created successfully'
    )

    return jsonify({
        'message': msg,
        'token': token,
        'user': user.to_dict()
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = _json()

    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    role = data.get('role')

    if not email or not password:
        return jsonify({
            'message': 'Email and password are required.'
        }), 400

   
    if role not in LOGIN_ROLES:
        return jsonify({
            'message': 'Please select a valid account type.'
        }), 400

    key = 'login:%s:%s' % (request.remote_addr, email)

    if ratelimit.too_many(key, LOGIN_LIMIT, LOGIN_WINDOW):
        wait = ratelimit.retry_after(key, LOGIN_WINDOW)

        return jsonify({
            'message': 'Too many failed attempts. Please try again in %d minute(s).'
            % ((wait + 59) // 60)
        }), 429

    user = User.query.filter_by(email=email).first()

    ok = check_password_hash(
        user.password_hash if user else _DUMMY_HASH,
        password
    )

    if not user or not ok:
        ratelimit.record(key)

        return jsonify({
            'message': 'Incorrect email or password.'
        }), 401

    if not user.is_active:
        return jsonify({
            'message': 'This account has been disabled. Please contact support.'
        }), 403

   
    if user.role != role:
        return jsonify({
            'message': 'This is a %s account. Please select "%s" to sign in.'
            % (
                ROLE_LABEL.get(user.role, user.role),
                {
                    'user': 'Patient',
                    'doctor': 'Doctor',
                    'admin': 'Admin'
                }.get(user.role, 'the correct role')
            ),
            'code': 'role_mismatch'
        }), 403

    ratelimit.clear(key)

    token = create_access_token(identity=str(user.id))

    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user': user.to_dict()
    }), 200


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def profile():
    user = db.session.get(User, int(get_jwt_identity()))

    if not user or not user.is_active:
        return jsonify({
            'message': 'Account not found or disabled.'
        }), 401

    return jsonify({
        'user': user.to_dict()
    }), 200


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    email = (_json().get('email') or '').strip().lower()

    key = 'forgot:%s' % request.remote_addr

    generic = {
        'message': 'If an account exists for that email, a password reset link has been generated.'
    }

    if ratelimit.too_many(key, 5, 15 * 60):
        return jsonify({
            'message': 'Too many requests. Please try again later.'
        }), 429

    ratelimit.record(key)

    user = User.query.filter_by(email=email).first() if EMAIL_RE.match(email) else None

    if user and user.is_active:
        token = _token_serializer().dumps({
            'uid': user.id,
            'h': user.password_hash[-16:]
        })

        link = '%s/reset-password?token=%s' % (
            current_app.config['FRONTEND_URL'].rstrip('/'),
            token
        )

        if mail_configured():
            send_template(
                'password_reset',
                user.email,
                {
                    'name': user.name,
                    'link': link
                }
            )
        else:
            current_app.logger.warning(
                'PASSWORD RESET LINK for %s: %s',
                user.email,
                link
            )

            if current_app.config.get('DEV_SHOW_RESET_LINK'):
                generic['dev_reset_link'] = link

    generic['email_delivery'] = (
        'configured' if mail_configured() else 'not_configured'
    )

    return jsonify(generic), 200


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    data = _json()

    token = data.get('token') or ''
    password = data.get('password')

    problem = password_problem(password)

    if problem:
        return jsonify({
            'message': problem
        }), 400

    try:
        payload = _token_serializer().loads(token, max_age=3600)

    except SignatureExpired:
        return jsonify({
            'message': 'This reset link has expired. Please request a new one.'
        }), 400

    except BadSignature:
        return jsonify({
            'message': 'This reset link is invalid. Please request a new one.'
        }), 400

    user = db.session.get(User, payload.get('uid'))

    if not user or user.password_hash[-16:] != payload.get('h'):
        return jsonify({
            'message': 'This reset link is invalid or has already been used.'
        }), 400

    user.set_password(password)
    db.session.commit()

    return jsonify({
        'message': 'Password updated. You can now sign in.'
    }), 200
