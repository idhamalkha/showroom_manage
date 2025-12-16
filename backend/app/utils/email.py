import os
import logging
import base64
from typing import List, Optional

logger = logging.getLogger(__name__)

try:
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders
except Exception:
    smtplib = None

try:
    import requests
except Exception:
    requests = None


def _send_via_smtp(to_email: str, subject: str, html_body: str, from_email: str, attachments: Optional[List[dict]] = None):
    if not smtplib:
        raise RuntimeError('smtplib not available in environment')
    host = os.getenv('SMTP_HOST')
    port = int(os.getenv('SMTP_PORT') or 0)
    user = os.getenv('SMTP_USER')
    password = os.getenv('SMTP_PASS')
    default_from = os.getenv('SMTP_FROM')

    if not host or not port or not user or not password:
        raise RuntimeError('SMTP not configured. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS environment variables.')

    from_addr = from_email or default_from or user

    msg = MIMEMultipart()
    msg['Subject'] = subject
    msg['From'] = from_addr
    msg['To'] = to_email
    msg.attach(MIMEText(html_body, 'html'))

    # attachments: list of dicts {filename, content(bytes), mime}
    if attachments:
        for a in attachments:
            part = MIMEBase('application', 'octet-stream')
            part.set_payload(a['content'])
            encoders.encode_base64(part)
            part.add_header('Content-Disposition', f'attachment; filename="{a.get("filename","attachment")}"')
            msg.attach(part)

    # If port is 465 we assume SSL, otherwise use STARTTLS
    try:
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=30)
        else:
            server = smtplib.SMTP(host, port, timeout=30)
            server.ehlo()
            server.starttls()
        server.login(user, password)
        server.sendmail(from_addr, [to_email], msg.as_string())
        server.quit()
    except Exception as e:
        logger.exception('SMTP send failed to %s subject=%s: %s', to_email, subject, str(e))
        raise


def _send_via_sendgrid(to_email: str, subject: str, html_body: str, from_email: str, attachments: Optional[List[dict]] = None):
    """Send using SendGrid Web API if SENDGRID_API_KEY is configured."""
    api_key = os.getenv('SENDGRID_API_KEY')
    if not api_key:
        raise RuntimeError('SENDGRID_API_KEY not configured')
    if not requests:
        raise RuntimeError('requests library is required for SendGrid integration')

    url = 'https://api.sendgrid.com/v3/mail/send'
    from_addr = from_email or os.getenv('SMTP_FROM') or os.getenv('SENDGRID_FROM')
    if not from_addr:
        from_addr = os.getenv('SMTP_USER')

    payload = {
        'personalizations': [{'to': [{'email': to_email}]}],
        'from': {'email': from_addr},
        'subject': subject,
        'content': [{'type': 'text/html', 'value': html_body}]
    }
    if attachments:
        payload['attachments'] = []
        for a in attachments:
            b64 = base64.b64encode(a['content']).decode('ascii')
            payload['attachments'].append({'content': b64, 'type': a.get('mime', 'application/octet-stream'), 'filename': a.get('filename', 'attachment')})

    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    r = requests.post(url, json=payload, headers=headers, timeout=30)
    if not (200 <= r.status_code < 300):
        raise RuntimeError(f'SendGrid API returned {r.status_code}: {r.text}')


def send_email(to_email: str, subject: str, html_body: str, from_email: Optional[str] = None, attachments: Optional[List[dict]] = None):
    """Send email either via SendGrid (if configured) or fall back to SMTP.

    attachments: list of {filename, content(bytes), mime}
    """
    # Prefer SendGrid if API key exists
    try:
        if os.getenv('SENDGRID_API_KEY'):
            logger.debug('Sending email via SendGrid to %s (subject=%s)', to_email, subject)
            _send_via_sendgrid(to_email, subject, html_body, from_email, attachments)
            return

        logger.debug('Sending email via SMTP to %s (subject=%s)', to_email, subject)
        _send_via_smtp(to_email, subject, html_body, from_email, attachments)
    except Exception as e:
        # Log details but avoid logging secrets. Include recipient, subject and attachment filenames.
        try:
            attach_names = [a.get('filename') for a in (attachments or [])]
        except Exception:
            attach_names = None
        logger.exception('Failed to send email to %s subject=%s attachments=%s: %s', to_email, subject, attach_names, str(e))
        raise
