import os
from datetime import timedelta

from dotenv import load_dotenv
from flask import Flask, jsonify, request, redirect
from flask_cors import CORS

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

from extensions import db, migrate, jwt  # noqa: E402

DEFAULT_SECRETS = {'your-secret-key-change-in-production', 'your-jwt-secret-change-in-production',
                   'dev-secret-key', 'jwt-secret-key', ''}


def _abs(path):
    return path if os.path.isabs(path) else os.path.abspath(os.path.join(BASE_DIR, path))


def create_app(test_config=None):
    app = Flask(__name__)
    env = os.getenv('FLASK_ENV', 'development')
    is_prod = env == 'production'

    app.config.update(
        SECRET_KEY=os.getenv('SECRET_KEY', 'dev-secret-key'),
        SQLALCHEMY_DATABASE_URI=os.getenv('DATABASE_URL', 'sqlite:///' + os.path.join(BASE_DIR, 'dermascan.db')),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SQLALCHEMY_ENGINE_OPTIONS={'pool_pre_ping': True},
        JWT_SECRET_KEY=os.getenv('JWT_SECRET_KEY', 'jwt-secret-key'),
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(hours=int(os.getenv('JWT_EXPIRY_HOURS', '8'))),
        UPLOAD_FOLDER=_abs(os.getenv('UPLOAD_FOLDER', './uploads')),
        MODEL_PATH=_abs(os.getenv('MODEL_PATH', './models/skin_disease_model.keras')),
        MAX_CONTENT_LENGTH=16 * 1024 * 1024,   # hard cap on any request body
        FRONTEND_URL=os.getenv('FRONTEND_URL', 'http://localhost:3000'),
        DEV_SHOW_RESET_LINK=(not is_prod),
        FORCE_HTTPS=os.getenv('FORCE_HTTPS', 'false').lower() == 'true',
        SMTP_HOST=os.getenv('SMTP_HOST', ''),
        SMTP_PORT=int(os.getenv('SMTP_PORT', '587')),
        SMTP_USER=os.getenv('SMTP_USER', ''),
        SMTP_PASSWORD=os.getenv('SMTP_PASSWORD', ''),
        SMTP_SECURITY=os.getenv('SMTP_SECURITY', 'starttls').lower(),
        MAIL_FROM=os.getenv('MAIL_FROM', 'DermaScan AI <no-reply@localhost>'),
        MAIL_SYNC=False,
        REMINDER_HOURS_BEFORE=float(os.getenv('REMINDER_HOURS_BEFORE', '24')),
        REMINDER_CHECK_MINUTES=int(os.getenv('REMINDER_CHECK_MINUTES', '5')),
        REMINDERS_ENABLED=os.getenv('REMINDERS_ENABLED', 'true').lower() == 'true',
    )
    app.config['MAIL_BACKEND'] = os.getenv('MAIL_BACKEND') or ('smtp' if app.config['SMTP_HOST'] else 'console')
    if test_config:
        app.config.update(test_config)

    if is_prod and not test_config:
        problems = []
        if app.config['SECRET_KEY'] in DEFAULT_SECRETS or app.config['JWT_SECRET_KEY'] in DEFAULT_SECRETS:
            problems.append('SECRET_KEY and JWT_SECRET_KEY must be changed from their defaults')
        if not os.getenv('DATA_ENCRYPTION_KEY'):
            problems.append('DATA_ENCRYPTION_KEY must be set')
        if not app.config['FORCE_HTTPS']:
            problems.append('FORCE_HTTPS=true is required (serve over HTTPS)')
        if problems:
            raise RuntimeError('Unsafe production configuration: ' + '; '.join(problems))

    if os.getenv('BEHIND_PROXY', 'false').lower() == 'true':
        from werkzeug.middleware.proxy_fix import ProxyFix
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    origins = [o.strip() for o in os.getenv(
        'CORS_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000').split(',') if o.strip()]
    CORS(app, resources={r'/api/*': {'origins': origins}})

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    import models  # noqa: F401  (register tables)
    from routes.auth import auth_bp
    from routes.scan import scan_bp
    from routes.consultation import consultation_bp
    from routes.admin import admin_bp
    from routes.doctor import doctor_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(scan_bp, url_prefix='/api/scan')
    app.register_blueprint(consultation_bp, url_prefix='/api/consultation')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(doctor_bp, url_prefix='/api/doctor')

    # ---- JSON error responses (the frontend reads `message`) ----
    @jwt.unauthorized_loader
    def _missing(reason):
        return jsonify({'message': 'Please sign in to continue.'}), 401

    @jwt.invalid_token_loader
    def _invalid(reason):
        return jsonify({'message': 'Your session is invalid. Please sign in again.'}), 401

    @jwt.expired_token_loader
    def _expired(header, payload):
        return jsonify({'message': 'Your session has expired. Please sign in again.'}), 401

    @app.errorhandler(413)
    def _too_big(e):
        return jsonify({'message': 'The upload is too large. The maximum size is 10 MB per image.', 'code': 'file_too_large'}), 413

    @app.errorhandler(404)
    def _nf(e):
        return jsonify({'message': 'Not found'}), 404

    @app.errorhandler(405)
    def _na(e):
        return jsonify({'message': 'Method not allowed'}), 405

    @app.errorhandler(500)
    def _err(e):
        db.session.rollback()
        return jsonify({'message': 'Something went wrong on our side. Please try again.'}), 500

    @app.before_request
    def _https_only():
        if app.config['FORCE_HTTPS'] and not request.is_secure and request.endpoint != 'health':
            if request.method == 'GET':
                return redirect(request.url.replace('http://', 'https://', 1), code=301)
            return jsonify({'message': 'HTTPS is required.'}), 400

    @app.after_request
    def _security_headers(resp):
        resp.headers.setdefault('X-Content-Type-Options', 'nosniff')
        resp.headers.setdefault('X-Frame-Options', 'DENY')
        resp.headers.setdefault('Referrer-Policy', 'no-referrer')
        if request.path.startswith('/api/'):
            resp.headers.setdefault('Cache-Control', 'no-store')
        if app.config['FORCE_HTTPS']:
            resp.headers.setdefault('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
        return resp

    @app.route('/api/health')
    def health():
        return {'status': 'healthy', 'message': 'DermaScan AI API is running'}

    if not app.config.get('TESTING'):
        with app.app_context():
            init_database(app)
        _preload_model(app)
        # Start the reminder loop once per real server process (not in the dev-reloader's parent).
        if app.config['REMINDERS_ENABLED'] and (is_prod or os.environ.get('WERKZEUG_RUN_MAIN') == 'true'):
            from utils.reminders import start_reminder_loop
            start_reminder_loop(app)
            print('[reminders] Running every %d min (%sh before). Needs email set up to send.' % (app.config['REMINDER_CHECK_MINUTES'], app.config['REMINDER_HOURS_BEFORE']))

    return app


def _preload_model(app):
    """Load the CNN at start-up so you can see which mode the app is in."""
    from utils.model import get_model
    try:
        m = get_model(app.config['MODEL_PATH'])
        if m.model is None:
            print('[model] No trained model found -> DEMO placeholder results. See backend/training/README_TRAINING.md')
        else:
            print('[model] Loaded %s (%d classes)%s' % (m.version, len(m.class_names),
                  ' - EXPERIMENTAL: too little training data, results are flagged in the UI' if m.version.startswith('experimental') else ''))
    except Exception as exc:
        print('[model] Could not load the model (%s). Using DEMO placeholder results.' % exc)


def init_database(app):
    """Create missing tables and apply additive column upgrades."""
    from utils.schema_upgrade import upgrade_schema
    try:
        db.create_all()
        added = upgrade_schema(db)
        if added:
            print('[db] Added columns: ' + ', '.join(added))
    except Exception as exc:
        raise SystemExit(
            '\n[db] Could not connect to / initialise the database.\n'
            '     DATABASE_URL = %s\n     Error: %s\n\n'
            '     -> Is MySQL running, and does the database exist? Run:  python seed.py\n'
            '        (it creates the database automatically), or see README_SETUP.md.\n'
            % (app.config['SQLALCHEMY_DATABASE_URI'].split('@')[-1], exc))


if __name__ == '__main__':
    application = create_app()
    application.run(debug=os.getenv('FLASK_ENV', 'development') != 'production', host='0.0.0.0', port=5000)
