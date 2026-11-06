
import html
import re
import smtplib
import ssl
import threading
from email.message import EmailMessage

from flask import current_app

BRAND = 'DermaScan AI'


# --------------------------------------------------------------- helpers
def _clean(value, limit=80):
    """Strip control characters/newlines (header injection) and truncate."""
    return re.sub(r'[\x00-\x1f\x7f]+', ' ', str(value or '')).strip()[:limit]


def mail_configured(app=None):
    app = app or current_app
    return app.config.get('MAIL_BACKEND') in ('smtp', 'memory')


def _link(path):
    return current_app.config['FRONTEND_URL'].rstrip('/') + path


# --------------------------------------------------------------- templates
def _wrap_html(title, paragraphs, button=None):
    body = ''.join('<p style="margin:0 0 14px;line-height:1.55;color:#374151">%s</p>' % p for p in paragraphs)
    btn = ''
    if button:
        label, url = button
        btn = ('<p style="margin:22px 0"><a href="%s" style="background:#2563eb;color:#fff;text-decoration:none;'
               'padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">%s</a></p>'
               % (html.escape(url, quote=True), html.escape(label)))
    return ('<!doctype html><html><body style="margin:0;background:#f3f4f6;padding:24px;font-family:Arial,Helvetica,sans-serif">'
            '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">'
            '<div style="background:#2563eb;color:#fff;padding:18px 24px;font-size:18px;font-weight:700">%s</div>'
            '<div style="padding:24px"><h1 style="font-size:20px;margin:0 0 16px;color:#111827">%s</h1>%s%s'
            '<p style="margin:22px 0 0;font-size:12px;color:#6b7280">For your privacy this email contains no health '
            'information. Sign in to view details. If you did not expect this message you can ignore it.</p>'
            '</div></div></body></html>' % (BRAND, html.escape(title), body, btn))


def render(template, ctx):
    """Return (subject, text, html). All interpolated values are escaped/cleaned."""
    name = _clean(ctx.get('name'), 60) or 'there'
    e = html.escape
    if template == 'doctor_approved':
        url = _link('/login')
        subject = 'Your %s doctor account has been verified' % BRAND
        text = ('Hi %s,\n\nGood news: an administrator has verified your HPCSA registration and approved your doctor account.\n'
                'Sign in and choose the "Doctor" option to open your appointment requests: %s\n' % (name, url))
        htm = _wrap_html('Doctor account verified', [
            'Hi %s,' % e(name),
            'An administrator has verified your HPCSA registration and approved your doctor account. '
            'Sign in and choose the <strong>Doctor</strong> option to open your appointment requests.'], ('Sign in', url))
    elif template == 'doctor_rejected':
        url = _link('/login')
        subject = 'Update on your %s doctor verification' % BRAND
        text = ('Hi %s,\n\nYour doctor account verification was not approved, or your access was withdrawn. '
                'Sign in to see the reason: %s\n' % (name, url))
        htm = _wrap_html('Doctor verification update', [
            'Hi %s,' % e(name),
            'Your doctor verification was not approved, or your access was withdrawn. Sign in to see the reason.'], ('Sign in', url))
    elif template in ('appointment_requested', 'appointment_confirmed', 'appointment_declined'):
        doctor, when = _clean(ctx['doctor_name'], 60), _clean(ctx['when'], 40)
        url = _link('/doctors')
        if template == 'appointment_requested':
            subject = 'Appointment request received (%s)' % when
            line = 'Status: Pending. The doctor has NOT confirmed it yet. We will email you when they respond.'
            if ctx.get('has_report'):
                line += ' Your report is attached to this request; only this doctor can view it.'
            title = 'Appointment requested'
        elif template == 'appointment_confirmed':
            subject = '%s confirmed your appointment (%s)' % (doctor, when)
            line = 'Status: Confirmed. Sign in to see any note from the doctor.'
            title = 'Appointment confirmed'
        else:
            subject = '%s could not take your appointment (%s)' % (doctor, when)
            line = 'Status: Declined. Please sign in to choose another time or doctor.'
            title = 'Appointment declined'
        text = ('Hi %s,\n\nYour appointment with %s on %s.\n%s\n\nView your appointments: %s\n\n'
                'For your privacy this email contains no health information.\n' % (name, doctor, when, line, url))
        htm = _wrap_html(title, ['Hi %s,' % e(name), 'Your appointment with <strong>%s</strong> on <strong>%s</strong>.' % (e(doctor), e(when)), e(line)],
                         ('View my appointments', url))
    elif template == 'appointment_rescheduled':
        when, old = _clean(ctx['when'], 40), _clean(ctx['old_when'], 40)
        url = _link('/doctor/appointments')
        subject = 'Appointment moved to %s (needs your confirmation)' % when
        line = 'A patient moved their appointment from %s to %s. It is Pending again: please confirm or decline the new time.' % (old, when)
        text = 'Hi %s,\n\n%s\n\nOpen your appointments: %s\n\nFor privacy this email contains no patient or health information.\n' % (name, line, url)
        htm = _wrap_html('Appointment rescheduled', ['Hi %s,' % e(name), e(line)], ('Open my appointments', url))
    elif template == 'appointment_reminder':
        when, kind = _clean(ctx['when'], 40), _clean(ctx.get('type'), 12) or 'appointment'
        url = _link('/doctor/appointments' if ctx.get('for_doctor') else '/doctors')
        who = 'with a patient' if ctx.get('for_doctor') else 'with %s' % _clean(ctx['doctor_name'], 60)
        subject = 'Reminder: appointment %s on %s' % (who, when)
        line = 'Reminder: you have a confirmed %s appointment %s on %s.' % (kind, who, when)
        text = 'Hi %s,\n\n%s\n\nDetails: %s\n\nFor privacy this email contains no health information.\n' % (name, line, url)
        htm = _wrap_html('Appointment reminder', ['Hi %s,' % e(name), e(line)], ('View appointment', url))
    elif template == 'appointment_completed':
        doctor, when = _clean(ctx['doctor_name'], 60), _clean(ctx['when'], 40)
        url = _link('/doctors')
        note = 'The doctor left a follow-up note for you. Sign in to read it.' if ctx.get('has_note') else 'Sign in to see the details.'
        subject = '%s marked your appointment completed (%s)' % (doctor, when)
        text = ('Hi %s,\n\n%s marked your appointment on %s as completed.\n%s\n\nView your appointments: %s\n\n'
                'For your privacy this email contains no health information.\n' % (name, doctor, when, note, url))
        htm = _wrap_html('Appointment completed', ['Hi %s,' % e(name), '<strong>%s</strong> marked your appointment on <strong>%s</strong> as completed.' % (e(doctor), e(when)), e(note)],
                         ('View my appointments', url))
    elif template in ('appointment_new', 'appointment_cancelled'):
        when = _clean(ctx['when'], 40)
        url = _link('/doctor/appointments')
        if template == 'appointment_new':
            subject, line, title = 'New appointment request (%s)' % when, 'A patient requested an appointment on %s.%s Please confirm or decline it.' % (when, ' A report is attached for you to review.' if ctx.get('has_report') else ''), 'New appointment request'
        else:
            subject, line, title = 'Appointment cancelled (%s)' % when, 'A patient cancelled their appointment on %s.' % when, 'Appointment cancelled'
        text = 'Hi %s,\n\n%s\n\nOpen your appointments: %s\n\nFor privacy this email contains no patient or health information.\n' % (name, line, url)
        htm = _wrap_html(title, ['Hi %s,' % e(name), e(line)], ('Open my appointments', url))
    elif template == 'password_reset':
        url = ctx['link']
        subject = 'Reset your %s password' % BRAND
        text = ('Hi %s,\n\nUse this link within 1 hour to choose a new password:\n%s\n\n'
                'If you did not ask for this, ignore this email; your password will not change.\n' % (name, url))
        htm = _wrap_html('Reset your password', [
            'Hi %s,' % e(name), 'Use the button below within 1 hour to choose a new password.',
            'If you did not ask for this, ignore this email. Your password will not change.'], ('Choose a new password', url))
    else:
        raise ValueError('unknown email template: %s' % template)
    return subject, text, htm


