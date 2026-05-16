# Claude Code Hooks for aha-mcp

This directory contains project-wide hooks that enforce safety policies when working with Claude Code.

## Hooks

### `pre-tool-use-bash.sh`

Enforces git workflow safety rules:

1. **Branch Protection** - Blocks commits directly to `main` branch
   - Forces use of feature branches with naming pattern: `claude/<description>-<timestamp>`
   
2. **Build Validation** - Runs `npm run build` before allowing commits
   - Ensures TypeScript compiles cleanly before changes are committed
   
3. **Remote Verification** - Checks git remote before pushes
   - Ensures remote points to `jcoplen-smart/aha-mcp` (not upstream fork)

## How Hooks Work

- Hooks are **automatically executed** by Claude Code when matching tool calls occur
- `pre-tool-use-bash.sh` runs before any Bash tool execution
- If a hook exits with code 1 and outputs JSON with `"continue": false`, the operation is blocked
- Hooks are **version-controlled** and apply to all team members

## Hook vs Settings

- **Hooks** (in `.claude/hooks/`) are checked into git and shared with the team
- **Settings** (`.claude/settings.json`) are gitignored and contain user-specific permissions

This ensures safety policies are enforced consistently across the team while allowing individual workflow preferences.

## Testing Hooks

To manually test a hook:
```bash
# Simulate a git commit command
echo '{"tool_input": {"command": "git commit -m test"}}' | .claude/hooks/pre-tool-use-bash.sh
```

Exit code 0 = passed, exit code 1 = blocked
