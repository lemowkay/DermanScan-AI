from datetime import datetime

from extensions import db


class EmailLog(db.Model):
    """Delivery record for notification emails. Deliberately stores NO email
    body (so it can never hold health information) - only who/what/outcome."""
    __tablename__ = 'email_logs'

    id = db.Column(db.Integer, primary_key=True)
    to_email = db.Column(db.String(120), nullable=False, index=True)
    template = db.Column(db.String(40), nullable=False)
    subject = db.Column(db.String(200))
    related_reference = db.Column(db.String(20))
    # 'sent' | 'failed' | 'not_configured'
    status = db.Column(db.String(20), nullable=False)
    error = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id, 'to_email': self.to_email, 'template': self.template, 'subject': self.subject,
            'related_reference': self.related_reference, 'status': self.status, 'error': self.error,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
