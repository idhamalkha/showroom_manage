from fastapi import HTTPException, Depends, status
from sqlalchemy.orm import Session
from ..database.connection import get_db
from ..models.karyawan import Karyawan
from .security import get_current_user, oauth2_scheme

async def verify_token(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Karyawan:
    username = await get_current_user(token)
    user = db.query(Karyawan).filter(
        Karyawan.username_karyawan == username
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    return user

def require_role(allowed_roles: list):
    def dependency(current_user = Depends(get_current_user)):
        # Pastikan current_user.jabatan sudah di-load (pakai relationship)
        if not current_user.jabatan or current_user.jabatan.nama_jabatan not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted"
            )
        return current_user
    return Depends(dependency)