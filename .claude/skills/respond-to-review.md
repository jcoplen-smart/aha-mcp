# Respond to Code Review

Automates the complete workflow for responding to code review feedback on GitHub PRs.

## Usage

```
/respond-to-review
```

Run this skill when Codex or another reviewer has posted feedback on your PR and you're ready to address it.

## What This Skill Does

Executes the full code review response workflow:

1. **Find the PR** for the current branch automatically
2. **Check for Codex approval** - exit early if PR is already approved
3. **Fetch all review comments** (top-level summary + inline line-level comments with thread IDs)
4. **Read and understand all feedback** - group related comments, detect contradictions with prior fixes
5. **Run self-review checklist** against feedback to confirm each issue is real
6. **Implement fixes** and verify `npm run build` passes
7. **Commit and push** with conventional commit message
8. **Reply directly to inline comments** with fix details
9. **Resolve addressed review threads** via GraphQL
10. **Trigger fresh Codex review** by posting `@codex review` comment

## Instructions for Claude

When this skill is invoked:

### Step 1: Find the PR

```bash
# Get PR for current branch
gh pr view --json number,title,url,headRefName
```

If that returns nothing:
```bash
# Fallback: list PRs by branch name
BRANCH=$(git branch --show-current)
gh pr list --head "$BRANCH"
```

Extract the PR number for subsequent steps.

### Step 1.5: Check for Codex Approval

Before doing any work, check if Codex has already approved the PR. Codex signals approval in two ways:

1. Posts a top-level comment containing "Codex Review: Didn't find any major issues"
2. Reacts with 👍 to the **first PR comment** (not the @codex review comment)

**Check for clean review comment:**
```bash
gh api repos/jcoplen-smart/aha-mcp/issues/<PR_NUMBER>/comments | python -c "
import sys, json
comments = json.load(sys.stdin)
codex_comments = [c for c in comments if c['user']['login'] == 'chatgpt-codex-connector[bot]']
clean_reviews = [c for c in codex_comments if 'Codex Review:' in c['body'] and \"Didn't find any major issues\" in c['body']]
print('approved' if clean_reviews else 'pending')
"
```

**Check for 👍 on first PR comment:**
```bash
FIRST_COMMENT=$(gh api repos/jcoplen-smart/aha-mcp/issues/<PR_NUMBER>/comments | \
  python -c "import sys, json; comments = json.load(sys.stdin); print(comments[0]['id'] if comments else '')")

gh api repos/jcoplen-smart/aha-mcp/issues/comments/$FIRST_COMMENT/reactions | python -c "
import sys, json
reactions = json.load(sys.stdin)
codex_thumbsup = [r for r in reactions if r['user']['login'] == 'chatgpt-codex-connector[bot]' and r['content'] == '+1']
print('approved' if codex_thumbsup else 'pending')
"
```

**If approved (either signal found):**
- Output: "✅ PR #<number> is already approved by Codex - no action needed."
- Exit the skill

**If not approved:** Continue to Step 2.

### Step 2: Fetch All Review Comments

```bash
# Top-level comments (Codex summary)
gh pr view <number> --json comments --jq '.comments[] | "[\\(.author.login)] \\(.body)\\n---"'

# Inline line-level comments (needed for direct replies)
gh api repos/jcoplen-smart/aha-mcp/pulls/<number>/comments
```

Parse both outputs. Inline comments include:
- `id` (comment ID - use this to reply directly to the comment)
- `path`, `line`, `body` (the actual feedback)
- `pull_request_review_id` (thread ID)

To get GraphQL node IDs for thread resolution:
```bash
gh api graphql -f query='
query {
  repository(owner: "jcoplen-smart", name: "aha-mcp") {
    pullRequest(number: <number>) {
      reviewThreads(first: 20) {
        nodes {
          id
          isResolved
          comments(first: 1) {
            nodes {
              body
              path
              line
            }
          }
        }
      }
    }
  }
}'
```

This returns thread IDs in the correct `PRRT_...` format needed for resolution.

### Step 3: Understand Feedback and Detect Contradictions

- Read all comments completely
- Group related feedback items together
- Identify any unclear or contradictory feedback

**Check for contradictory feedback against prior fixes on this branch:**

For each piece of feedback, check the git log for previous commits that touched the same file:

```bash
# For each file mentioned in feedback
git log origin/main..HEAD --oneline -- <file>
```

If a previous commit on this branch addressed the same file, examine its message and changes:

```bash
git show <commit-hash>
```

**Look for contradictions** - cases where new feedback asks for the opposite of what was already fixed. Examples:
- Earlier: "Decouple X from Y" → Fixed by separating them
- Now: "Couple X into Y" → Asks to put them back together

**If contradictory feedback detected:**
- **STOP** and present the contradiction to the user
- Show: previous commit message + current feedback + the conflict
- Ask: "Should I (1) implement as requested, (2) propose a compromise, (3) push back as false positive, or (4) ask Codex for clarification?"
- Do NOT silently flip-flop on previous decisions

