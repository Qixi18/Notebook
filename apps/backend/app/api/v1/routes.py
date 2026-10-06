from fastapi import APIRouter

from app.api.v1 import (
    assistant,
    backup,
    config,
    conversations,
    courses,
    feedback,
    jobs,
    knowledge,
    materials,
    notes,
    terms,
)

router = APIRouter()
for module in (config, courses, materials, jobs, knowledge, notes, assistant, conversations, feedback, backup, terms):
    router.include_router(module.router)
