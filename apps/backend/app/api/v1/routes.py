from fastapi import APIRouter

from app.api.v1 import assistant, config, courses, jobs, knowledge, materials, notes

router = APIRouter()
for module in (config, courses, materials, jobs, knowledge, notes, assistant):
    router.include_router(module.router)
