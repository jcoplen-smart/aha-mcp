# CLAUDE.md — aha-mcp

Project-specific notes for Claude Code working in the `jcoplen-smart/aha-mcp` repository.

---

## Automated Workflows

**Skills** (invoke with `/skill-name`):
- `/create-branch` - Create feature branch
- `/start-work` - Full implementation workflow  
- `/self-review` - Validate conventions
- `/create-pr` - Create pull request
- `/respond-to-review` - Respond to code review

**Hooks** (automatic enforcement):
- Branch protection (blocks commits to `main`)
- Build validation (runs before commits)
- Remote verification (ensures correct fork)

---

## Git and GitHub Rules

**Never push to `aha-develop/aha-mcp` upstream fork. All work stays on `jcoplen-smart/aha-mcp`.**

Verify remote before pushes: `git remote -v` should show `jcoplen-smart/aha-mcp`.

**Branch naming:** `claude/<description>-<timestamp>` (use `/create-branch`)

**Typical workflow:**
1. `/create-branch <description>` or `/start-work <description>`
2. Implement changes (read source files first to understand conventions)
3. `/self-review` - validates against checklist below
4. Commit and push (build validated automatically by hook)
5. `/create-pr` - when ready for review
6. `/respond-to-review` - after Codex feedback

---

## Environment

- `python3` is not on the PATH. Use `python` instead — it resolves to Python 3.14.4.
- Node/npm is available. Always use `npm run build` to validate TypeScript compilation.

---

## Project Structure

This is a TypeScript MCP server that wraps the Aha! REST API. Key source files:

- `src/index.ts` — tool registration and MCP server setup
- `src/handlers.ts` — handler functions for each tool (one per tool)
- `src/queries.ts` — Aha! API query functions
- `src/types.ts` — TypeScript types

**Before implementing any change, read all four files** to understand existing conventions.
Work from the local source — do not reference the upstream `aha-develop/aha-mcp` GitHub repo.

---

## API Conventions

### Verify from source, don't assume

Before writing any new tool or modifying an existing one:

1. **Read the existing handlers** in `src/handlers.ts` to identify the conventions already
   in use — parameter naming, return shape, error handling pattern.
2. **Match those conventions exactly.** If something is unclear from the source, check the
   Aha! API docs at `https://www.aha.io/api` for the relevant resource.
3. **If the docs are still ambiguous, test the API directly** using `curl` before writing
   the implementation. Do not guess and implement — test first:
   ```bash
   curl -s -H "Authorization: Bearer $AHA_API_TOKEN" \
     "https://smarttech.aha.io/api/v1/<resource>/<reference-id>"
   ```

### Identifier types

Aha! records have both a human-readable reference ID (e.g. `STU-E-54`, `LUM-N-1`) and an
internal numeric ID (e.g. `7504384060498062629`). Users only ever see reference IDs in the
Aha! UI — they have no way to obtain numeric IDs directly.

**Standard approach:**
- Tool input parameters should accept reference IDs (what the user has)
- Most Aha! API endpoints accept reference IDs directly — test this first
- When an endpoint requires a numeric ID, resolve it by first fetching the record by
  reference ID and extracting the `id` field from the response
- **Never implement a tool that requires the user to supply a numeric ID directly**

**Known exceptions:**
- `competitors` — `GET /api/v1/competitors/:id` requires a **numeric ID**, not a reference
  number. To resolve a reference number (e.g. `LUM-C-1`) to a numeric ID, use the list
  endpoint: `GET /api/v1/products/:product_id/competitors?fields=id,reference_num`, find
  the matching entry, and extract its `id`. See `resolveCompetitorNumericId()` in
  `src/handlers.ts` for the established pattern. Do **not** pass a reference number to the
  direct competitor GET endpoint — it will 404.
- `goals` — the API response includes numeric `id` (e.g. `7374514016881184006`) and the
  reference number is only visible in the resource URL (e.g. `LUM-G-5`). Test whether
  `LUM-G-5` is accepted as input before assuming numeric ID is required.
- `product_id` (workspace) — numeric only internally, but workspace key (e.g. `STU`, `LUM`)
  works for list operations.

If you hit a case where reference ID lookup fails and numeric ID appears to be the only
option, **stop and document the constraint before proceeding** — do not silently implement
a tool that requires an ID the user cannot provide.

### Parameter naming conventions

- Grep `src/handlers.ts` for how existing tools name their record identifier parameters
  before naming parameters in new tools.
- The convention may differ between upstream tools and fork-added tools — check both.
- When in doubt, match the convention used by the most recently added fork tool.

### Self-review checklist

Use `/self-review` before committing to validate conventions.
