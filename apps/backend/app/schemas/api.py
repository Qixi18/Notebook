"""Compatibility exports for the original API schema module."""

from app.schemas.assistant import (
    AssistantClaim,
    AssistantRequest,
    AssistantResponse,
    AssistantSource,
)
from app.schemas.backup import (
    BackupExportRequest,
    BackupPreviewRead,
    BackupRecordRead,
    RestoreRequest,
)
from app.schemas.conversations import (
    ConversationCreate,
    ConversationMessageCreate,
    ConversationMessageRead,
    ConversationRead,
    MessageEvidenceRead,
)
from app.schemas.courses import CourseCreate, CourseRead, DeletionPreview
from app.schemas.coverage import CoverageLocation, CoverageRead
from app.schemas.feedback import FeedbackCreate, FeedbackRead
from app.schemas.jobs import JobRead
from app.schemas.knowledge import (
    KnowledgeEdgeRead,
    KnowledgeGraphRead,
    KnowledgeNodeRead,
    KnowledgeNodeSourceRead,
    KnowledgeNodeWithSourcesRead,
)
from app.schemas.materials import (
    BlockRead,
    MaterialRead,
    PageEvidenceRead,
    PageRead,
    SourceRefRead,
    UploadMaterialResponse,
    WebSourceRead,
)
from app.schemas.notes import NoteRead, NoteRevisionRead, NoteUpdate
from app.schemas.proposals import KnowledgeProposalRead, NoteSuggestionRead, ProposalReview
from app.schemas.terms import TermExplanationRequest, TermExplanationResponse

__all__ = [
    'AssistantClaim',
    'AssistantRequest',
    'AssistantResponse',
    'AssistantSource',
    'BackupExportRequest',
    'BackupPreviewRead',
    'BackupRecordRead',
    'BlockRead',
    'ConversationCreate',
    'ConversationMessageCreate',
    'ConversationMessageRead',
    'ConversationRead',
    'CourseCreate',
    'CourseRead',
    'CoverageLocation',
    'CoverageRead',
    'DeletionPreview',
    'FeedbackCreate',
    'FeedbackRead',
    'JobRead',
    'KnowledgeEdgeRead',
    'KnowledgeGraphRead',
    'KnowledgeNodeRead',
    'KnowledgeNodeSourceRead',
    'KnowledgeNodeWithSourcesRead',
    'KnowledgeProposalRead',
    'MaterialRead',
    'MessageEvidenceRead',
    'NoteRead',
    'NoteRevisionRead',
    'NoteSuggestionRead',
    'NoteUpdate',
    'PageEvidenceRead',
    'PageRead',
    'ProposalReview',
    'RestoreRequest',
    'SourceRefRead',
    'TermExplanationRequest',
    'TermExplanationResponse',
    'UploadMaterialResponse',
    'WebSourceRead',
]
