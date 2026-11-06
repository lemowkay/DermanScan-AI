import io
import os
import sys

import pytest
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402
from extensions import db  # noqa: E402
from models.consultation import Doctor  # noqa: E402
from models.user import User  # noqa: E402
from utils import ratelimit  # noqa: E402
from utils.model import reset_model  # noqa: E402


@pytest.fixture()
def app(tmp_path):
    reset_model()   # tests always run against the DEMO model, never the shipped one
    app = create_app({
        'TESTING': True, 'MODEL_PATH': str(tmp_path / 'no_model.keras'), 'MAIL_BACKEND': 'memory', 'MAIL_SYNC': True, 'SQLALCHEMY_DATABASE_URI': 'sqlite:///' + str(tmp_path / 't.db'),
        'UPLOAD_FOLDER': str(tmp_path / 'uploads'), 'SECRET_KEY': 'test', 'JWT_SECRET_KEY': 'test-jwt-secret-of-adequate-length-0123456789',
    })
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()
    ratelimit._hits.clear()


@pytest.fixture()
def client(app):
    return app.test_client()


def make_image(fmt='PNG', size=(64, 64)):
    buf = io.BytesIO()
    Image.new('RGB', size, (200, 120, 100)).save(buf, fmt)
    return buf.getvalue()


def register(client, email='pat@example.com', name='Pat Patient', password='Password1'):
    r = client.post('/api/auth/register', json={'name': name, 'email': email, 'password': password, 'confirm_password': password, 'role': 'user', 'accepted_terms': True})
    return r


def auth(token):
    return {'Authorization': 'Bearer ' + token}


@pytest.fixture()
def patient(client):
    r = register(client)
    assert r.status_code == 201
    return r.get_json()['token']


def upload(client, token, data=None, name='skin.png', mime='image/png'):
    data = data if data is not None else make_image()
    return client.post('/api/scan/upload', headers=auth(token),
                       data={'image': (io.BytesIO(data), name, mime)}, content_type='multipart/form-data')


@pytest.fixture()
def scan_id(client, patient):
    r = upload(client, patient)
    assert r.status_code == 201, r.get_json()
    return r.get_json()['scan']['scan_id']


@pytest.fixture()
def doctors(app):
    out = {}
    for key, name, email, portal in [('portal', 'Dr. Portal', 'portal@clinic.test', True), ('noportal', 'Dr. NoPortal', 'np@clinic.test', False)]:
        u = None
        if portal:
            u = User(name=name, email=email, role='doctor', verification_status='approved'); u.set_password('Doctor123'); db.session.add(u); db.session.flush()
        d = Doctor(name=name, specialty='Derm', email=email, available=True, user_id=u.id if u else None)
        db.session.add(d); db.session.flush()
        out[key] = d.id
    db.session.commit()
    return out
