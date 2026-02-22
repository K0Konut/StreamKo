# AGENTS.md — Streamy

## Purpose
This repository contains the Streamy MVP PRD and implementation scaffold.
`README.md` is the source of truth for scope and requirements.

## Repo Status (Feb 22, 2026)
- Frontend app: repository root (Vite + Vue + TypeScript).
- Backend API: `api/` (Strapi v5).
- Product and execution spec: `README.md`.

## Working Agreements
- Align all work to MVP scope in `README.md`.
- Confirm with the user before major structural changes.
- Keep changes minimal and explain every new dependency.
- Prefer concrete, testable steps over speculative architecture.
- Do not remove or rewrite the PRD unless explicitly requested.
- Branching: `main` is for releases, feature work goes to `dev` unless asked otherwise.

## Backend-first Reliability Rules (Strapi)
- Treat Strapi schema + permissions as a blocking foundation before expanding frontend features.
- Keep content type names and API contract stable once shared in `README.md`.
- Any schema change must include a short migration note in the same change.
- Validate ownership/security on `watch-progress` with 2 users before calling backend done.
- Do not delete/reset local Strapi data or DB files unless the user explicitly asks.

## Implementation Guardrails
- Before adding new tooling/layers, ask for missing choices (package manager, infra assumptions).
- If implementation starts, run and report minimal smoke checks (auth, content read, progress create/update/isolation).
- Keep documentation synced when decisions change.

## Files
- PRD: `README.md`
