import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.database import Base
from app.db.models import Course, KnowledgeNode, Note
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
