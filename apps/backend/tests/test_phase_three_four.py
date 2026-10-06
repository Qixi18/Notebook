from __future__ import annotations

import json
import sqlite3
import zipfile
from contextlib import closing
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base, get_db
from app.db.models import Course, Material
from app.main import app
from app.services.backup import create_backup_archive, preview_backup, restore_backup_to_empty
from app.services.restore import replace_data_dir


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
        term = client.post(
            f"/api/v1/courses/{course['id']}/terms/explain",
            json={"term": "dependency injection", "discipline": "软件工程"},
        )
        assert term.status_code == 200
        assert term.json()["uncertain"] is True
        restore_without_confirmation = client.post(
            "/api/v1/backups/restore", files={"file": ("notebook.zip", b"not a backup")}
        )
        assert restore_without_confirmation.status_code == 400
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
            duplicate = create_knowledge_proposal(
                db, course_id=course["id"], material_id=None, candidate_name="待确认概念",
                candidate_summary="重复请求", kind="deepen", confidence=0.65,
                rationale="应复用同一个待确认提案",
            )
            db.commit()
            proposal_id = proposal.id
            assert duplicate.id == proposal_id
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
    (originals / "lesson.pptx").write_bytes(b"changed local file")
    conflict_preview = preview_backup(archive, current_database=data_dir / "notebook.sqlite3")
    assert any("同名但内容不同" in item for item in conflict_preview["conflicts"])
    restored = tmp_path / "restored"
    restore_backup_to_empty(archive, restored)
    assert (restored / "notebook.sqlite3").is_file()
    assert (restored / "originals" / "lesson.pptx").read_bytes() == b"synthetic lesson"


def test_course_backup_contains_only_requested_course(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    engine = create_engine(f"sqlite:///{(data_dir / 'notebook.sqlite3').as_posix()}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    originals = data_dir / "originals"
    originals.mkdir()
    (originals / "one.pptx").write_bytes(b"one")
    (originals / "two.pptx").write_bytes(b"two")
    with factory() as db:
        first = Course(name="课程一")
        second = Course(name="课程二")
        db.add_all([first, second])
        db.flush()
        db.add_all([
            Material(course_id=first.id, lecture_title="第一讲", original_filename="one.pptx", stored_filename="one.pptx", size_bytes=3, status="completed"),
            Material(course_id=second.id, lecture_title="第二讲", original_filename="two.pptx", stored_filename="two.pptx", size_bytes=3, status="completed"),
        ])
        db.commit()
        first_id = first.id
    archive = tmp_path / "course-one.notebuddy.zip"
    manifest = create_backup_archive(data_dir, archive, course_id=first_id)
    assert manifest["course_count"] == 1
    restored = tmp_path / "course-one-restored"
    restore_backup_to_empty(archive, restored)
    with sqlite3.connect(restored / "notebook.sqlite3") as connection:
        assert connection.execute("SELECT COUNT(*) FROM courses").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM materials").fetchone()[0] == 1
    assert (restored / "originals" / "one.pptx").read_bytes() == b"one"
    assert not (restored / "originals" / "two.pptx").exists()


def test_replace_data_dir_keeps_checkpoint(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    engine = create_engine(f"sqlite:///{(data_dir / 'notebook.sqlite3').as_posix()}")
    Base.metadata.create_all(engine)
    originals = data_dir / "originals"
    originals.mkdir()
    (originals / "lesson.pptx").write_bytes(b"lesson")
    with sessionmaker(bind=engine)() as db:
        course = Course(name="原始名称")
        db.add(course)
        db.flush()
        db.add(Material(
            course_id=course.id, lecture_title="第一讲", original_filename="lesson.pptx",
            stored_filename="lesson.pptx", size_bytes=6, status="completed", page_count=1,
        ))
        db.commit()
    package = tmp_path / "replace.notebuddy.zip"
    create_backup_archive(data_dir, package)
    engine.dispose()
    with closing(sqlite3.connect(data_dir / "notebook.sqlite3")) as connection:
        connection.execute("UPDATE courses SET name = '待替换名称'")
        connection.commit()
    result = replace_data_dir(package, data_dir)
    assert result["status"] == "replaced"
    assert result["checkpoint"]
    with closing(sqlite3.connect(data_dir / "notebook.sqlite3")) as connection:
        assert connection.execute("SELECT name FROM courses").fetchone()[0] == "原始名称"
    assert (Path(result["checkpoint"]) / "notebook.sqlite3").is_file()


def test_backup_preview_detects_missing_original_and_unsafe_member(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    engine = create_engine(f"sqlite:///{(data_dir / 'notebook.sqlite3').as_posix()}")
    Base.metadata.create_all(engine)
    originals = data_dir / "originals"
    originals.mkdir()
    (originals / "lesson.pptx").write_bytes(b"synthetic lesson")
    with sessionmaker(bind=engine)() as db:
        course = Course(name="损坏包测试")
        db.add(course)
        db.flush()
        db.add(Material(
            course_id=course.id, lecture_title="第一讲", original_filename="lesson.pptx",
            stored_filename="lesson.pptx", media_type="application/octet-stream",
            size_bytes=16, status="completed", page_count=1,
        ))
        db.commit()
    valid_archive = tmp_path / "valid.zip"
    create_backup_archive(data_dir, valid_archive)
    missing_archive = tmp_path / "missing.zip"
    with zipfile.ZipFile(valid_archive) as source, zipfile.ZipFile(missing_archive, "w") as target:
        for info in source.infolist():
            if info.filename != "originals/lesson.pptx":
                target.writestr(info, source.read(info.filename))
    preview = preview_backup(missing_archive)
    assert preview["valid"] is False
    assert "missing original: lesson.pptx" in preview["errors"]

    unsafe_archive = tmp_path / "unsafe.zip"
    with zipfile.ZipFile(unsafe_archive, "w") as archive:
        archive.writestr("manifest.json", json.dumps({"format": 2, "originals": []}))
        archive.writestr("../escape.txt", b"unsafe")
    try:
        preview_backup(unsafe_archive)
    except ValueError as exc:
        assert "unsafe archive path" in str(exc)
    else:
        raise AssertionError("unsafe archive member was accepted")
