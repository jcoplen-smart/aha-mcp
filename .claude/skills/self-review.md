# Self-Review

Runs the self-review checklist from CLAUDE.md to validate changes before committing.

## Usage

```
/self-review
```

Run this before committing to catch common issues early.

## What This Skill Does

Executes the "Self-review checklist before committing" from CLAUDE.md:

1. **Review recent changes** (staged or uncommitted)
2. **Run through 7-point checklist** systematically
3. **Check build status**
4. **Report findings** with specific issues or confirmation

This catches convention violations before they reach code review.

## Instructions for Claude

When this skill is invoked:

### Step 1: Identify Changes to Review

```bash
# Show staged changes (what would be committed)
git diff --staged --name-only

# If nothing staged, show unstaged changes
git diff --name-only

# Get stats on changes
git diff --staged --stat || git diff --stat
```

If no changes are detected:
- Report: "No changes to review. Stage your changes with `git add` first."
- Exit

### Step 2: Read Changed Files

For each changed file (especially TypeScript files), read the file to understand:
- What was added or modified
- Whether new tools were added
- Whether existing patterns were followed

Focus on:
- `src/handlers.ts` - new or modified handlers
- `src/index.ts` - tool registrations
- `src/types.ts` - type definitions
- `src/queries.ts` - API query functions

### Step 3: Run the Checklist

Go through each item systematically:

#### 1. Identifier Types
✅ **Do all new tools accept identifier types the user can actually see in the Aha! UI?**

Check:
- Do parameters accept reference IDs (e.g., `STU-E-54`, `LUM-C-1`)?
- Or do they require numeric IDs that users can't easily obtain?
- If numeric IDs are needed, is there a resolution step from reference ID?

**Report:** Pass/Fail with specific examples

#### 2. Parameter Naming
✅ **Do parameter names match the convention in existing fork-added handlers?**

Check:
- Grep existing handlers for similar tools
- Compare parameter naming patterns
- Ensure consistency (e.g., `epic_id` vs `epicId` vs `epic_reference_id`)

```bash
# Example: check how other tools name similar parameters
grep -n "epic_id\|feature_id\|reference_id" src/handlers.ts | head -20
```

**Report:** Pass/Fail with inconsistencies noted

#### 3. Return Shapes
✅ **Do return shapes match the convention established by similar existing tools?**

Check:
- Do handlers return `{ content: [{ type: "text", text: JSON.stringify(...) }] }`?
- Is error handling consistent?
- Are response structures similar to related tools?

**Report:** Pass/Fail with specific examples

#### 4. Error Handling
✅ **Is error handling consistent with the existing pattern in handlers.ts?**

Check:
- Are errors wrapped in `McpError` with `ErrorCode.InternalError`?
- Are error messages informative?
- Is the pattern: `throw new McpError(ErrorCode.InternalError, "message")`?

**Report:** Pass/Fail with examples

#### 5. Tool Registration
✅ **Is the new tool registered in src/index.ts with a clear, specific description string?**

If new tools were added, check `src/index.ts`:
```bash
grep -A 5 "server.tool" src/index.ts | tail -20
```

Check:
- Is the tool registered?
- Is the description clear and specific (not generic)?
- Are input schemas properly defined?

**Report:** Pass/Fail - list unregistered tools if any

#### 6. Build Status
✅ **Does npm run build pass cleanly?**

```bash
npm run build
```

Check:
- Does TypeScript compilation succeed?
- Are there any type errors?
- Does the build complete without warnings?

**Report:** Pass/Fail with errors if any

#### 7. Hardcoded Values
✅ **Are there any hardcoded values that should be parameters?**

Review the changed code for:
- Hardcoded domain names
- Hardcoded IDs
- Hardcoded product/workspace references
- Magic numbers or strings that should be configurable

**Report:** Pass/Fail with specific findings

### Step 4: Generate Report

Provide a summary report:

```
## Self-Review Results

✅ 1. Identifier Types: PASS
✅ 2. Parameter Naming: PASS  
✅ 3. Return Shapes: PASS
✅ 4. Error Handling: PASS
✅ 5. Tool Registration: PASS
✅ 6. Build Status: PASS
✅ 7. Hardcoded Values: PASS

All checks passed! Changes are ready to commit.
```

Or if issues found:

```
## Self-Review Results

✅ 1. Identifier Types: PASS
❌ 2. Parameter Naming: FAIL
   - Handler `handleCreateCompetitor` uses `competitorId` but existing handlers use `competitor_id`
   - Inconsistent with fork conventions
   
✅ 3. Return Shapes: PASS
⚠️  4. Error Handling: WARNING
   - Line 2145: Error not wrapped in McpError
   
✅ 5. Tool Registration: PASS
✅ 6. Build Status: PASS
✅ 7. Hardcoded Values: PASS

⚠️ Found 1 failure and 1 warning. Please fix before committing.
```

### Step 5: Provide Recommendations

If issues were found:
- List specific files and line numbers
- Suggest fixes for each issue
- Offer to fix them automatically if user wants

If all checks passed:
- Confirm changes are ready to commit
- Suggest next steps (commit message, etc.)

## Error Handling

- If no changes to review: Report and exit gracefully
- If build fails: Report full error output
- If files can't be read: Report specific permission/path issues

## Notes

- This skill is designed to be run BEFORE committing, not after
- Catching issues at self-review is faster than waiting for Codex
- The checklist focuses on common convention violations in this project
- Can be run multiple times as you iterate on changes
- Complements but doesn't replace actual code review
