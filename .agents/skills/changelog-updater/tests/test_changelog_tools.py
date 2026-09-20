#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from typing import Optional

SKILL = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL / "scripts"


def run(*args: str, cwd: Optional[Path] = None, expect: int = 0) -> subprocess.CompletedProcess[str]:
    process = subprocess.run(args, cwd=cwd, text=True, capture_output=True)
    if process.returncode != expect:
        raise AssertionError(
            f"expected {expect}, got {process.returncode}\nstdout={process.stdout}\nstderr={process.stderr}"
        )
    return process


def write_plan(path: Path, action: str, version: str, date: Optional[str], sections: dict) -> None:
    path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "action": action,
                "target_file": "CHANGELOG.md",
                "title": "Changelog",
                "preamble": "All notable changes to this project will be documented in this file.",
                "source": {
                    "mode": "since-tag",
                    "range": "v0.1.0..HEAD",
                    "generated_date": "2026-07-04",
                    "target_version": None if version == "Unreleased" else version,
                    "assumptions": [],
                },
                "releases": [{"version": version, "date": date, "sections": sections}],
                "omitted": [],
                "links": {},
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


class ChangelogToolsTest(unittest.TestCase):
    def make_repo(self) -> Path:
        root = Path(tempfile.mkdtemp(prefix="changelog-updater-test-"))
        run("git", "init", "-q", str(root))
        run("git", "config", "user.email", "test@example.com", cwd=root)
        run("git", "config", "user.name", "Test User", cwd=root)
        (root / "app.txt").write_text("one\n", encoding="utf-8")
        run("git", "add", ".", cwd=root)
        run("git", "commit", "-qm", "initial release", cwd=root)
        run("git", "tag", "v0.1.0", cwd=root)
        (root / "app.txt").write_text("one\ntwo\n", encoding="utf-8")
        run("git", "add", ".", cwd=root)
        run("git", "commit", "-qm", "stuff works now", cwd=root)
        (root / "tests.txt").write_text("coverage\n", encoding="utf-8")
        run("git", "add", ".", cwd=root)
        run("git", "commit", "-qm", "more tests", cwd=root)
        return root

    def test_collect_since_tag(self) -> None:
        repo = self.make_repo()
        output = repo / ".changelog" / "history.json"
        result = run(
            "python3",
            str(SCRIPTS / "collect_history.py"),
            "--repo",
            str(repo),
            "--mode",
            "since-tag",
            "--output",
            str(output),
        )
        status = json.loads(result.stdout)
        self.assertTrue(status["ok"])
        data = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(data["summary"]["commit_count"], 2)
        self.assertEqual(data["segments"][0]["range"], "v0.1.0..HEAD")
        self.assertEqual(data["segments"][0]["commits"][0]["subject"], "stuff works now")


    def test_collect_full_segments(self) -> None:
        repo = self.make_repo()
        run("git", "tag", "v0.2.0", cwd=repo)
        (repo / "app.txt").write_text("one\ntwo\nthree\n", encoding="utf-8")
        run("git", "add", ".", cwd=repo)
        run("git", "commit", "-qm", "post release adjustment", cwd=repo)
        output = repo / "full.json"
        run(
            "python3",
            str(SCRIPTS / "collect_history.py"),
            "--repo",
            str(repo),
            "--mode",
            "full",
            "--output",
            str(output),
        )
        data = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual([segment["label"] for segment in data["segments"]], ["v0.1.0", "v0.2.0", "Unreleased"])
        self.assertEqual([segment["commit_count"] for segment in data["segments"]], [1, 2, 1])

    def test_invalid_plan_is_rejected(self) -> None:
        repo = self.make_repo()
        plan = repo / "invalid.json"
        write_plan(
            plan,
            "update_unreleased",
            "Unreleased",
            None,
            {"Added": [{"text": "Added capability", "commits": ["abcdef1"], "breaking": False}]},
        )
        value = json.loads(plan.read_text(encoding="utf-8"))
        value["target_file"] = "../CHANGELOG.md"
        value["source"]["generated_date"] = "2026-99-99"
        plan.write_text(json.dumps(value), encoding="utf-8")
        result = run("python3", str(SCRIPTS / "validate_plan.py"), str(plan), expect=4)
        details = json.loads(result.stderr)["details"]
        self.assertTrue(any("inside the repository" in item for item in details))
        self.assertTrue(any("valid YYYY-MM-DD" in item for item in details))

    def test_incremental_update_preserves_released_block(self) -> None:
        repo = self.make_repo()
        old_release = "## [0.1.0] - 2026-06-01\n\n### Added\n\n- Initial capability\n\n<!-- preserve this exact historical note -->\n"
        changelog = (
            "# Changelog\n\nAll notable changes.\n\n"
            "## [Unreleased]\n\n### Fixed\n\n- Existing fix\n\n"
            + old_release
        )
        (repo / "CHANGELOG.md").write_text(changelog, encoding="utf-8")
        plan = repo / "plan.json"
        write_plan(
            plan,
            "update_unreleased",
            "Unreleased",
            None,
            {
                "Added": [
                    {"text": "Added a new workflow", "commits": ["abcdef1"], "breaking": False}
                ],
                "Fixed": [
                    {"text": "Existing fix", "commits": ["abcdef2"], "breaking": False}
                ],
            },
        )
        run("python3", str(SCRIPTS / "validate_plan.py"), str(plan))
        dry = run(
            "python3",
            str(SCRIPTS / "apply_changelog.py"),
            "--repo",
            str(repo),
            "--plan",
            str(plan),
            "--dry-run",
        )
        self.assertIn("Added a new workflow", json.loads(dry.stdout)["diff"])
        run(
            "python3",
            str(SCRIPTS / "apply_changelog.py"),
            "--repo",
            str(repo),
            "--plan",
            str(plan),
            "--write",
        )
        updated = (repo / "CHANGELOG.md").read_text(encoding="utf-8")
        self.assertIn(old_release, updated)
        self.assertEqual(updated.count("Existing fix"), 1)
        self.assertTrue((repo / "CHANGELOG.md.bak").exists())
        run("python3", str(SCRIPTS / "verify_changelog.py"), str(repo / "CHANGELOG.md"))

    def test_release_moves_unreleased(self) -> None:
        repo = self.make_repo()
        (repo / "CHANGELOG.md").write_text(
            "# Changelog\n\nAll notable changes.\n\n"
            "## [Unreleased]\n\n### Added\n\n- Existing feature\n\n"
            "## [0.1.0] - 2026-06-01\n\n### Added\n\n- Initial capability\n",
            encoding="utf-8",
        )
        plan = repo / "release.json"
        write_plan(
            plan,
            "release",
            "0.2.0",
            "2026-07-04",
            {
                "Fixed": [
                    {"text": "Fixed a release blocker", "commits": ["abcdef1"], "breaking": False}
                ]
            },
        )
        run(
            "python3",
            str(SCRIPTS / "apply_changelog.py"),
            "--repo",
            str(repo),
            "--plan",
            str(plan),
            "--write",
        )
        text = (repo / "CHANGELOG.md").read_text(encoding="utf-8")
        self.assertRegex(text, r"## \[Unreleased\]\n\n## \[0\.2\.0\] - 2026-07-04")
        self.assertIn("- Existing feature", text)
        self.assertIn("- Fixed a release blocker", text)
        run("python3", str(SCRIPTS / "verify_changelog.py"), str(repo / "CHANGELOG.md"))

    def test_reconstruction_requires_gate(self) -> None:
        repo = self.make_repo()
        plan = repo / "reconstruct.json"
        write_plan(
            plan,
            "reconstruct",
            "Unreleased",
            None,
            {"Added": [{"text": "Added history", "commits": ["abcdef1"], "breaking": False}]},
        )
        run(
            "python3",
            str(SCRIPTS / "apply_changelog.py"),
            "--repo",
            str(repo),
            "--plan",
            str(plan),
            "--write",
            expect=6,
        )
        self.assertFalse((repo / "CHANGELOG.md").exists())
        run(
            "python3",
            str(SCRIPTS / "apply_changelog.py"),
            "--repo",
            str(repo),
            "--plan",
            str(plan),
            "--write",
            "--allow-replace",
        )
        run("python3", str(SCRIPTS / "verify_changelog.py"), str(repo / "CHANGELOG.md"))


if __name__ == "__main__":
    unittest.main()
