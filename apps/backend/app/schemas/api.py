"""Compatibility exports for the original API schema module."""

from app.schemas.assistant import AssistantRequest, AssistantResponse, AssistantSource
from app.schemas.courses import CourseCreate, CourseRead, DeletionPreview
from app.schemas.coverage import CoverageLocation, CoverageRead
from app.schemas.jobs import JobRead
from app.schemas.knowledge import (
    KnowledgeEdgeRead,
    KnowledgeGraphRead,
    KnowledgeNodeRead,
    KnowledgeNodeSourceRead,
    KnowledgeNodeWithSourcesRead,
)
from app.schemas.materials import (
    MaterialRead,
    PageRead,
    SourceRefRead,
    UploadMaterialResponse,
    WebSourceRead,
)
from app.schemas.notes import NoteRead, NoteRevisionRead, NoteUpdate

__all__ = ['AssistantRequest', 'AssistantResponse', 'AssistantSource', 'CourseCreate', 'CourseRead', 'CoverageLocation', 'CoverageRead', 'DeletionPreview', 'JobRead', 'KnowledgeEdgeRead', 'KnowledgeGraphRead', 'KnowledgeNodeRead', 'KnowledgeNodeSourceRead', 'KnowledgeNodeWithSourcesRead', 'MaterialRead', 'NoteRead', 'NoteRevisionRead', 'NoteUpdate', 'PageRead', 'SourceRefRead', 'UploadMaterialResponse', 'WebSourceRead']
