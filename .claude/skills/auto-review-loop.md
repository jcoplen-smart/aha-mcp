# Auto Review Loop

Automatically responds to Codex code review feedback in a loop until PR is clean or issues detected.

## Usage

```
/auto-review-loop <pr-number>
```

Example: `/auto-review-loop 23`

## What This Skill Does

Automates the complete code review response cycle:

1. **Check for unresolved Codex feedback** on the PR
2. **Implement fixes** using `/respond-to-review` workflow
3. **Detect loops** - if same issue flagged twice, stop and ask for help
4. **Schedule next check** in 5 minutes
5. **Stop when clean** (all threads resolved) or after 5 cycles max
6. **Status tracking** in `.claude/review-loop-status.md`

This allows you to step away while Claude and Codex iterate on fixes.

## Instructions for Claude

When this skill is invoked:

### Step 1: Initialize Tracking

Create or load tracking files:

**`.claude/review-loop-status.md`** - Current status (user-facing)
**`.claude/review-history.json`** - Fix history for loop detection

```json
{
  "pr_<number>": {
    "cycle": 1,
    "max_cycles": 5,
    "started_at": "2026-05-16T07:45:00Z",
    "fixes": [
      {
        "cycle": 1,
        "file": "src/handlers.ts",
        "issue_excerpt": "Paginate custom field definition retrieval",
        "commit": "4ee89ba",
        "timestamp": "2026-05-16T03:41:28Z",
        "resolved": true
      }
    ],
    "loops_detected": []
  }
}
```

Initialize with cycle 0 if starting fresh.

### Step 2: Check for Codex Approval

Codex signals approval in two ways:
1. Posts a top-level comment: "Codex Review: Didn't find any major issues. [phrase]"
2. Reacts with 👍 to the **first PR comment** (not the @codex review comment)

While reviewing, Codex posts 👀 (eyes) reactions on both the first comment and latest @codex review comment.

**Check for clean review comment:**
```bash
gh api repos/jcoplen-smart/aha-mcp/issues/<PR_NUMBER>/comments | \
  python -c "import sys, json; comments = json.load(sys.stdin); \
  codex_comments = [c for c in comments if c['user']['login'] == 'chatgpt-codex-connector[bot]']; \
  clean_reviews = [c for c in codex_comments if 'Codex Review:' in c['body'] and 'Didn'\''t find any major issues' in c['body']]; \
  print('approved' if clean_reviews else 'pending')"
```

**Check for 👍 on first PR comment:**
```bash
# Get the first PR comment ID
FIRST_COMMENT=$(gh api repos/jcoplen-smart/aha-mcp/issues/<PR_NUMBER>/comments | \
  python -c "import sys, json; comments = json.load(sys.stdin); print(comments[0]['id'] if comments else '')")

# Check for thumbs up from Codex
gh api repos/jcoplen-smart/aha-mcp/issues/comments/$FIRST_COMMENT/reactions | \
  python -c "import sys, json; reactions = json.load(sys.stdin); \
  codex_thumbsup = [r for r in reactions if r['user']['login'] == 'chatgpt-codex-connector[bot]' and r['content'] == '+1']; \
  print('approved' if codex_thumbsup else 'pending')"
```

**If approved (either signal found):**
- Update status file: "✅ PR #<number> is clean and ready to merge! Codex approved."
- Delete the cron job (using CronDelete with the stored job ID)
- Output success message to user
- Exit

**If not approved yet:**
- Continue to Step 3

### Step 3: Check for Unresolved Feedback

```bash
gh api graphql -f query='query {
  repository(owner: "jcoplen-smart", name: "aha-mcp") {
    pullRequest(number: <PR_NUMBER>) {
      reviewThreads(first: 50) {
        nodes {
          id
          isResolved
          comments(first: 1) {
            nodes {
              body
              path
              createdAt
            }
          }
        }
      }
    }
  }
}'
```

Filter for `isResolved: false` threads.

**If no unresolved threads and no approval yet:**
- Still waiting for Codex to review and approve
- Continue to Step 7 (schedule next check)
- Exit

**If unresolved threads found:**
- Continue to Step 4

### Step 4: Detect Loops

For each unresolved thread:
1. Extract file path and issue excerpt (first 100 chars of body)
2. Check review history for previous fixes to the same file
3. Compare issue excerpts using fuzzy matching:
   - Extract key terms (ignore common words)
   - If 60%+ of key terms overlap → likely a loop
   - Examples that should match:
     - "Paginate custom field definition" vs "Paginate custom field retrieval"
     - "ZipArchive API usage" vs "Instantiate archiver with supported API"

