# Create Branch

Creates a properly named feature branch following project conventions.

## Usage

```
/create-branch [description]
```

If no description is provided, you will be prompted for one.

## What This Skill Does

Creates a new `claude/<description>-<timestamp>` branch from the latest `main`, following the branching conventions in CLAUDE.md:

1. **Verify current branch** and handle edge cases
2. **Verify remote** points to `jcoplen-smart/aha-mcp` (not upstream fork)
3. **Update main** to latest from origin
4. **Create feature branch** with proper naming convention
5. **Handle accidental work on main** if detected

## Instructions for Claude

When this skill is invoked:

### Step 1: Check Current State

```bash
git branch --show-current
```

If the current branch is `main` and there are uncommitted changes:
- Skip to Step 4 (create branch in place - changes will move automatically)
- Skip Steps 2-3 (don't checkout/pull main - we're already on it with changes)

If the current branch is NOT `main`:
- Proceed to Step 2

### Step 2: Verify Remote

```bash
git remote -v
```

Check that `origin` points to `https://github.com/jcoplen-smart/aha-mcp`.

**If it points anywhere else, STOP and ask the user before proceeding.**

### Step 3: Update Main Branch

Only run this if current branch is NOT `main` OR if on `main` with no uncommitted changes:

```bash
git checkout main
git pull origin main
```

### Step 4: Get Branch Description

If the user provided a description as an argument, use it.

If not provided, ask the user:
- "What should this branch be called? (2-4 words, will be formatted as claude/your-description-timestamp)"
- Keep it short and hyphenated (e.g., "add-release-tool", "fix-auth-bug")

### Step 5: Create Branch

```bash
git checkout -b claude/<description>-$(date +%s)
```

Where `<description>` is the user-provided description in lowercase with hyphens.

### Step 6: Confirm Success

Report the new branch name to the user:
```
✅ Created and switched to branch: claude/<description>-<timestamp>
```

## Error Handling

- If remote verification fails: Stop and ask user
- If git pull fails: Report error and ask user how to proceed
- If branch creation fails: Report error with git output

## Notes

- The timestamp ensures branch names are unique even with the same description
- If work was accidentally started on `main`, this safely moves it to a new branch
- Always branches from `origin/main`, never from stale local `main`
- Format: `claude/<description>-<unix-timestamp>` (e.g., `claude/add-release-tool-1778888911`)
