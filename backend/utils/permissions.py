
from functools import wraps

from flask import g, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.user import User


def current_user():
    return getattr(g, 'current_user', None)


def roles_required(*roles, allow_unverified_doctor=False):
    """Allow only the listed roles. Doctors must also be admin-approved,
    except on endpoints (e.g. editing their own profile) that opt in."""
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            user = db.session.get(User, int(get_jwt_identity()))
            if not user or not user.is_active:
                return jsonify({'message': 'Your account is not available. Please sign in again.'}), 401
            if user.role not in roles:
                return jsonify({'message': 'You do not have permission to do this.', 'code': 'forbidden_role'}), 403
            if user.role == 'doctor' and user.verification_status != 'approved' and not allow_unverified_doctor:
                return jsonify({'message': 'Your doctor account has not been verified yet.',
                                'code': 'doctor_not_verified',
                                'verification_status': user.verification_status}), 403
            g.current_user = user
            return fn(*args, **kwargs)
        return wrapper
    return decorator
