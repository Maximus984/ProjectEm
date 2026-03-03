# GitHub Pages Checklist

## Before Commit

- Confirm target branch (usually `main`).
- Confirm site directory (for example `site/` or `docs/`).
- Confirm `.github/workflows/deploy-pages.yml` exists.

## Workflow Requirements

- Use `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages`.
- Grant workflow permissions:
  - `pages: write`
  - `id-token: write`
  - `contents: read`
- Use `path` in upload step that matches the generated site directory.

## Repository Settings

- In GitHub: `Settings -> Pages`.
- Ensure source is `GitHub Actions`.

## Common Issues

- Wrong branch in workflow trigger.
- Upload path does not match actual directory.
- Missing workflow permissions.
- Existing Pages setting still points to legacy branch folder mode.
