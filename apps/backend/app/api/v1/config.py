from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.core.service_checks import check_provider, provider_status

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



@router.post("/config/check/{provider}")
def check_config_provider(provider: str) -> dict:
    if provider not in ("deepseek", "embedding", "tavily"):
        raise HTTPException(status_code=404, detail="服务类型不存在")
    return check_provider(provider)
