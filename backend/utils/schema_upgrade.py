"""Idempotent, additive upgrades for databases created by earlier versions.

`db.create_all()` creates missing TABLES but never adds columns to existing
ones. This adds the few new nullable columns so existing databases keep
working without a manual migration.
"""
from sqlalchemy import inspect, text

# (table, column, DDL type)
ADDITIVE_COLUMNS = [
    ('scans', 'model_version', 'VARCHAR(50)'),
    ('doctors', 'user_id', 'INTEGER'),
    ('users', 'terms_accepted_at', 'DATETIME'),
    ('doctors', 'bio', 'VARCHAR(600)'),
    ('consultations', 'doctor_note', 'VARCHAR(255)'),
    ('consultations', 'responded_at', 'DATETIME'),
    ('consultations', 'reminder_sent_at', 'DATETIME'),
    ('consultations', 'reschedule_count', 'INTEGER'),
    ('consultations', 'report_snapshot', 'TEXT'),
    ('consultations', 'report_include_image', 'BOOLEAN'),
    ('consultations', 'report_consent_at', 'DATETIME'),
    ('consultations', 'report_consent_version', 'VARCHAR(20)'),
    ('consultations', 'report_opened_at', 'DATETIME'),
    ('consultations', 'report_withdrawn_at', 'DATETIME'),
    ('consultations', 'idempotency_key', 'VARCHAR(64)'),
    ('users', 'verification_status', 'VARCHAR(20)'),
    ('users', 'hpcsa_number', 'VARCHAR(20)'),
    ('users', 'practice_number', 'VARCHAR(20)'),
    ('users', 'verified_at', 'DATETIME'),
    ('users', 'verified_by', 'INTEGER'),
    ('users', 'verification_notes', 'VARCHAR(255)'),
]


def upgrade_schema(db):
    insp = inspect(db.engine)
    tables = set(insp.get_table_names())
    added = []
    for table, column, ddl in ADDITIVE_COLUMNS:
        if table not in tables:
            continue
        existing = {c['name'] for c in insp.get_columns(table)}
        if column in existing:
            continue
        with db.engine.begin() as conn:
            conn.execute(text('ALTER TABLE %s ADD COLUMN %s %s NULL' % (table, column, ddl)))
        added.append('%s.%s' % (table, column))

    # One-time, idempotent backfill for rows that predate verification.
    with db.engine.begin() as conn:
        conn.execute(text("UPDATE users SET verification_status='not_required' "
                          "WHERE verification_status IS NULL AND role <> 'doctor'"))
        # Seeded/linked doctors (they already have a doctor profile) stay usable;
        # any other existing doctor login must go through verification.
        conn.execute(text("UPDATE users SET verification_status='approved' "
                          "WHERE verification_status IS NULL AND role='doctor' "
                          "AND id IN (SELECT user_id FROM doctors WHERE user_id IS NOT NULL)"))
        conn.execute(text("UPDATE users SET verification_status='pending' "
                          "WHERE verification_status IS NULL AND role='doctor'"))
    return added
