import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.database import Base
from app.db.models import Course, KnowledgeNode, Note, NoteSuggestion
from app.knowledge.extractor import ensure_note
from app.notes.service import NoteEditConflict, update_note_as_user
from app.retrieval.service import query_terms


def test_query_terms_supports_chinese_phrases() -> None:
    terms = query_terms("导数的公式是什么？")

    assert "导数" in terms
    assert "公式" in terms
    assert "导数的公式是什么" in terms


def test_user_edit_locks_note_and_checks_revision() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as db:
        course = Course(name="测试课程")
        db.add(course)
        db.flush()
        node = KnowledgeNode(course_id=course.id, name="测试知识点")
        db.add(node)
        db.flush()
        note = Note(
            course_id=course.id,
            knowledge_node_id=node.id,
            title="测试笔记",
            content_markdown="# 草稿",
        )
        db.add(note)
        db.commit()

        updated = update_note_as_user(db, note, "# 用户版本", expected_revision_number=1)
        assert updated.content_markdown == "# 用户版本"
        assert updated.content_origin == "user"
        assert updated.user_locked is True
        assert updated.revision_number == 2
        assert len(updated.revisions) == 1

        with pytest.raises(NoteEditConflict):
            update_note_as_user(db, updated, "# 过期内容", expected_revision_number=1)


def test_reparse_creates_note_suggestion_without_overwriting_existing_body() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as db:
        course = Course(name="建议保护课程")
        db.add(course)
        db.flush()
        node = KnowledgeNode(course_id=course.id, name="已有知识点")
        db.add(node)
        db.flush()
        note = Note(
            course_id=course.id,
            knowledge_node_id=node.id,
            title="已有知识点",
            content_markdown="# 用户正在编辑的正文",
            user_locked=True,
            content_origin="user",
            revision_number=2,
        )
        db.add(note)
        db.commit()

        ensure_note(db, course.id, node, "# 新的 AI 草稿", [])
        ensure_note(db, course.id, node, "# 新的 AI 草稿", [])
        db.commit()
        db.refresh(note)

        assert note.content_markdown == "# 用户正在编辑的正文"
        suggestions = list(db.query(NoteSuggestion).filter_by(note_id=note.id).all())
        assert len(suggestions) == 1
        assert suggestions[0].status == "pending"
