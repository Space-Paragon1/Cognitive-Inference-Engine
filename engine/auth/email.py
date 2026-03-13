"""
Email utilities for auth flows (password reset, etc.).

Configure via environment variables:
  SMTP_HOST      default: smtp.gmail.com
  SMTP_PORT      default: 587
  SMTP_USER      your Gmail address (or other SMTP account)
  SMTP_PASSWORD  Gmail app password  (Settings → Security → App passwords)
  APP_URL        public URL of the app, e.g. https://your-app.railway.app
"""

from __future__ import annotations

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def _cfg(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


def send_password_reset(to_email: str, reset_token: str) -> None:
    """Send a password-reset email. Raises if SMTP is not configured."""
    smtp_user = _cfg("SMTP_USER")
    smtp_password = _cfg("SMTP_PASSWORD")

    if not smtp_user or not smtp_password:
        raise RuntimeError(
            "SMTP_USER and SMTP_PASSWORD environment variables must be set to send emails."
        )

    smtp_host = _cfg("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(_cfg("SMTP_PORT", "587"))
    app_url = _cfg("APP_URL", "http://localhost:5173").rstrip("/")

    reset_link = f"{app_url}?reset_token={reset_token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your Cognitive Load Router password"
    msg["From"] = smtp_user
    msg["To"] = to_email

    text_body = f"""\
You requested a password reset for your Cognitive Load Router account.

Click the link below to set a new password (valid for 1 hour):

{reset_link}

If you did not request this, you can safely ignore this email.
"""

    html_body = f"""\
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#0d0d1f;color:#e8e8ff;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#13132b;border-radius:16px;
              padding:32px;border:1px solid #1e1e3a;">
    <h2 style="color:#a0a0ff;margin-top:0;">Reset your password</h2>
    <p>You requested a password reset for your <strong>Cognitive Load Router</strong> account.</p>
    <p>Click the button below to set a new password.
    This link is valid for <strong>1 hour</strong>.</p>
    <a href="{reset_link}"
       style="display:inline-block;margin:16px 0;padding:12px 28px;
              background:#4a4af0;color:#fff;border-radius:10px;
              text-decoration:none;font-weight:700;">
      Reset Password
    </a>
    <p style="font-size:12px;color:#6666aa;">
      If you did not request this, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
"""

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.ehlo()
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, to_email, msg.as_string())
