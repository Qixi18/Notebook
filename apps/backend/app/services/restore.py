"""Stopped-service, checkpointed replacement for a validated NoteBuddy package."""

from __future__ import annotations

import argparse
import json
import shutil
import tempfile
import uuid
from datetime import UTC, datetime
from pathlib import Path

from app.services.backup import preview_backup, restore_backup_to_empty


def replace_data_dir(package: Path, data_dir: Path, *, checkpoint: Path | None = None) -> dict:
    """Replace a local data directory after validation, retaining a rollback checkpoint.

    The caller must stop the API and worker first so Windows can rename the SQLite
    directory. The package is copied outside the data directory before the swap,
    which also makes packages stored under ``data/backups`` safe to use.
    """
    package = package.resolve()
    data_dir = data_dir.resolve()
    if not package.is_file():
        raise FileNotFoundError(package)
    preview = preview_backup(
        package,
        current_database=data_dir / "notebook.sqlite3",
    )
    if not preview["valid"]:
        raise ValueError("backup failed validation: " + "; ".join(preview["errors"]))

    parent = data_dir.parent
    parent.mkdir(parents=True, exist_ok=True)
    token = uuid.uuid4().hex[:10]
    checkpoint_dir = (checkpoint or parent / f"{data_dir.name}-checkpoint-{datetime.now(UTC):%Y%m%dT%H%M%S}-{token}").resolve()
    if checkpoint_dir.exists():
        raise FileExistsError(checkpoint_dir)
    if checkpoint_dir == data_dir or data_dir in checkpoint_dir.parents:
        raise ValueError("checkpoint must be outside the active data directory")

    staging_dir = Path(tempfile.mkdtemp(prefix=f"{data_dir.name}-restore-", dir=parent))
    with tempfile.NamedTemporaryFile(prefix="notebuddy-package-", suffix=".zip", dir=parent, delete=False) as handle:
        package_copy = Path(handle.name)
    old_dir = parent / f".{data_dir.name}-rollback-{token}"
    swapped = False
    try:
        shutil.copy2(package, package_copy)
        restore_backup_to_empty(package_copy, staging_dir)
        if data_dir.exists():
            shutil.copytree(data_dir, checkpoint_dir, symlinks=True)
        if data_dir.exists():
            data_dir.rename(old_dir)
            try:
                staging_dir.rename(data_dir)
                swapped = True
            except Exception:
                old_dir.rename(data_dir)
                raise
        else:
            staging_dir.rename(data_dir)
            swapped = True
        shutil.rmtree(old_dir, ignore_errors=True)
        return {
            **preview,
            "data_dir": str(data_dir),
            "checkpoint": str(checkpoint_dir) if checkpoint_dir.exists() else None,
            "status": "replaced",
        }
    finally:
        package_copy.unlink(missing_ok=True)
        if not swapped:
            shutil.rmtree(staging_dir, ignore_errors=True)
            if old_dir.exists() and not data_dir.exists():
                old_dir.rename(data_dir)


def main() -> None:
    parser = argparse.ArgumentParser(description="Replace NoteBuddy data from a validated package")
    parser.add_argument("action", choices=("replace",))
    parser.add_argument("package", type=Path)
    parser.add_argument("--data-dir", required=True, type=Path)
    parser.add_argument("--checkpoint", type=Path)
    args = parser.parse_args()
    result = replace_data_dir(
        args.package.resolve(), args.data_dir.resolve(),
        checkpoint=args.checkpoint.resolve() if args.checkpoint else None,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
