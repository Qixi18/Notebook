from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.v1.terms import explain_term
from app.db.database import Base
from app.db.models import Course, Material, MaterialPage, PageBlock, RetrievalChunk
from app.schemas.terms import TermExplanationRequest


def test_term_explanation_uses_course_source_when_available():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        course = Course(name="术语课程")
        db.add(course)
        db.flush()
        material = Material(
            course_id=course.id, lecture_title="第一讲", original_filename="a.pptx",
            stored_filename="a.pptx", size_bytes=1, status="completed", page_count=1,
        )
        db.add(material)
        db.flush()
        page = MaterialPage(material_id=material.id, page_number=1, raw_text="依赖注入")
        db.add(page)
        db.flush()
        block = PageBlock(page_id=page.id, block_type="text", content="依赖注入让对象获得依赖", position=0)
        db.add(block)
        db.flush()
        db.add(RetrievalChunk(course_id=course.id, page_block_id=block.id, text=block.content))
        db.commit()

        result = explain_term(course.id, TermExplanationRequest(term="依赖注入"), db)
        assert result.uncertain is False
        assert result.sources[0].lecture_title == "第一讲"
        assert "依赖注入" in result.sources[0].snippet
