# Create Pull Request

Creates a properly formatted pull request against the main branch.

## Usage

```
/create-pr
```

## What This Skill Does

Executes the "Opening a PR" workflow from CLAUDE.md:

1. **Verify current branch** is not `main`
2. **Summarize commits** on the branch since diverging from `main`
3. **Confirm build passes** 
4. **Create PR** with proper title and body format
5. **Return PR URL** to user
6. **Note**: Codex review triggers automatically - do NOT post `@codex review`

## Instructions for Claude

When this skill is invoked:

### Step 1: Verify Current Branch

```bash
git branch --show-current
```

**If on `main`:**
- Stop and inform user: "Cannot create PR from main branch. Please create a feature branch first with /create-branch."

**If on a feature branch:**
- Continue to Step 2

### Step 2: Gather Commit History

Get all commits on this branch since it diverged from `main`:

```bash
# Get the branch name
BRANCH=$(git branch --show-current)

# Get commit history
git log main..$BRANCH --oneline

# Get full diff to understand scope of changes
git diff main...$BRANCH --stat
```

Read the commit messages and diff to understand:
- What changed (which files/features)
- Why it changed (from commit messages)
- Scope of the change

### Step 3: Verify Build Status

```bash
npm run build
```

**If build fails:**
- Stop and report: "Build is failing. Please fix build errors before creating PR."
- Show the build errors
- Exit without creating PR

**If build passes:**
- Continue to Step 4

### Step 4: Generate PR Title and Body

**Title format:**
- Start with conventional commit type: `feat:`, `fix:`, `refactor:`, `docs:`, etc.
- Keep under 70 characters
- Be specific and concise
- Example: `feat: add custom field schema caching and list tool`

**Body format:**
```markdown
## Summary

<2-4 bullet points describing what changed and why>
- High-level overview of the changes
- Why this change was needed
- What problem it solves

## Changes

<3-5 bullet points of specific technical changes>
- New files added
- Modified functionality
- API changes or additions

## Testing

<How this was tested>
- Build passes
- Manual testing performed (if any)
- Edge cases considered

## Known Issues / Future Work

<Optional - only if applicable>
- Any known limitations
- Future improvements planned
- Technical debt acknowledged
```

### Step 5: Create the PR

```bash
gh pr create --base main --title "<title>" --body "$(cat <<'EOF'
<body content here>
EOF
)"
```

**IMPORTANT:** 
- Always use `--base main`
- Always target `jcoplen-smart/aha-mcp` (should be default based on remote)
- Use HEREDOC format for body to preserve formatting

### Step 6: Report Success

When PR is created successfully:

```
✅ Created PR #<number>: <title>

<PR URL>

Note: Codex will automatically review this PR (no need to request manually).
```

## Error Handling

- If on `main` branch: Stop and guide user to create feature branch
- If build fails: Stop and report errors, do not create PR
- If `gh pr create` fails: Report error (might be auth, remote, or existing PR)
- If no commits on branch: Stop and report "No commits to create PR from"

## Notes

- This skill only creates the PR - it does NOT trigger `@codex review` (Codex auto-triggers on new PRs)
- PR body should be informative but concise - focus on what reviewers need to know
- Title should be short enough for GitHub UI (under 70 chars)
- The PR targets `main` on `jcoplen-smart/aha-mcp`, never the upstream fork
