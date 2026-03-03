#!/usr/bin/env python3
"""Scaffold a static site and GitHub Pages workflow into a repository."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a static site folder and GitHub Pages workflow."
    )
    parser.add_argument(
        "--repo-root",
        required=True,
        help="Repository root where files should be generated.",
    )
    parser.add_argument(
        "--site-dir",
        default="site",
        help="Relative directory for website files (default: site).",
    )
    parser.add_argument(
        "--deploy-branch",
        default="",
        help="Branch that triggers deployment workflow (auto-detect current branch, fallback: main).",
    )
    parser.add_argument(
        "--title",
        default="Project Website",
        help="Website title.",
    )
    parser.add_argument(
        "--tagline",
        default="A modern static website deployed with GitHub Pages.",
        help="Website tagline/meta description.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing generated files.",
    )
    return parser.parse_args()


def write_file(path: Path, content: str, force: bool) -> str:
    if path.exists() and not force:
        return f"skip: {path} already exists"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    return f"write: {path}"


def render_text(template: str, values: dict[str, str]) -> str:
    result = template
    for key, value in values.items():
        result = result.replace(f"{{{{{key}}}}}", value)
    return result


def detect_current_branch(repo_root: Path) -> str:
    head_path = repo_root / ".git" / "HEAD"
    if not head_path.exists():
        return "main"

    head_content = head_path.read_text().strip()
    if head_content.startswith("ref: refs/heads/"):
        return head_content.removeprefix("ref: refs/heads/")
    return "main"


def main() -> int:
    args = parse_args()

    script_dir = Path(__file__).resolve().parent
    skill_root = script_dir.parent
    assets_root = skill_root / "assets"
    site_template_dir = assets_root / "site-template"
    workflow_template_path = assets_root / "workflows" / "deploy-pages.yml.tmpl"

    repo_root = Path(args.repo_root).resolve()
    site_dir = repo_root / args.site_dir
    workflow_path = repo_root / ".github" / "workflows" / "deploy-pages.yml"

    if not repo_root.exists():
        raise SystemExit(f"repo root does not exist: {repo_root}")

    build_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    text_values = {
        "SITE_TITLE": args.title,
        "SITE_TAGLINE": args.tagline,
        "BUILD_DATE": build_date,
    }

    deploy_branch = args.deploy_branch or detect_current_branch(repo_root)

    workflow_values = {
        "DEPLOY_BRANCH": deploy_branch,
        "SITE_DIR": args.site_dir,
    }

    output_lines = []

    for filename in ("index.html", "styles.css", "script.js"):
        template_path = site_template_dir / filename
        content = render_text(template_path.read_text(), text_values)
        destination = site_dir / filename
        output_lines.append(write_file(destination, content, args.force))

    workflow_content = render_text(workflow_template_path.read_text(), workflow_values)
    output_lines.append(write_file(workflow_path, workflow_content, args.force))

    print("Scaffold summary:")
    for line in output_lines:
        print(f"- {line}")

    print("\nNext steps:")
    print("1. Review generated files and customize copy/styling.")
    print("2. Commit and push to GitHub.")
    print(f"3. Confirm workflow deploy branch is '{deploy_branch}'.")
    print("4. In GitHub Settings -> Pages, verify source is GitHub Actions.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