**STOP and ask the user when:**
- Feedback contradicts a prior fix on this branch
- Feedback is ambiguous or unclear
- Feedback requires architectural decisions (not just code changes)
- Feedback contradicts CLAUDE.md conventions
- Multiple valid interpretations exist

### Step 4: Run Self-Review Checklist

For each piece of feedback, verify against CLAUDE.md self-review checklist:

1. Do identifier types match what users see in Aha! UI (reference IDs not numeric)?
2. Do parameter names match fork-added handler conventions?
3. Do return shapes match similar existing tools?
4. Is error handling consistent with handlers.ts patterns?
5. Are tools properly registered in index.ts with clear descriptions?
6. Does `npm run build` pass?
7. Are there hardcoded values that should be parameters?

**Only proceed with fixes that pass this validation.** If feedback contradicts project conventions, note it and ask user.

### Step 5: Implement Fixes

- Make changes to address validated feedback
- Run `npm run build` after changes
- **If build fails, fix errors before proceeding**

### Step 6: Commit and Push

```bash
git add .
git commit -m "fix: address code review feedback"
git push origin $(git branch --show-current)
```

Use conventional commit format. If addressing specific issues, be more descriptive (e.g., "fix: correct parameter naming in competitor tools").

### Step 6.5: Post Responses to Inline Comments

**IMPORTANT:** Reply directly to inline review comments, not as top-level PR comments. This keeps the conversation organized and makes it clear which feedback each response addresses.

For each inline comment you addressed:

```bash
# Get the comment ID from step 2
COMMENT_ID=<id from inline comment>

# Reply directly to that specific comment
gh api -X POST repos/jcoplen-smart/aha-mcp/pulls/<number>/comments/$COMMENT_ID/replies \
  -f body="Your detailed response explaining the fix or why it's a false positive"
```

**Response format:**
- Start with brief summary: "Fixed" or "False positive" or "Addressed by clarifying..."
- Provide specific details about what changed or why the feedback doesn't apply
- Include evidence if claiming false positive (e.g., "Per official docs...", "Build output shows...")
- Keep responses professional and concise

**Example responses:**

For a fix:
```
Fixed. Changed parameter from numeric ID to reference ID format (e.g., 'LUM-C-1') to match what users see in Aha! UI.
```

For a false positive:
```
False positive. This usage matches the official archiver@8 README Quick Start example exactly. The @types/archiver definitions are incomplete but the class export is documented. Build succeeds: "✓ Created aha-mcp.zip (11.54 MB)"

Added inline comment in code citing official documentation to prevent future confusion.
```

**For false positives:** Also add an inline code comment near the flagged code explaining why it's correct, with a reference to official documentation. This prevents the same false positive from being raised in future reviews.

Example inline comment:
```javascript
// Note: ZipArchive class is the official API per archiver@8 README (Quick Start section)
// TypeScript definitions are incomplete but the class export is documented and supported
```

### Step 7: Resolve Review Threads

For each comment thread that was addressed (including false positives you explained), resolve it using the GraphQL thread ID from step 2:

```bash
gh api graphql -f query='mutation {
  resolveReviewThread(input: {threadId: "<PRRT_...>"}) {
    thread { isResolved }
  }
}'
```

**Resolve threads when:**
- ✅ You fixed the issue
- ✅ You explained it's a false positive with evidence
- ✅ You clarified the code with inline comments

**Do NOT resolve threads when:**
- ❌ You disagreed with feedback but didn't provide evidence
- ❌ You're waiting for user clarification
- ❌ The issue is acknowledged but intentionally deferred

### Step 8: Request Fresh Review

After responding to all comments and resolving threads:

```bash
gh pr comment <number> --repo jcoplen-smart/aha-mcp --body "@codex review"
```

**Note:** This triggers a fresh review of the current PR state. Codex will see your fixes and inline comment responses.

## Summary Output

After completing all steps, provide a brief summary:

```
✅ Responded to code review on PR #<number>

Fixed:
- <brief description of fix 1>
- <brief description of fix 2>

False positives explained:
- <brief description with inline comment added>

Posted <N> direct replies to inline comments
Resolved <N> review thread(s)
Requested fresh @codex review
```

## Error Handling

- If no PR found: "No PR found for current branch. Create one first with /create-pr or specify PR number."
- If no comments found: "No review comments found on PR #<number>. Nothing to respond to."
- If build fails: Stop and report build errors
- If ambiguous feedback: Stop and ask user for clarification

## Notes

- This skill enforces the CLAUDE.md workflow completely - it will not skip steps like thread resolution or re-review request
- Feedback validation against self-review checklist prevents implementing incorrect "fixes"
- The skill assumes you're on the branch associated with the PR being reviewed
