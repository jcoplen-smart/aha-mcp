# Start Work

Complete workflow for implementing new features or fixes, from branch creation through push.

## Usage

```
/start-work [description]
```

If no description is provided, you will be prompted for one.

## What This Skill Does

Executes the complete "New Work: Implementation Workflow" from CLAUDE.md:

1. **Check current branch** - create feature branch if on `main`
2. **Get work description** from user about what to implement
3. **Implement changes** based on description
4. **Run build** and fix any errors
5. **Run self-review checklist** to validate conventions
6. **Commit** with conventional commit message
7. **Push** to origin
8. **Stop** (do not create PR unless explicitly asked)

## Instructions for Claude

When this skill is invoked:

### Step 1: Ensure Proper Branch

Check current branch:
```bash
git branch --show-current
```

**If on `main`:**
- Invoke the `create-branch` skill to create a feature branch first
- Use the description provided to this skill, or ask for one

**If on a feature branch:**
- Continue to Step 2

### Step 2: Understand the Work

If the user provided a description as an argument, use it as guidance.

If not provided, ask the user:
- "What would you like to implement or fix?"
- Get clear requirements before proceeding

### Step 3: Read Project Context

Before implementing, read the key source files to understand conventions:

```bash
# At minimum, read these files to understand existing patterns
```

Read:
- `src/handlers.ts` (to understand handler patterns)
- `src/index.ts` (to see tool registration)
- Any files directly related to the work

### Step 4: Implement Changes

Make the requested changes following project conventions from CLAUDE.md:
- Match existing parameter naming conventions
- Match existing return shapes
- Match existing error handling patterns
- Accept reference IDs (not numeric IDs) for user-facing parameters
- Register new tools in `src/index.ts` with clear descriptions

### Step 5: Run Build

```bash
npm run build
```

**If the build fails:**
- Read the error output
- Fix the errors
- Run build again
- Repeat until build passes

Do not proceed until build is clean.

### Step 6: Run Self-Review Checklist

Before committing, verify:

1. ✅ Do all new tools accept identifier types the user can actually see in the Aha! UI?
2. ✅ Do parameter names match the convention in existing fork-added handlers?
3. ✅ Do return shapes match the convention established by similar existing tools?
4. ✅ Is error handling consistent with the existing pattern in `handlers.ts`?
5. ✅ Is the new tool registered in `src/index.ts` with a clear, specific description string?
6. ✅ Does `npm run build` pass cleanly?
7. ✅ Are there any hardcoded values that should be parameters?

**If any check fails, fix it before proceeding.**

### Step 7: Commit Changes

Use conventional commit format:
- `feat:` for new features
- `fix:` for bug fixes
- `refactor:` for code restructuring
- `docs:` for documentation
- `chore:` for maintenance tasks

```bash
git add .
git commit -m "<type>: <concise description of what changed>"
```

**Commit message guidelines:**
- Focus on "why" rather than "what" when possible
- Keep it concise (1-2 sentences)
- Be specific about the change

### Step 8: Push to Origin

```bash
BRANCH=$(git branch --show-current)
git push origin $BRANCH
```

### Step 9: Report Completion

Summarize what was done:

```
✅ Completed work on branch: <branch-name>

Changes:
- <brief summary of changes>

Build: ✅ Passing
Self-review: ✅ Passed

Pushed to origin. Ready for PR when you are.
```

**IMPORTANT: Do NOT create a PR automatically.** Wait for the user to explicitly ask for a PR.

## Error Handling

- If on `main` and branch creation fails: Stop and report error
- If build fails repeatedly: Report errors and ask user for guidance
- If self-review reveals issues: Fix them before committing
- If push fails: Report error (might be network, permissions, or remote state issue)

## Notes

- This skill enforces the complete workflow from CLAUDE.md
- Multiple rounds of work can be committed and pushed to the same branch
- PR creation is intentionally NOT part of this workflow - user must explicitly request it
- The self-review checklist prevents common mistakes before they reach code review