# --------------------------------------------------------------- delivery
def _smtp_send(cfg, msg):
    host, port, security = cfg['SMTP_HOST'], int(cfg['SMTP_PORT']), cfg['SMTP_SECURITY']
    ctx = ssl.create_default_context()
    if security == 'ssl':
        server = smtplib.SMTP_SSL(host, port, timeout=15, context=ctx)
    else:
        server = smtplib.SMTP(host, port, timeout=15)
    with server:
        if security == 'starttls':
            server.starttls(context=ctx)
        if cfg.get('SMTP_USER'):
            server.login(cfg['SMTP_USER'], cfg['SMTP_PASSWORD'])
        server.send_message(msg)


def _deliver(app, to, template, subject, text, htm, reference):
    from extensions import db
    from models.email_log import EmailLog
    status, error = 'sent', None
    msg = EmailMessage()
    msg['Subject'], msg['From'], msg['To'] = subject, app.config['MAIL_FROM'], to
    msg.set_content(text)
    msg.add_alternative(htm, subtype='html')
    backend = app.config['MAIL_BACKEND']
    try:
        if backend == 'smtp':
            _smtp_send(app.config, msg)
        elif backend == 'memory':
            app.extensions.setdefault('outbox', []).append(msg)
        else:
            status = 'not_configured'
            app.logger.warning('EMAIL NOT SENT (MAIL_BACKEND=console). To=%s Subject=%s', to, subject)
    except Exception as exc:  # network, auth, TLS...
        status, error = 'failed', ('%s: %s' % (type(exc).__name__, exc))[:255]
        app.logger.error('Email to %s failed: %s', to, error)
    try:
        with app.app_context():
            db.session.add(EmailLog(to_email=to, template=template, subject=subject[:200],
                                    related_reference=reference, status=status, error=error))
            db.session.commit()
    except Exception:
        app.logger.exception('Could not record email log')
    return status


def send_template(template, to, ctx, reference=None, sync=False):
    """Queue a notification (or send now with sync=True and get 'sent'/'failed'/'not_configured').
    NEVER raises: callers' actions must not fail because of email."""
    try:
        app = current_app._get_current_object()
        if not to:
            return 'skipped'
        subject, text, htm = render(template, ctx)
        args = (app, to, template, subject, text, htm, reference)
        if sync or app.config.get('MAIL_SYNC'):
            return _deliver(*args)
        threading.Thread(target=_deliver, args=args, daemon=True).start()
        return 'queued'
    except Exception:
        current_app.logger.exception('Could not queue email')
        return 'failed'
