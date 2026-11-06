from datetime import datetime
import json

from extensions import db
from utils.crypto import EncryptedText

class Doctor(db.Model):
    __tablename__ = 'doctors'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    specialty = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True)
    phone = db.Column(db.String(20))
    hospital = db.Column(db.String(200))
    experience = db.Column(db.String(50))
    rating = db.Column(db.Float, default=0.0)
    available = db.Column(db.Boolean, default=True)          # doctor's own 'accepting appointments' switch
    bio = db.Column(db.String(600))
    # Linked login (role='doctor'). Only doctors with a linked account can
    # receive referrals through the secure in-app inbox.
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    consultations = db.relationship('Consultation', backref='doctor', lazy=True)
    account = db.relationship('User', foreign_keys=[user_id], lazy='joined')

    # --- visibility rules (single source of truth: directory, booking AND referrals) ---
    @property
    def verified(self):
        """HPCSA-verified by an admin and still active."""
        a = self.account
        return bool(self.user_id and a and a.is_active and a.role == 'doctor' and a.verification_status == 'approved')

    @property
    def is_listed(self):
        """Shown to patients: switched on, and either a directory-only entry or a verified doctor.
        Pending / rejected / revoked doctors are never shown."""
        if not self.available:
            return False
        return self.user_id is None or self.verified

    @property
    def bookable(self):
        """Online booking needs a verified doctor with a login who can actually confirm it."""
        return self.is_listed and self.user_id is not None

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'specialty': self.specialty,
            'phone': self.phone,
            'bio': self.bio,
            'hospital': self.hospital,
            'experience': self.experience,
            'rating': self.rating,
            'available': self.available,
            'verified': self.verified,
            'bookable': self.bookable,
        }

    def to_private_dict(self):
        """For the doctor's own profile page (includes the login email)."""
        d = self.to_dict()
        d['email'] = self.email
        d['profile_complete'] = bool(self.specialty and self.specialty != 'Medical Practitioner' and self.hospital and self.experience)
        return d

MAX_RESCHEDULES = 3


class Consultation(db.Model):
    __tablename__ = 'consultations'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctors.id'), nullable=False)
    scan_id = db.Column(db.Integer, db.ForeignKey('scans.id'))
    type = db.Column(db.String(20), default='video')
    status = db.Column(db.String(20), default='pending')
    notes = db.Column(db.Text)
    appointment_date = db.Column(db.DateTime)
    doctor_note = db.Column(db.String(255))
    responded_at = db.Column(db.DateTime)
    reminder_sent_at = db.Column(db.DateTime)           # set (atomically) when the reminder is sent
    reschedule_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # --- Report attached to the booking (replaces the old separate "referral") ---
    # What was shared is frozen at consent time and encrypted at rest.
    report_snapshot = db.Column(EncryptedText)
    report_include_image = db.Column(db.Boolean, default=False)
    report_consent_at = db.Column(db.DateTime)
    report_consent_version = db.Column(db.String(20))
    report_opened_at = db.Column(db.DateTime)           # first time the doctor opened it
    report_withdrawn_at = db.Column(db.DateTime)
    idempotency_key = db.Column(db.String(64))          # makes a retried booking safe (no duplicates)

    events = db.relationship('AppointmentEvent', backref='consultation', lazy=True,
                             cascade='all, delete-orphan', order_by='AppointmentEvent.created_at')

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'doctor_id': self.doctor_id,
            'scan_id': self.scan_id,
            'type': self.type,
            'status': self.status,
            'notes': self.notes,
            'doctor_name': self.doctor.name if self.doctor else None,
            'doctor_specialty': self.doctor.specialty if self.doctor else None,
            'doctor_note': self.doctor_note,
            'responded_at': self.responded_at.isoformat() if self.responded_at else None,
            'reschedule_count': self.reschedule_count or 0,
            'has_report': self.has_report,
            'report_scan_id': self.scan.scan_id if (self.scan_id and self.scan) else None,
            'report_include_image': bool(self.report_include_image) and self.has_report,
            'report_opened_at': self.report_opened_at.isoformat() if self.report_opened_at else None,
            'report_withdrawn': self.report_withdrawn_at is not None,
            'can_change': self.can_change,
            'can_reschedule': self.can_change and (self.reschedule_count or 0) < MAX_RESCHEDULES,
            'appointment_date': self.appointment_date.isoformat() if self.appointment_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    @property
    def can_change(self):
        """Patient may still cancel/reschedule: pending or confirmed, and not yet started."""
        return self.status in ('pending', 'confirmed') and bool(self.appointment_date) and self.appointment_date > datetime.now()

    # ------------------------------------------------------------------ report access
    @property
    def has_report(self):
        """A report is attached and the patient has not withdrawn it."""
        return bool(self.report_snapshot) and self.report_withdrawn_at is None

    @property
    def report_visible_to_doctor(self):
        """The doctor may view the attached report only while the appointment is live
        (pending/confirmed/completed). Declined or cancelled appointments lose access."""
        return self.has_report and self.status in ('pending', 'confirmed', 'completed')

    def snapshot_dict(self):
        return json.loads(self.report_snapshot) if self.report_snapshot else {}


class AppointmentEvent(db.Model):
    """Append-only audit trail (who did what, when). Never holds report contents."""
    __tablename__ = 'appointment_events'

    id = db.Column(db.Integer, primary_key=True)
    consultation_id = db.Column(db.Integer, db.ForeignKey('consultations.id'), nullable=False, index=True)
    event = db.Column(db.String(40), nullable=False)
    actor_role = db.Column(db.String(20))
    detail = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {'event': self.event, 'actor_role': self.actor_role, 'detail': self.detail,
                'created_at': self.created_at.isoformat() if self.created_at else None}
