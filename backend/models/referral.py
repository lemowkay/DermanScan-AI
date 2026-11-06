from datetime import datetime
import json

from extensions import db
from utils.crypto import EncryptedText

# Statuses. Only the system moves a referral forward, and only on evidence:
#   pending   - request recorded; NOT yet delivered anywhere
#   submitted - placed in a doctor's secure in-app inbox
#   received  - the doctor's authenticated account opened it
#   reviewed  - the doctor marked it reviewed
#   withdrawn - the patient withdrew consent / cancelled
REFERRAL_STATUSES = ('pending', 'submitted', 'received', 'reviewed', 'withdrawn')
ACTIVE_STATUSES = ('pending', 'submitted', 'received')
DOCTOR_VISIBLE_STATUSES = ('submitted', 'received', 'reviewed')


class Referral(db.Model):
    __tablename__ = 'referrals'

    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(20), unique=True, nullable=False, index=True)
    idempotency_key = db.Column(db.String(64), unique=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    scan_id = db.Column(db.Integer, db.ForeignKey('scans.id'), nullable=False, index=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctors.id'), nullable=True, index=True)
    doctor_name = db.Column(db.String(100), nullable=False)
    doctor_email = db.Column(db.String(120))
    status = db.Column(db.String(20), nullable=False, default='pending', index=True)
    status_message = db.Column(db.String(255))
    include_image = db.Column(db.Boolean, default=False)
    # Exactly what was shared, frozen at consent time. Encrypted at rest.
    snapshot = db.Column(EncryptedText)
    patient_notes = db.Column(EncryptedText)
    doctor_review_note = db.Column(EncryptedText)
    consent_given = db.Column(db.Boolean, nullable=False, default=False)
    consent_at = db.Column(db.DateTime)
    consent_text_version = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    submitted_at = db.Column(db.DateTime)
    received_at = db.Column(db.DateTime)
    reviewed_at = db.Column(db.DateTime)
    withdrawn_at = db.Column(db.DateTime)

    doctor = db.relationship('Doctor', backref='referrals', lazy=True)
    events = db.relationship('ReferralEvent', backref='referral', lazy=True,
                             cascade='all, delete-orphan', order_by='ReferralEvent.created_at')

    def snapshot_dict(self):
        return json.loads(self.snapshot) if self.snapshot else {}

    def to_dict(self, include_snapshot=False, include_events=False):
        iso = lambda d: d.isoformat() if d else None
        data = {
            'reference': self.reference,
            'scan_id': self.scan.scan_id if self.scan else None,
            'doctor_id': self.doctor_id,
            'doctor_name': self.doctor_name,
            'doctor_email': self.doctor_email,
            'status': self.status,
            'status_message': self.status_message,
            'include_image': bool(self.include_image),
            'consent_given': bool(self.consent_given),
            'consent_at': iso(self.consent_at),
            'created_at': iso(self.created_at),
            'submitted_at': iso(self.submitted_at),
            'received_at': iso(self.received_at),
            'reviewed_at': iso(self.reviewed_at),
            'withdrawn_at': iso(self.withdrawn_at),
        }
        if include_snapshot:
            data['snapshot'] = self.snapshot_dict()
            data['patient_notes'] = self.patient_notes
            data['doctor_review_note'] = self.doctor_review_note
        if include_events:
            data['events'] = [e.to_dict() for e in self.events]
        return data


class ReferralEvent(db.Model):
    """Append-only audit trail (who did what, when)."""
    __tablename__ = 'referral_events'

    id = db.Column(db.Integer, primary_key=True)
    referral_id = db.Column(db.Integer, db.ForeignKey('referrals.id'), nullable=False, index=True)
    event = db.Column(db.String(40), nullable=False)
    actor_id = db.Column(db.Integer)
    actor_role = db.Column(db.String(20))
    detail = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'event': self.event,
            'actor_role': self.actor_role,
            'detail': self.detail,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
