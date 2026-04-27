# CLAUDE.md — aha-mcp

Project-specific notes for Claude Code working in the `jcoplen-smart/aha-mcp` repository.

---

## ⚠️ Critical: Git and GitHub Rules

**Never push to or create PRs against the upstream fork `aha-develop/aha-mcp`.
All work stays on `jcoplen-smart/aha-mcp`.**

Before any `git push` or `gh pr create`, verify the remote:
```bash
git remote -v
```
The `origin` remote must point to `https://github.com/jcoplen-smart/aha-mcp`.
If it points anywhere else, stop and ask before proceeding.

### Branching

- **Never commit directly to `main`.** If the current branch is `main`, create a feature
  branch first.
- Branch naming: `claude/<short-description>-<unix-timestamp>`
  - Example: `claude/add-release-tool-1745698800`
  - Keep the description short (2–4 words, hyphenated)
- Always branch from the latest `main` on `origin`:
  ```bash
  git checkout main
  git pull origin main
  git checkout -b claude/<short-description>-$(date +%s)
  ```

### New Work: Implementation Workflow

When starting any new work:

1. Pull latest main and create a `claude/` branch (see above)
2. Implement changes
3. Run `npm run build` — fix any errors before proceeding
4. Run the self-review checklist (see API Conventions below)
5. Commit with a descriptive conventional commit message (`feat: ...`, `fix: ...`, etc.)
6. Push to `origin` (`jcoplen-smart/aha-mcp`)
7. **Stop here.** Do not create a PR unless explicitly asked to.

Multiple rounds of work may be committed and pushed to the same branch before a PR is
opened. Wait for the user to say it's time.

### Opening a PR

Only create a PR when the user explicitly asks. When asked:

1. Summarize what has been committed to the branch since it was created from `main`
2. Confirm `npm run build` is passing
3. Create the PR:
   ```bash
   gh pr create --base main --title "feat: ..." --body "..."
   ```
   PR body should include: what changed, why, and any known risks or gaps.
4. Trigger Codex review:
   ```bash
   gh pr comment <number> --repo jcoplen-smart/aha-mcp --body "@codex review"
   ```

### Responding to Code Review Feedback

Codex (`chatgpt-codex-connector` bot) posts review feedback as PR comments with inline
line-level annotations. It does not use GitHub's formal "Request changes" review state.

When asked to respond to review feedback:

1. **Find the PR for the current branch** — do not wait for a URL to be provided:
   ```bash
   gh pr view --json number,title,url,headRefName
   ```
   If that returns nothing, check the current branch with `git branch --show-current`
   and then `gh pr list --head <branch-name>`.

2. **Fetch all review comments:**
   ```bash
   # Top-level PR comments (where Codex posts its summary)
   gh pr view <number> --json comments

   # Inline line-level comments (with thread IDs needed for resolution)
   gh api repos/jcoplen-smart/aha-mcp/pulls/<number>/comments
   ```

3. **Read and understand all feedback** before making any changes. Group related comments
   together. If any feedback is unclear or contradictory, stop and ask before implementing.

4. **Run the self-review checklist** (see API Conventions) against the feedback — confirm
   each issue is real before fixing it.

5. **Implement fixes.** Run `npm run build` after changes and confirm it passes.

6. **Commit and push:**
   ```bash
   git add .
   git commit -m "fix: address code review feedback"
   git push origin <branch-name>
   ```

7. **Resolve each addressed review thread** via GraphQL (thread IDs come from the
   `pull_request_review_thread` node in the inline comments response):
   ```bash
   gh api graphql -f query='mutation {
     resolveReviewThread(input: {threadId: "<PRRT_...>"}) {
       thread { isResolved }
     }
   }'
   ```
   Repeat for each resolved thread.

8. **Trigger a fresh Codex review:**
   ```bash
   gh pr comment <number> --repo jcoplen-smart/aha-mcp --body "@codex review"
   ```

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

### Self-review checklist before committing

Before marking any task complete or creating a PR, check:

1. Do all new tools accept identifier types the user can actually see in the Aha! UI?
2. Do parameter names match the convention in existing fork-added handlers?
3. Do return shapes match the convention established by similar existing tools?
4. Is error handling consistent with the existing pattern in `handlers.ts`?
5. Is the new tool registered in `src/index.ts` with a clear, specific description string?
6. Does `npm run build` pass cleanly?
7. Are there any hardcoded values that should be parameters?

If the answer to any of 1–5 is "not sure" — read the relevant existing handlers and/or
test the API. Do not guess.
