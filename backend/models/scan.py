from datetime import datetime
from extensions import db

class ScanRecord(db.Model):
    __tablename__ = 'scans'

    id = db.Column(db.Integer, primary_key=True)
    scan_id = db.Column(db.String(20), unique=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    image_path = db.Column(db.String(255), nullable=False)
    disease_name = db.Column(db.String(100))
    confidence_score = db.Column(db.Float)
    severity = db.Column(db.String(20))
    symptoms = db.Column(db.Text)
    recommendations = db.Column(db.Text)
    status = db.Column(db.String(20), default='completed')
    model_version = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    consultations = db.relationship('Consultation', backref='scan', lazy=True)
    referrals = db.relationship('Referral', backref='scan', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'scan_id': self.scan_id,
            'user_id': self.user_id,
            'has_image': bool(self.image_path),
            'model_version': self.model_version,
            'is_demo': (self.model_version or 'demo-placeholder').startswith(('demo', 'experimental')),
            'disease_name': self.disease_name,
            'confidence_score': self.confidence_score,
            'severity': self.severity,
            'symptoms': [x.strip() for x in self.symptoms.split(',')] if self.symptoms else [],
            'recommendations': [x.strip() for x in self.recommendations.split(',')] if self.recommendations else [],
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
