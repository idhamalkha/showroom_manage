import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.utils.security import get_current_user
from app.repositories.customer_credit_repository import CustomerCreditRepository

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/finance/customer-credit", tags=["finance-customer-credit"])


@router.get("/profile/{kd_client}")
async def get_credit_profile(
    kd_client: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detail credit profile untuk satu customer.
    Include: credit limit, payment score, payment history summary.
    """
    try:
        repo = CustomerCreditRepository(db)
        profile = repo.get_credit_profile_detail(kd_client)
        return {
            "success": True,
            "data": profile
        }
    except Exception as e:
        logger.error(f"Error getting credit profile: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/payment-history/{kd_client}")
async def get_payment_history(
    kd_client: int,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get payment history untuk satu customer.
    Include: tanggal jatuh tempo, tanggal pembayaran, status, berapa hari telat.
    """
    try:
        repo = CustomerCreditRepository(db)
        history = repo.get_payment_history(kd_client, limit)
        return {
            "success": True,
            "kd_client": kd_client,
            "total_records": len(history),
            "data": history
        }
    except Exception as e:
        logger.error(f"Error getting payment history: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/high-risk-customers")
async def get_high_risk_customers(
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get customers dengan risk tinggi:
    - Payment score rendah
    - Sering telat
    - Blacklist
    Untuk finance staff prioritas follow-up.
    """
    try:
        repo = CustomerCreditRepository(db)
        customers = repo.get_high_risk_customers(limit)
        return {
            "success": True,
            "total_high_risk": len(customers),
            "data": customers
        }
    except Exception as e:
        logger.error(f"Error getting high risk customers: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/credit-limit/{kd_client}")
async def set_credit_limit(
    kd_client: int,
    credit_limit: float,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set credit limit untuk customer"""
    try:
        repo = CustomerCreditRepository(db)
        repo.set_credit_limit(kd_client, credit_limit)
        return {
            "success": True,
            "message": f"Credit limit set to {credit_limit:,.0f} for customer {kd_client}"
        }
    except Exception as e:
        logger.error(f"Error setting credit limit: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/blacklist/{kd_client}")
async def blacklist_customer(
    kd_client: int,
    alasan: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Blacklist customer (e.g., sering telat atau default)"""
    try:
        repo = CustomerCreditRepository(db)
        repo.blacklist_customer(kd_client, alasan)
        return {
            "success": True,
            "message": f"Customer {kd_client} blacklisted"
        }
    except Exception as e:
        logger.error(f"Error blacklisting customer: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/whitelist/{kd_client}")
async def whitelist_customer(
    kd_client: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove blacklist untuk customer"""
    try:
        repo = CustomerCreditRepository(db)
        repo.whitelist_customer(kd_client)
        return {
            "success": True,
            "message": f"Customer {kd_client} whitelisted"
        }
    except Exception as e:
        logger.error(f"Error whitelisting customer: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
