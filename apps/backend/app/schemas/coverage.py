from __future__ import annotations

from pydantic import BaseModel


class CoverageLocation(BaseModel):
    page_id: str
    page_number: int
    location_type: str
    location_label: str
    stable_location_key: str | None
    status: str
    citation_count: int
    note_ids: list[str]
    note_titles: list[str]
    warning: str | None


class CoverageRead(BaseModel):
    material_id: str
    total_locations: int
    cited_locations: int
    review_locations: int
    locations: list[CoverageLocation]
