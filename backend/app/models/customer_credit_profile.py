from sqlalchemy import Column, Integer, Numeric, String, ForeignKey, DateTime, Boolean, func
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base


class CustomerCreditProfile(Base):
    """
    Profil kredit customer untuk tracking payment history dan scoring.
    Digunakan untuk determine credit limit dan risk assessment.
    """
    __tablename__ = "customer_credit_profile"

    kd_profile = Column(Integer, primary_key=True, index=True)
    kd_client = Column(Integer, ForeignKey("client.kd_client", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    credit_limit = Column(Numeric(15, 2), nullable=True)  # Limit cicilan maksimal per customer
    total_outstanding = Column(Numeric(15, 2), default=0)  # Total cicilan yang belum dibayar
    payment_score = Column(Numeric(5, 2), default=100)  # Score 0-100 (100 = sempurna)
    total_transaksi = Column(Integer, default=0)  # Berapa kali beli
    total_bayar_tepat = Column(Integer, default=0)  # Berapa kali bayar tepat waktu
    total_telat = Column(Integer, default=0)  # Berapa kali telat
    is_blacklist = Column(Boolean, default=False, index=True)
    alasan_blacklist = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    client = relationship("Client", back_populates="credit_profile")

    def calculate_payment_score(self):
        """
        Hitung payment score berdasarkan:
        - 100 - (total_telat * 5)
        Score bisa turun jika sering telat
        """
        if self.total_transaksi == 0:
            return 100
        
        on_time_percentage = (self.total_bayar_tepat / self.total_transaksi) * 100 if self.total_transaksi > 0 else 0
        
        # Score = on_time_percentage
        score = on_time_percentage
        
        # Bonus jika selalu tepat waktu
        if self.total_telat == 0 and self.total_transaksi > 0:
            score = min(100, score + 10)
        
        return score
