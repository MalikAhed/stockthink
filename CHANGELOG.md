# Changelog

All notable changes to StockThink are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project uses [Semantic Versioning](https://semver.org/).

How to cut a release: `npm version patch|minor|major` then
`git push --follow-tags` — pushing the `v*` tag publishes a GitHub Release
(see `.github/workflows/release.yml`). Move the items below from *Unreleased*
into the new version section as you go.

## [Unreleased]

### Changed
- Reorganized the repo into three top-level zones — `frontend/` (UI/UX),
  `backend/` (engine + analysis logic), `self-improvement/` (docs, improve,
  eval, test). Verified no behaviour change: build, 246 tests, eval 90.8%.
- Cross-zone imports now use `@frontend` / `@backend` path aliases.

### Added
- Live UI/UX workflow: project-scoped `.mcp.json` registers the Chrome DevTools
  MCP (primary — real screenshots, console, Lighthouse) and Playwright MCP
  (driving + visual-regression) so the running page can be seen during design.
- `vite-plugin-checker` dev overlay (in-page TypeScript errors) and
  `server.host` so a browser/MCP can reach the dev server.
- `release.yml`: pushing a `v*` tag publishes a GitHub Release.
- This CHANGELOG.

### Removed
- Archived the untracked WIP homepage design sandbox out of the repo.

[Unreleased]: https://github.com/malikahed/stockthink/compare/main...HEAD
