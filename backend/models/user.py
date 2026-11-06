from datetime import datetime
from extensions import db
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), default='user')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    terms_accepted_at = db.Column(db.DateTime)

    # --- Doctor verification (only meaningful when role == 'doctor') ---
    # 'not_required' (patients/admins) | 'pending' | 'approved' | 'rejected'
    verification_status = db.Column(db.String(20), default='not_required')
    hpcsa_number = db.Column(db.String(20), unique=True, nullable=True)
    practice_number = db.Column(db.String(20), nullable=True)
    verified_at = db.Column(db.DateTime)
    verified_by = db.Column(db.Integer)          # admin user id
    verification_notes = db.Column(db.String(255))

    scans = db.relationship('ScanRecord', backref='user', lazy=True, cascade='all, delete-orphan')
    consultations = db.relationship('Consultation', backref='patient', lazy=True, cascade='all, delete-orphan')
    referrals = db.relationship('Referral', backref='patient', lazy=True, cascade='all, delete-orphan', foreign_keys='Referral.patient_id')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'is_active': self.is_active,
            'verification_status': self.verification_status,
            'hpcsa_number': self.hpcsa_number,
            'practice_number': self.practice_number,
            'verification_notes': self.verification_notes,
            'verified_at': self.verified_at.isoformat() if self.verified_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
