#!/usr/bin/env bash
# Pre-commit and pre-push safety checks for aha-mcp project
#
# This hook runs before Bash tool executions and enforces:
# 1. No commits directly to main branch
# 2. Build must pass before commits
# 3. Git remote must point to jcoplen-smart/aha-mcp before pushes

# Read the tool call JSON from stdin
INPUT=$(cat)

# Extract the command being executed
COMMAND=$(echo "$INPUT" | python -c "import sys, json; data = json.load(sys.stdin); print(data.get('tool_input', {}).get('command', ''))" 2>/dev/null || echo "")

# Check if this is a git commit command
if [[ "$COMMAND" == git\ commit* ]]; then
    # Hook 1: Check if on main branch
    BRANCH=$(git branch --show-current)
    if [ "$BRANCH" = "main" ]; then
        echo '{
            "stopReason": "Cannot commit directly to main branch. Create a feature branch first with:\n  git checkout -b claude/<description>-'$(date +%s)'",
            "continue": false
        }'
        exit 1
    fi

    # Hook 2: Run build validation
    if ! npm run build >/dev/null 2>&1; then
        echo '{
            "stopReason": "Build failed. Run \"npm run build\" to see errors.",
            "continue": false
        }'
        exit 1
    fi
fi

# Check if this is a git push command
if [[ "$COMMAND" == git\ push* ]]; then
    # Hook 3: Verify remote points to correct repository
    if ! git remote -v | grep -q 'jcoplen-smart/aha-mcp'; then
        echo '{
            "stopReason": "Remote does not point to jcoplen-smart/aha-mcp. Verify with: git remote -v",
            "continue": false
        }'
        exit 1
    fi
fi

# All checks passed
exit 0
