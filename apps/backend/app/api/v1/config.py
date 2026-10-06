from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.service_checks import check_provider, provider_status
from app.db.database import get_db
from app.db.models import ProviderCall
from app.parsers.ocr import status as ocr_status
from app.schemas.api import ProviderCallRead

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "notebook-backend"}



@router.get("/web-search/status")
def get_web_search_status() -> dict[str, str | bool]:
    state = provider_status("tavily")
    return {"configured": state["configured"], "provider": "Tavily", "status": state["status"]}



@router.get("/config/status")
def get_config_status() -> dict:
    result = {provider: provider_status(provider) for provider in ("deepseek", "embedding", "tavily")}
    result["ocr"] = ocr_status()
    return result


@router.get("/config/capabilities")
def get_capabilities() -> dict:
    return {
        "allowed_extensions": list(settings.allowed_extensions),
        "max_upload_bytes": settings.max_upload_bytes,
        "max_pages": settings.max_pages,
        "ocr": ocr_status(),
    }


@router.get("/ocr/status")
def get_ocr_status() -> dict:
    return ocr_status()



@router.post("/config/check/{provider}")
def check_config_provider(provider: str, db: Session = Depends(get_db)) -> dict:
    if provider == "ocr":
        return ocr_status()
    if provider not in ("deepseek", "embedding", "tavily"):
        raise HTTPException(status_code=404, detail="服务类型不存在")
    return check_provider(provider, db)


@router.get("/config/diagnostics")
def get_diagnostics(db: Session = Depends(get_db)) -> dict:
    """Return actionable local capability state without exposing environment secrets."""
    return {
        "data_dir": str(settings.data_dir),
        "database": str(settings.data_dir / "notebook.sqlite3"),
        "originals_dir": str(settings.originals_dir),
        "providers": get_config_status(),
        "limits": {
            "max_upload_bytes": settings.max_upload_bytes,
            "max_pages": settings.max_pages,
            "allowed_extensions": list(settings.allowed_extensions),
        },
        "security": {
            "bind_address": "127.0.0.1 (configured by local dev script)",
            "secrets_in_response": False,
            "backup_excludes_env": True,
        },
        "provider_calls": _provider_call_summary(db),
    }


def _provider_call_summary(db: Session, limit: int = 20) -> list[dict]:
    calls = list(db.scalars(
        select(ProviderCall)
        .order_by(ProviderCall.created_at.desc())
        .limit(limit)
    ).all())
    return [ProviderCallRead.model_validate(call).model_dump(mode="json") for call in calls]


@router.get("/config/provider-calls", response_model=list[ProviderCallRead])
def list_provider_calls(limit: int = 50, db: Session = Depends(get_db)) -> list[ProviderCall]:
    bounded_limit = max(1, min(limit, 200))
    return list(db.scalars(
        select(ProviderCall)
        .order_by(ProviderCall.created_at.desc())
        .limit(bounded_limit)
    ).all())
