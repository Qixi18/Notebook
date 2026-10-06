from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.database import Base
from app.db.models import Course, Material, MaterialPage, PageBlock, RetrievalChunk, SourceRef
from app.retrieval.evaluation import RetrievalExample, evaluate
from app.retrieval.service import retrieve


def test_retrieval_returns_source_id_and_evaluation_metrics():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as db:
        course = Course(name="检索评测课程")
        db.add(course)
        db.flush()
        material = Material(
            course_id=course.id,
            lecture_title="第一讲",
            original_filename="lesson.pptx",
            stored_filename="lesson.pptx",
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            size_bytes=10,
            status="completed",
            page_count=1,
        )
        db.add(material)
        db.flush()
        page = MaterialPage(
            material_id=material.id,
            page_number=1,
            title="导数",
            raw_text="导数的定义",
            location_label="第 1 页",
        )
        db.add(page)
        db.flush()
        block = PageBlock(
            page_id=page.id,
            block_type="text",
            content="导数描述函数变化率",
            position=0,
            location_label="第 1 页 · 正文",
        )
        db.add(block)
        db.flush()
        source = SourceRef(
            page_block_id=block.id,
            source_type="course_material",
            quote=block.content,
            target_label=block.location_label,
        )
        db.add(source)
        db.add(RetrievalChunk(course_id=course.id, page_block_id=block.id, text=block.content))
        db.commit()

        results = retrieve(db, course_id=course.id, question="导数变化率")
        assert results and results[0].source_ref_id == source.id

        report = evaluate(
            db,
            course_id=course.id,
            examples=[RetrievalExample("导数变化率", (1,))],
        )
        assert report["hit_rate"] == 1.0
        assert report["direct_support_rate"] == 1.0
        assert report["latency_ms_p95"] >= 0
        assert report["embedding_mode"] == "keyword"
        assert report["rows"][0]["score_sources"] == ["keyword"]
