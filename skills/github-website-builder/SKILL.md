---
name: github-website-builder
description: Scaffold and maintain static websites in GitHub repositories with GitHub Pages. Use when Codex needs to create or refresh website files (HTML/CSS/JS), add a Pages deployment workflow in `.github/workflows`, and prepare a repo to publish a website from GitHub.
---

# GitHub Website Builder

Create a lightweight static website and a GitHub Pages deployment workflow.

## Quick Start

1. Run `scripts/scaffold_github_pages_site.py` from this skill with at least `--repo-root`.
2. Review generated files in the target site directory and `.github/workflows/deploy-pages.yml`.
3. Commit and push to GitHub.
4. In GitHub repository settings, confirm Pages is using GitHub Actions.

## Standard Workflow

1. Detect current website assets before scaffolding.
- If files already exist, patch instead of replacing unless the user explicitly asks for overwrite.

2. Scaffold deterministic baseline files.
- Use `scripts/scaffold_github_pages_site.py` to copy templates from `assets/site-template/`.
- Use `assets/workflows/deploy-pages.yml.tmpl` for Pages deployment.

3. Apply project-specific branding updates.
- Edit copy, colors, and sections in `index.html` and `styles.css`.
- Keep the site dependency-free unless the user explicitly requests a framework.

4. Validate the output.
- Confirm `index.html` exists in the site directory.
- Confirm `.github/workflows/deploy-pages.yml` exists and points to the same site directory.
- Confirm workflow branch target matches the repo default branch.

## Resources

- `scripts/scaffold_github_pages_site.py`: Generates site files and deployment workflow from templates.
- `references/github-pages-checklist.md`: Operational checklist and common failure points.
- `assets/site-template/`: HTML, CSS, and JS baseline files.
- `assets/workflows/deploy-pages.yml.tmpl`: GitHub Actions workflow template for Pages.
