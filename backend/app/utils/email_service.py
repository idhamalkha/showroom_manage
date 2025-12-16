import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class EmailService:
    """
    Service untuk mengirim email via SMTP.
    Supports: Gmail, SendGrid SMTP, atau SMTP server lainnya.
    """

    def __init__(self):
        self.smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', 587))
        self.sender_email = os.getenv('SENDER_EMAIL')
        self.sender_password = os.getenv('SENDER_PASSWORD')
        self.sender_name = os.getenv('SENDER_NAME', 'Showroom Finance')

    def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        is_html: bool = True
    ) -> Dict:
        """
        Kirim email ke recipient.

        Args:
            to_email: Email tujuan
            subject: Subject email
            body: Isi email (HTML atau plain text)
            is_html: Apakah body adalah HTML

        Returns:
            {
                "success": bool,
                "message": str,
                "sent_at": str (ISO format),
                "error": str (jika failed)
            }
        """
        try:
            # Validate email format
            if not self._validate_email(to_email):
                return {
                    "success": False,
                    "message": "Invalid email format",
                    "error": f"Email tidak valid: {to_email}"
                }

            # Validate sender credentials
            if not self.sender_email or not self.sender_password:
                logger.error("Email credentials not configured")
                return {
                    "success": False,
                    "message": "Email service not configured",
                    "error": "SENDER_EMAIL atau SENDER_PASSWORD tidak diatur"
                }

            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.sender_name} <{self.sender_email}>"
            msg['To'] = to_email

            # Attach body
            part = MIMEText(body, 'html' if is_html else 'plain', _charset='utf-8')
            msg.attach(part)

            # Send via SMTP
            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=10) as server:
                server.starttls()
                server.login(self.sender_email, self.sender_password)
                server.send_message(msg)

            sent_at = datetime.now().isoformat()
            logger.info(f"✅ Email sent to {to_email} | Subject: {subject}")
            
            return {
                "success": True,
                "message": "Email sent successfully",
                "sent_at": sent_at
            }

        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"❌ SMTP Authentication failed: {str(e)}")
            return {
                "success": False,
                "message": "Email service authentication failed",
                "error": "Username atau password email salah"
            }
        except smtplib.SMTPException as e:
            logger.error(f"❌ SMTP error: {str(e)}")
            return {
                "success": False,
                "message": "Email service error",
                "error": str(e)
            }
        except Exception as e:
            logger.error(f"❌ Failed to send email to {to_email}: {str(e)}")
            return {
                "success": False,
                "message": "Failed to send email",
                "error": str(e)
            }

    @staticmethod
    def _validate_email(email: str) -> bool:
        """
        Validasi format email sederhana.
        """
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None


# Singleton instance
email_service = EmailService()
