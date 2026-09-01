"""
Upload validation + safe file storage helpers.
"""
import os
import re
import uuid

from fastapi import HTTPException, UploadFile

from app.config import settings


def sanitize_filename(filename: str) -> str:
    name = os.path.basename(filename or "upload")
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    return name[-100:]  # cap length


def validate_upload(file: UploadFile, size_bytes: int) -> str:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in settings.ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: jpg, jpeg, png, pdf.",
        )
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if size_bytes > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size is {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )
    return ext


def save_upload(file: UploadFile, content: bytes) -> str:
    ext = os.path.splitext(file.filename or "")[1].lower()
    safe_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(settings.UPLOAD_DIR, safe_name)
    with open(dest_path, "wb") as f:
        f.write(content)
    return safe_name
