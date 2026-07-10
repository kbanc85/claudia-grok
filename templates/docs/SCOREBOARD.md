# Grok Runtime Scoreboard

Last updated: (fill after adapt)  
Public kit: https://github.com/kbanc85/claudia-grok

Legend: **Pass** works end-to-end · **Partial** usable with caveats · **Fail** broken · **N/A** not needed

## Platform bridge

| Surface | Status | Notes |
|---------|--------|-------|
| Identity (`Claude.md` / `CLAUDE.md`) | | |
| Rules (`.claude/rules/*` + `grok-runtime.md`) | | |
| claudia-memory MCP | | |
| Grok experimental memory | N/A | Keep **off** |
| Product agents `~/.grok/agents/` | | |
| Skill discovery | | |
| SessionStart briefing file | | Grok ignores SessionStart stdout |
| Nested subagents | Fail (platform) | Parent orchestrates |

## Tier A workflows

| Workflow | Status | Notes |
|----------|--------|-------|
| Session greeting | | |
| Morning brief | | |
| Inbox check | | |
| Research | | |
| Email draft (no send) | | |
| Meditate / end session | | |

## Smoke tests (fresh Grok session)

| # | Prompt | Result (Pass/Fail) |
|---|--------|--------------------|
| 1 | (open session) | |
| 2 | “morning brief” | |
| 3 | “research X” | |
| 4 | “check my inbox” | |
| 5 | “draft a reply…” | |
| 6 | “meditate” | |

Update this file when a smoke test flips Pass/Fail.
