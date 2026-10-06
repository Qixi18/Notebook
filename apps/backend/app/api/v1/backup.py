from __future__ import annotations

import json
import shutil
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.shared import ensure_course
from app.core.config import settings
from app.db.database import get_db
from app.db.models import BackupRecord
from app.schemas.api import BackupExportRequest, BackupPreviewRead, BackupRecordRead
from app.services.backup import create_backup_archive, preview_backup, restore_backup_to_empty

router = APIRouter()


@router.post("/backups/export", response_model=BackupRecordRead, status_code=201)
def export_backup(payload: BackupExportRequest, db: Session = Depends(get_db)) -> BackupRecord:
    if payload.course_id:
        ensure_course(db, payload.course_id)
    record = BackupRecord(course_id=payload.course_id, action="export", status="processing")
    db.add(record)
    db.commit()
    db.refresh(record)
    destination = settings.backups_dir / f"manual-{datetime.now(UTC):%Y%m%dT%H%M%S}-{record.id[:8]}.notebuddy.zip"
    try:
        manifest = create_backup_archive(settings.data_dir, destination, course_id=payload.course_id)
        record.path = str(destination)
        record.status = "completed"
        record.manifest_json = json.dumps(manifest, ensure_ascii=False)
        record.completed_at = datetime.now(UTC)
    except Exception as exc:
        record.status = "failed"
        record.error_message = str(exc)
    db.commit()
    db.refresh(record)
    return record


def _temporary_upload(file: UploadFile) -> Path:
    suffix = Path(file.filename or "backup.zip").suffix.lower()
    if suffix not in {".zip", ".notebuddy"}:
        raise HTTPException(status_code=415, detail="备份必须是 ZIP 文件")
    with tempfile.NamedTemporaryFile(prefix="notebuddy-import-", suffix=".zip", delete=False) as handle:
        path = Path(handle.name)
        try:
            total = 0
            while chunk := file.file.read(1024 * 1024):
                total += len(chunk)
                if total > 2 * 1024 * 1024 * 1024:
                    raise HTTPException(status_code=413, detail="备份文件过大")
                handle.write(chunk)
        except Exception:
            path.unlink(missing_ok=True)
            raise
    return path


@router.post("/backups/preview", response_model=BackupPreviewRead)
def preview_backup_upload(file: UploadFile = File(...)) -> dict:
    path = _temporary_upload(file)
    try:
        try:
            return preview_backup(path, current_database=settings.data_dir / "notebook.sqlite3")
        except Exception as exc:
            return {"valid": False, "errors": [str(exc)], "conflicts": []}
    finally:
        path.unlink(missing_ok=True)


@router.post("/backups/restore", response_model=BackupRecordRead, status_code=202)
def restore_backup_upload(
    file: UploadFile = File(...),
    confirmed: bool = Form(False),
    db: Session = Depends(get_db),
) -> BackupRecord:
    if not confirmed:
        raise HTTPException(status_code=400, detail="请先完成备份预览并确认恢复")
    path = _temporary_upload(file)
    record = BackupRecord(action="restore", status="processing")
    db.add(record)
    db.commit()
    db.refresh(record)
    destination = settings.backups_dir / "restored" / record.id
    try:
        manifest = restore_backup_to_empty(path, destination)
        record.path = str(destination)
        record.status = "validated_to_isolated_directory"
        record.manifest_json = json.dumps(manifest, ensure_ascii=False)
        record.completed_at = datetime.now(UTC)
    except Exception as exc:
        record.status = "failed"
        record.error_message = str(exc)
        shutil.rmtree(destination, ignore_errors=True)
    finally:
        path.unlink(missing_ok=True)
    db.commit()
    db.refresh(record)
    return record


@router.get("/backups/{record_id}", response_model=BackupRecordRead)
def get_backup_record(record_id: str, db: Session = Depends(get_db)) -> BackupRecord:
    record = db.get(BackupRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="备份记录不存在")
    return record


@router.get("/courses/{course_id}/backups", response_model=list[BackupRecordRead])
def list_course_backups(course_id: str, db: Session = Depends(get_db)) -> list[BackupRecord]:
    ensure_course(db, course_id)
    return list(db.scalars(select(BackupRecord).where(BackupRecord.course_id == course_id).order_by(BackupRecord.created_at.desc())).all())
