from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base


class EmailLog(Base):
    """
    Log untuk tracking semua email yang dikirim.
    Berguna untuk audit trail dan debugging.
    """
    __tablename__ = "email_log"

    kd_email = Column(Integer, primary_key=True, autoincrement=True, index=True)
    kd_schedule = Column(Integer, ForeignKey("cicilan_schedule.kd_schedule", ondelete="CASCADE"), nullable=True, index=True)
    kd_client = Column(Integer, ForeignKey("client.kd_client", ondelete="CASCADE"), nullable=True, index=True)
    recipient_email = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    email_type = Column(String(50), nullable=False)  # reminder, overdue_notice, payment_received, etc
    status = Column(String(50), default='pending', index=True)  # pending, sent, failed, bounced
    sent_at = Column(DateTime, nullable=True)
    opened_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now, index=True)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    schedule = relationship("CicilanSchedule", foreign_keys=[kd_schedule])
    client = relationship("Client", foreign_keys=[kd_client])
