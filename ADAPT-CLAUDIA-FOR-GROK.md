# Adapt Claudia for Grok Build (any install)

Use this if you run Claudia (via `npx get-claudia` or a local install) and want her to work well under **Grok Build** (including Grok 4.5 / grok-build runtimes), not only Claude Code.

Public kit: **https://github.com/kbanc85/claudia-grok**  
Paste-only file: **[PROMPT.md](./PROMPT.md)**

You do **not** need to rewrite Claudia from scratch. Grok already loads Claude-compatible skills, rules, and project instructions. The work is a small **runtime bridge**: session start, tool vocabulary, agent dispatch, and memory discipline.

---

## What you get

After a successful adapt pass:

| Capability | Behavior |
|------------|----------|
| Identity | Same Claudia (`Claude.md` / `CLAUDE.md` + rules) |
| Memory | Still **claudia-memory** MCP (not Grok experimental memory) |
| Session start | Briefing written to a file Grok can read (Grok ignores SessionStart stdout) |
| Skills | High-frequency skills work with Grok tools (`spawn_subagent`, MCP via `use_tool`, etc.) |
| Team / helpers | Product agents spawnable as `subagent_type` under `~/.grok/agents/` |
| Safety | External actions still need your explicit yes |

---

## Prerequisites

1. A working Claudia install (folder with `Claude.md` or `CLAUDE.md`, `.claude/`, `context/`).
2. [Grok Build](https://x.ai) CLI installed and authenticated (`grok`).
3. Open a session **from inside your Claudia folder** (or with that folder as the workspace).
4. Memory daemon healthy if you use enhanced memory: `claudia system-health` (optional but recommended).
5. Trust project hooks once if prompted: `/hooks-trust`.

Optional: keep Claude Code as a second host. Dual-runtime files should not break Claude.

---

## How to run (any user)

1. `cd` into your Claudia install.
2. Start Grok Build in that directory (`grok`), **or** Claude Code if you prefer the agent that will write the files.
3. Paste the prompt from **[PROMPT.md](./PROMPT.md)** as a single user message.
4. Let the agent implement, then open a **fresh** Grok session and try: “morning brief”, “what do you know about me?”, a short research ask.

### Manual path (no agent)

Copy files from [`templates/`](./templates/) into your install (see [README](./README.md)).

---

## After the prompt finishes

Run these yourself in a **new** Grok session from the Claudia folder:

| Test | You say | Healthy result |
|------|---------|----------------|
| Session | (first message of the day) | Logo/greeting, memory-aware open, or clear “memory down” disclosure |
| Brief | `morning brief` / “what’s on my plate” | Structured brief from memory or context files |
| Memory | “what do you know about me?” | Profile + memory, not a blank slate |
| Research | “look into [safe public topic]” | Sources + synthesis; multi-source uses research agent if configured |
| Email | “draft a reply to …” (if Gmail MCP is set up) | Draft shown; **no send** until you say yes |

If hooks did not run: `/hooks-trust`, then start another session.  
If agents are missing from the catalog: confirm files exist under `~/.grok/agents/` and restart Grok.

---

## What the agent should create (checklist)

```
your-claudia-install/
  docs/grok-runtime/
    README.md
    SCOREBOARD.md
  .claude/rules/grok-runtime.md
  .claude/hooks/grok-session-start.py
  .claude/skills/agent-dispatcher.md   (updated or new)
  .grok/hooks/session-start.json

~/.claudia/runtime/last-session-briefing.md   (generated at session start)
~/.grok/agents/
  document-archivist.md
  document-processor.md
  schedule-analyst.md
  … (any other .claude/agents + optional personal team)
  README.md
```

---

## Design principles (for humans)

1. **Mirror the OS, not the hard drive.** Identity, rules, skills, memory, agents — not every client folder and `node_modules`.
2. **Compat first.** Grok already scans `.claude/skills` and `.claude/rules`. Add a bridge; don’t duplicate the catalog.
3. **File bridge for SessionStart.** Write `~/.claudia/runtime/last-session-briefing.md`; teach the parent to read it.
4. **One memory.** claudia-memory MCP only.
5. **Parent orchestrates.** No nested subagents on Grok.
6. **Dual-runtime.** Same install should still work in Claude Code.

---

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| No briefing file | Run the hook manually: `CLAUDE_PROJECT_DIR="$PWD" python3 .claude/hooks/grok-session-start.py` |
| “Memory tools unavailable” | `claudia system-health`; check `.mcp.json` for `claudia-memory`; restart Grok |
| Skills fire but Task tool errors | Ensure `agent-dispatcher` + skill runtime notes map Task → `spawn_subagent` |
| Agents not in spawn list | Fresh session; files under `~/.grok/agents/*.md` with `name:` frontmatter |
| Hooks never run | `/hooks-trust`; confirm `.grok/hooks/session-start.json` |
| Double memory / weird facts | Disable Grok experimental memory for Claudia work; stick to claudia-memory |

---

## Optional: personal standing team

If you built custom agents (beyond product defaults) under `~/.claude/agents/` or a monorepo agents folder:

- Copy/adapt them into `~/.grok/agents/` with Grok frontmatter (same as product agents).
- Keep a sync script if personas are edited in one place only.
- Encode non-negotiable gates in the always-on rule (e.g. “research always via agent X”, “verify visual renders yourself”).

---

## Sharing this with others

- Link the kit: https://github.com/kbanc85/claudia-grok  
- Or the prompt only: https://github.com/kbanc85/claudia-grok/blob/main/PROMPT.md  
- Share copy that actually helps: [SHARE.md](./SHARE.md)

---

*Runtime bridge, not a rewrite. Adapt and create.*
