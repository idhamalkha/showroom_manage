from fastapi import APIRouter, UploadFile, HTTPException
import os
from datetime import datetime
import logging
import shutil
from app.utils.github_storage import GitHubStorage

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
storage = GitHubStorage()

@router.post("/api/upload")
async def upload_file(file: UploadFile):
    # Get persistent storage path from environment
    images_path = os.getenv('IMAGES_PATH')
    if not images_path:
        # Fallback to static path if not running from executable
        static_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'static')
        images_path = os.path.join(static_path, 'images')
    
    os.makedirs(images_path, exist_ok=True)
    
    # Create unique filename
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File type not allowed")
        
    filename = f"{timestamp}{file_extension}"
    file_path = os.path.join(images_path, filename)
    
    try:
        # Save file locally
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Upload to GitHub
        github_url = storage.upload_file(file_path)
        
        if not github_url:
            logger.error("Failed to upload to GitHub")
        
        return {
            "filename": filename,
            "github_url": github_url
        }
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))