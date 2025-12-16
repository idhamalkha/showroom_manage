from dotenv import load_dotenv
import os
import warnings
import logging

# Suppress Pydantic v2 warnings about orm_mode -> from_attributes
warnings.filterwarnings('ignore', category=UserWarning, module='pydantic')
# Suppress WeasyPrint warnings
warnings.filterwarnings('ignore', message='.*WeasyPrint.*')

# Suppress WeasyPrint stderr messages by redirecting logging
logging.getLogger('weasyprint').setLevel(logging.ERROR)

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from .routes import auth, sales, hrd, finance, client, owner, gaji, jabatan
from .database.connection import engine, Base
from .database.connection import get_db
import uvicorn
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError, DataError, IntegrityError
# Import all models to ensure they are registered with SQLAlchemy Base
from . import models
import asyncio
import logging

# Setup logging
logger = logging.getLogger(__name__)

from app.routes.kontrak import router as kontrak_router
from app.routes.upload import router as upload_router
from app.routes.cuti_histori import router as cuti_router
from app.routes.transaksi_detail import router as transaksi_detail_router
from app.routes.target_sales import router as target_sales_router
from app.routes.payroll import router as payroll_router
from app.routes.payroll_bulanan import router as payroll_bulanan_router
from app.routes.lembur_histori import router as lembur_router
from app.routes.merek import router as merek_router
from app.routes.kelas_mobil import router as kelas_mobil_router
from app.routes.mobil_warna import router as mobil_warna_router
from app.routes.cicilan import router as cicilan_router
from app.routes.customer_credit import router as customer_credit_router
from app.routes.notifikasi import router as notifikasi_router
from app.routes.absensi import router as absensi_router
from app.services.background_tasks import auto_absent_scheduler, payroll_bulanan_scheduler

app = FastAPI(
    title="Car Dealership API",
    description="Backend API for Car Dealership Management System",
    version="1.0.0",
    openapi_tags=[
        {"name": "auth", "description": "Authentication operations"},
        {"name": "sales", "description": "Sales operations"},
        {"name": "hrd", "description": "HR operations"},
        {"name": "finance", "description": "Finance operations"},
        {"name": "client", "description": "Client operations"},
        {"name": "owner", "description": "Owner operations"}
    ]
)

# global DB exception handler -> return user friendly error for bad input / DB issues
@app.exception_handler(DataError)
async def data_error_handler(request: Request, exc: DataError):
    return JSONResponse(status_code=400, content={"detail": "Invalid data format / invalid date value"})

@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    return JSONResponse(status_code=400, content={"detail": "Integrity error: likely duplicate or foreign key violation"})

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError):
    # generic DB error
    return JSONResponse(status_code=500, content={"detail": "Database error"})

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

app.swagger_ui_init_oauth = {
    "usePkceWithAuthorizationCodeGrant": True,
    "clientId": "swagger",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

# optionally extend openapi_tags (append these entries)
app.openapi_tags.extend([
    {"name": "cuti", "description": "Cuti histori operations"},
    {"name": "transaksi", "description": "Transaksi detail operations"},
    {"name": "sales", "description": "Sales / target operations"},
    {"name": "payroll", "description": "Payroll operations"},
    {"name": "lembur", "description": "Lembur histori operations"},
])

# include routers — router sendiri sudah memiliki prefix/tag
app.include_router(auth.router)
app.include_router(sales.router)
app.include_router(hrd.router)
app.include_router(finance.router)
app.include_router(client.router)
app.include_router(owner.router)
app.include_router(gaji.router)
app.include_router(jabatan.router)
app.include_router(kontrak_router)
app.include_router(upload_router)
app.include_router(cuti_router)
app.include_router(transaksi_detail_router)
app.include_router(target_sales_router)
app.include_router(payroll_router)
app.include_router(payroll_bulanan_router)
app.include_router(lembur_router)
app.include_router(merek_router)
app.include_router(kelas_mobil_router)
app.include_router(mobil_warna_router)
app.include_router(cicilan_router)
app.include_router(customer_credit_router)
app.include_router(notifikasi_router)
app.include_router(absensi_router)

@app.on_event("startup")
async def startup_event():
    """Jalankan background tasks saat aplikasi startup"""
    logger.info("Application startup - starting background schedulers")
    
    # Create background task untuk auto-absent
    asyncio.create_task(auto_absent_scheduler())
    logger.info("Auto-absent scheduler started")
    
    # Create background task untuk payroll bulanan
    asyncio.create_task(payroll_bulanan_scheduler())
    logger.info("Payroll bulanan scheduler started")

@app.get("/")
def read_root():
    return {"message": "Welcome to Car Dealership API"}

if __name__ == "__main__":
    # jalankan memakai module path yang konsisten dari project root
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)