"""Create the database (MySQL) if needed, create tables, add demo data.

Usage:  python seed.py
Safe to run repeatedly - it only adds what is missing.
"""
import os
import sys

from dotenv import load_dotenv
from sqlalchemy.engine import make_url

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))


def ensure_mysql_database():
    url = make_url(os.getenv('DATABASE_URL', ''))
    if not url.drivername.startswith('mysql'):
        return
    import pymysql
    try:
        conn = pymysql.connect(host=url.host or 'localhost', port=url.port or 3306,
                               user=url.username, password=url.password or '')
    except Exception as exc:
        sys.exit('\n[seed] Cannot connect to MySQL at %s:%s as "%s".\n       %s\n\n'
                 '       Check that MySQL is running and that the username/password in\n'
                 '       backend/.env (DATABASE_URL) are correct. Special characters in the\n'
                 '       password must be URL-encoded (e.g. @ -> %%40). See README_SETUP.md.\n'
                 % (url.host, url.port or 3306, url.username, exc))
    with conn.cursor() as cur:
        cur.execute('CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci' % url.database)
    conn.commit()
    conn.close()
    print('[seed] MySQL database "%s" is ready' % url.database)


ensure_mysql_database()

from app import create_app, init_database  # noqa: E402
from extensions import db  # noqa: E402
from models.user import User  # noqa: E402
from models.consultation import Doctor  # noqa: E402

app = create_app()

DEMO_USERS = [
    ('Admin User', 'admin@dermascan.ai', 'admin', 'Admin@12345'),
    ('John Doe', 'john@example.com', 'user', 'User@12345'),
]
DOCTORS = [
    # name, specialty, email, phone, hospital, experience, rating, available, has_portal_login
    ('Dr. Sarah Wilson', 'Dermatologist', 'sarah@dermascan.ai', '+1-555-0101', 'City Medical Center', '15 years', 4.9, True, True),
    ('Dr. Michael Chen', 'Clinical Dermatologist', 'michael@dermascan.ai', '+1-555-0102', 'University Health Hospital', '12 years', 4.8, True, True),
    ('Dr. Emily Rodriguez', 'Pediatric Dermatology', 'emily@dermascan.ai', '+1-555-0103', "Children's Medical Center", '10 years', 4.7, False, False),
    # No portal login on purpose: referrals to this doctor stay "Pending" (awaiting delivery).
    ('Dr. James Thompson', 'Surgical Dermatology', 'james@dermascan.ai', '+1-555-0104', 'Advanced Dermatology Clinic', '18 years', 4.9, True, False),
]
DOCTOR_PASSWORD = 'Doctor@12345'

with app.app_context():
    init_database(app)

    for name, email, role, pw in DEMO_USERS:
        if not User.query.filter_by(email=email).first():
            u = User(name=name, email=email, role=role, verification_status='not_required')
            u.set_password(pw)
            db.session.add(u)
            print('[seed] created %s %s' % (role, email))
    db.session.commit()

    for name, spec, email, phone, hosp, exp, rating, avail, portal in DOCTORS:
        doc = Doctor.query.filter_by(name=name).first()
        if not doc:
            doc = Doctor(name=name, specialty=spec, email=email, phone=phone, hospital=hosp,
                         experience=exp, rating=rating, available=avail,
                         bio='Demo profile created by seed.py.')
            db.session.add(doc)
            db.session.flush()
            print('[seed] created doctor %s' % name)
        if portal and not doc.user_id:
            login_email = doc.email or email
            acct = User.query.filter_by(email=login_email).first()
            if not acct:
                acct = User(name=doc.name, email=login_email, role='doctor', verification_status='approved',
                            verification_notes='Demo account created by seed.py (no real HPCSA check)')
                acct.set_password(DOCTOR_PASSWORD)
                db.session.add(acct)
                db.session.flush()
                print('[seed] created doctor login %s' % login_email)
            if acct.role == 'doctor':
                doc.user_id = acct.id
    db.session.commit()

    print('\n[seed] Done. DEMO logins (change/remove before real use):')
    print('        admin  : admin@dermascan.ai  / Admin@12345')
    print('        patient: john@example.com    / User@12345')
    for d in Doctor.query.filter(Doctor.user_id.isnot(None)).all():
        acct = db.session.get(User, d.user_id)
        print('        doctor : %-30s / %s   (%s, secure inbox)' % (acct.email, DOCTOR_PASSWORD, d.name))
    print('        (Accounts that already existed keep their existing passwords.)')
