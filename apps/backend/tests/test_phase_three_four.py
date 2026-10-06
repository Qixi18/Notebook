from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base, get_db
from app.db.models import Course, Material
from app.main import app
from app.services.backup import create_backup_archive, preview_backup, restore_backup_to_empty


def test_persistent_conversation_feedback_and_proposal(tmp_path):
    engine = create_engine(f"sqlite:///{(tmp_path / 'phase34.sqlite3').as_posix()}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)

    def override_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    try:
        client = TestClient(app)
        course = client.post("/api/v1/courses", json={"name": "阶段三四测试"}).json()
        conversation = client.post(
            f"/api/v1/courses/{course['id']}/conversations", json={"title": "连续追问"}
        ).json()
        answer = client.post(
            f"/api/v1/conversations/{conversation['id']}/messages",
            json={"question": "课程里现在有什么内容？", "allow_web": False, "idempotency_key": "q-1"},
        )
        assert answer.status_code == 201, answer.text
        assert answer.json()["status"] == "completed"
        repeated = client.post(
            f"/api/v1/conversations/{conversation['id']}/messages",
            json={"question": "课程里现在有什么内容？", "allow_web": False, "idempotency_key": "q-1"},
        )
        assert repeated.status_code == 201
        assert repeated.json()["id"] == answer.json()["id"]
        feedback = client.post(
            f"/api/v1/courses/{course['id']}/feedback",
            json={"target_type": "assistant_message", "target_id": answer.json()["id"], "category": "helpful"},
        )
        assert feedback.status_code == 201
        assert client.post(
            f"/api/v1/courses/{course['id']}/feedback",
            json={"target_type": "assistant_message", "target_id": answer.json()["id"], "category": "helpful"},
        ).json()["id"] == feedback.json()["id"]
        with factory() as db:
            from app.knowledge.proposals import create_knowledge_proposal

            proposal = create_knowledge_proposal(
                db, course_id=course["id"], material_id=None, candidate_name="待确认概念",
                candidate_summary="需要人工确认的摘要", kind="deepen", confidence=0.65,
                rationale="名称相似但不能自动合并",
            )
            db.commit()
            proposal_id = proposal.id
        reviewed = client.post(
            f"/api/v1/knowledge-proposals/{proposal_id}/review",
            json={"decision": "reject", "note": "测试拒绝"},
        )
        assert reviewed.status_code == 200
        assert reviewed.json()["status"] == "rejected"
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_backup_package_round_trip(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    engine = create_engine(f"sqlite:///{(data_dir / 'notebook.sqlite3').as_posix()}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    originals = data_dir / "originals"
    originals.mkdir()
    (originals / "lesson.pptx").write_bytes(b"synthetic lesson")
    with factory() as db:
        course = Course(name="备份测试")
        db.add(course)
        db.flush()
        db.add(Material(
            course_id=course.id, lecture_title="第一讲", original_filename="lesson.pptx",
            stored_filename="lesson.pptx", media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            size_bytes=16, status="completed", page_count=1,
        ))
        db.commit()
    archive = tmp_path / "lesson.notebuddy.zip"
    manifest = create_backup_archive(data_dir, archive)
    assert manifest["format"] == 2
    preview = preview_backup(archive)
    assert preview["valid"] is True
    restored = tmp_path / "restored"
    restore_backup_to_empty(archive, restored)
    assert (restored / "notebook.sqlite3").is_file()
    assert (restored / "originals" / "lesson.pptx").read_bytes() == b"synthetic lesson"
