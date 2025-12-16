from pydantic import BaseModel
from typing import Optional
from datetime import date

class MessageResponse(BaseModel):
    message: str

class DeleteResponse(BaseModel):
    message: str