**If loop detected:**
- Update status file with loop details
- Output to user: "⚠️ LOOP DETECTED - Same issue flagged multiple times: <file>: <issue>. Please review manually."
- Delete cron job
- Exit and wait for user intervention

**If no loop detected:**
- Continue to Step 4

### Step 4: Check Cycle Limit

Increment cycle counter.

**If cycle > 5:**
- Update status file: "⚠️ Reached maximum 5 cycles. Please review remaining issues manually."
- List unresolved threads
- Delete cron job
- Exit

**If cycle <= 5:**
- Continue to Step 6

### Step 6: Implement Fixes

Execute the `/respond-to-review` workflow:
1. Fetch all review comments
2. Validate against self-review checklist
3. Implement fixes
4. Commit and push
5. Post direct replies to inline comments
6. Resolve addressed threads
7. Request fresh Codex review

Record each fix in review history with:
- Cycle number
- File path
- Issue excerpt
- Commit hash
- Timestamp

### Step 7: Update Status File

Write current status to `.claude/review-loop-status.md`:

```markdown
# PR #<number> Auto-Review Status

**Status:** 🔄 In progress (Cycle <N>/5)  
**Started:** <timestamp>  
**Last check:** <timestamp>  
**Next check:** In 5 minutes

## Current Cycle: <N>/5

### Fixes Implemented This Cycle
- `<file>`: <issue summary> (commit: <hash>)
- `<file>`: <issue summary> (commit: <hash>)

### Waiting For
Codex review of latest changes

---

## History

<details>
<summary>Previous Cycles</summary>

### Cycle 1
- Fixed: `src/handlers.ts` - Pagination issue (4ee89ba)
- Fixed: `package.json` - Decoupling issue (a1c7aeb)

</details>
```

### Step 8: Schedule Next Check

Use `CronCreate` to schedule next check in 5 minutes:

```javascript
CronCreate({
  cron: "<current_minute+5> * * * *",  // 5 minutes from now
  recurring: false,  // One-shot - will reschedule itself if needed
  durable: true,  // Persist to disk - survives restarts and visible across sessions
  prompt: "/auto-review-loop <pr-number>"
})
```

Store the returned job ID in the review history JSON for cleanup.

### Step 9: Output Status

Output to conversation:

```
✅ Cycle <N>/5 complete - fixed <M> issue(s)
Waiting for Codex review...
Next check in 5 minutes

Status: .claude/review-loop-status.md
```

## Loop Detection Algorithm

**Key terms extraction:**
1. Remove common words: "the", "a", "is", "in", "to", etc.
2. Extract technical terms: camelCase, file paths, function names
3. Normalize: lowercase, remove punctuation

**Similarity matching:**
```
overlap = (shared_terms / total_unique_terms) * 100
if overlap >= 60% AND same_file:
  → LOOP DETECTED
```

**Examples:**

✅ Should detect as loop:
- File: `scripts/package-deployment.cjs`
- Issue 1: "Instantiate archiver with supported API - use archiver() not ZipArchive"
- Issue 2: "Import ZipArchive class for proper packaging"
- Key terms overlap: ["archiver", "ziparchive", "api"] = ~75%

✅ Should NOT detect as loop:
- File: `src/handlers.ts`
- Issue 1: "Paginate custom field definitions"
- Issue 2: "Add error handling for API failures"
- Key terms overlap: ["api"] = ~10%

## Error Handling

- **CronCreate fails**: Report error, don't schedule next check
- **Review fetch fails**: Try again on next scheduled check (transient)
- **Fix implementation fails**: Record in status, let user intervene
- **File write fails**: Log to console, continue (status is nice-to-have)

## Exit Conditions

The loop stops and cleans up when:
1. ✅ **All threads resolved** - Success!
2. ⚠️ **Loop detected** - Same issue flagged twice
3. ⚠️ **Max cycles reached** - 5 cycles completed
4. 🛑 **User manually deletes cron job** - Using CronDelete or editing `.claude/scheduled_tasks.json`

## Notes

- **Non-blocking**: You can interact with Claude between checks
- **Durable**: Loop persists across sessions and restarts (stored in `.claude/scheduled_tasks.json`)
- **Cross-session**: Visible to all Claude sessions (terminal, conversation pane, IDE)
- **Status file**: Check `.claude/review-loop-status.md` anytime for current state
- **Manual override**: You can always run `/respond-to-review` manually to take over
- **Permission prompts**: If your settings require approval, the loop will pause until you approve
- **Best in "allow mode"**: Works best with auto-approved bash/edit operations

## Limitations

- Status updates appear in whichever Claude session is active when the cron job fires
- Codex must complete reviews within 5-minute windows for smooth operation
- Loop detection is heuristic - may miss sophisticated repeated issues
- Requires at least one Claude session to be running for cron jobs to fire
