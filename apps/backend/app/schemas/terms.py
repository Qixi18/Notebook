from __future__ import annotations

from pydantic import BaseModel, Field


class TermExplanationRequest(BaseModel):
    term: str = Field(min_length=1, max_length=200)
    discipline: str | None = Field(default=None, max_length=100)
    context: str | None = Field(default=None, max_length=1000)


class TermExplanationSource(BaseModel):
    material_id: str
    lecture_title: str
    page_number: int
    location_label: str | None = None
    snippet: str


class TermExplanationResponse(BaseModel):
    original: str
    common_translations: list[str]
    discipline: str | None
    explanation: str
    source_note: str
    uncertain: bool
    sources: list[TermExplanationSource] = Field(default_factory=list)
