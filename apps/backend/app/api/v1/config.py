from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.core.service_checks import check_provider, provider_status
from app.parsers.ocr import status as ocr_status

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
    return {provider: provider_status(provider) for provider in ("deepseek", "embedding", "tavily")}


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
def check_config_provider(provider: str) -> dict:
    if provider not in ("deepseek", "embedding", "tavily"):
        raise HTTPException(status_code=404, detail="服务类型不存在")
    return check_provider(provider)
