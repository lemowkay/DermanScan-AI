"""Helpers shared by several test modules (kept separate to avoid circular imports)."""
from datetime import datetime, timedelta

from utils.report_share import CONSENT_VERSION
from .conftest import auth
from .test_roles import login


def outbox(app):
    return app.extensions.get('outbox', [])


def text_of(msg):
    return msg.get_body(preferencelist=('plain',)).get_content() + msg.get_body(preferencelist=('html',)).get_content()


def next_weekday(days_ahead=2):
    d = datetime.now().date() + timedelta(days=days_ahead)
    while d.weekday() > 4:
        d += timedelta(days=1)
    return d


def doc_token(client):
    return login(client, 'portal@clinic.test', 'doctor', 'Doctor123').get_json()['token']


def book_with_report(client, tok, doctor_id, scan_id, hhmm='09:00', day=None, **kw):
    day = day or next_weekday()
    body = {'doctor_id': doctor_id, 'type': 'video', 'notes': 'itches at night', 'appointment_date': '%s %s' % (day.isoformat(), hhmm),
            'scan_id': scan_id, 'consent': True, 'consent_version': CONSENT_VERSION,
            'options': {'include_image': True, 'include_recommendations': True}}
    body.update(kw)
    return client.post('/api/consultation/appointment', headers=auth(tok), json=body)
