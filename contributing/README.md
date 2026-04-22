# Contributing — AI Tool Setup

This project is built with Claude Code and has rich context files (`CLAUDE.md`, `IMPLEMENTATION.md`, `.claude/agents/`, `.claude/commands/`) that Claude Code reads automatically. If you use a different AI tool, you need to generate equivalent context files first.

## For Claude Code Users

No setup needed. Everything works out of the box. Start coding.

## For Everyone Else

### Option A: Ask your agent to set it up (recommended)

Open your tool and paste this as your **very first prompt**:

**Cursor:**
```
Read contributing/cursor-setup.md in this repo. Create all the files it
specifies (.cursorrules and .cursor/rules/*.mdc) with the exact content shown.
```

**Codex:**
```
Read contributing/codex-setup.md in this repo. Create the AGENTS.md file
at the repo root with the exact content shown.
```

**VS Code + Copilot:**
```
Read contributing/vscode-setup.md in this repo. Create .github/copilot-instructions.md
and .vscode/settings.json with the exact content shown.
```

Your agent will read the guide, create the files, and you're ready to go.

### Option B: Run the setup script

```bash
# Cursor
bash contributing/scripts/setup-cursor.sh

# Codex
bash contributing/scripts/setup-codex.sh

# VS Code + Copilot
bash contributing/scripts/setup-vscode.sh
```

### Option C: Create manually

Follow the step-by-step guide for your tool:
- [Cursor setup](cursor-setup.md)
- [Codex setup](codex-setup.md)
- [VS Code + Copilot setup](vscode-setup.md)

## What Each Tool Gets

| Feature | Claude Code | Cursor | Codex | VS Code + Copilot |
|---------|------------|--------|-------|-------------------|
| Auto-loaded rules | CLAUDE.md (per dir) | .cursorrules (root) | None | copilot-instructions.md |
| Directory-scoped context | Auto | .cursor/rules/*.mdc | None | None |
| Detailed specs | Auto on reference | @mention files | Reference in prompt | #file: or open tab |
| Slash commands | .claude/commands/ | Not available | Not available | Not available |
| Specialized agents | .claude/agents/ | Not available | Not available | Not available |

## What Context Exists in This Repo

```
CLAUDE.md                      ← Root: repo structure, commands, env vars, rules
program/CLAUDE.md              ← Anchor program: accounts, instructions, testing
server/CLAUDE.md               ← Express server: pipeline, API, SSE, auth
dashboard/CLAUDE.md            ← Next.js frontend: routes, components, data fetching
sdk/CLAUDE.md                  ← SDK sync rules

program/IMPLEMENTATION.md      ← Detailed program spec with code examples
server/IMPLEMENTATION.md       ← Detailed server spec with code examples
dashboard/IMPLEMENTATION.md    ← Detailed dashboard spec with code examples

.claude/agents/                ← 5 specialized agent definitions
.claude/commands/              ← 8 slash commands
docs/                          ← Architecture, data contracts, walkthrough, etc.
```

All generated context files (`.cursorrules`, `AGENTS.md`, `copilot-instructions.md`) point to these source files rather than duplicating their content. This keeps them lightweight and always in sync.

## These files are gitignored

Generated context files are personal — they're in `.gitignore` and won't be committed:

```
.cursorrules          ← Cursor
.cursor/              ← Cursor directory-scoped rules
AGENTS.md             ← Codex
.github/copilot-instructions.md  ← VS Code (already in .github/)
.vscode/              ← VS Code settings (already gitignored)
```

Each contributor runs their own setup. The source of truth stays in `CLAUDE.md` and `IMPLEMENTATION.md` files (which are committed).

## Keeping Context Updated

If `CLAUDE.md` or `IMPLEMENTATION.md` files change, the generated context files don't auto-update. Re-run your setup script or re-generate manually.

The generated files only contain **pointers and critical rules** — the detailed specs live in the source files and are always up to date.
