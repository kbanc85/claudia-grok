# Claudia for Grok

**Make your Claudia install work on [Grok Build](https://x.ai) — same memory, same approval gates, same high-frequency workflows.**

This is a **runtime bridge**, not a rewrite. Grok already loads Claude-compatible skills and rules. You add a thin layer so session start, agents, and tools behave correctly.

> Claudia itself: [`npx get-claudia`](https://github.com/kbanc85/claudia) · main project: [kbanc85/claudia](https://github.com/kbanc85/claudia)

---

## Do this (3 steps)

### 1. Open your Claudia folder in Grok

```bash
cd /path/to/your/claudia-install
grok
```

You need a normal Claudia install (`Claude.md` or `CLAUDE.md`, `.claude/`, `context/`).

### 2. Paste the adapt prompt

Copy the full prompt from either:

- **[PROMPT.md](./PROMPT.md)** (paste-ready only), or  
- **[ADAPT-CLAUDIA-FOR-GROK.md](./ADAPT-CLAUDIA-FOR-GROK.md)** (guide + prompt + troubleshooting)

Paste it as **one** user message. Let the agent implement.

### 3. Fresh session + smoke test

1. Start a **new** Grok session in the same folder.  
2. If prompted: `/hooks-trust`  
3. Say: **`morning brief`**

Healthy result: structured brief from memory (or context files), not a blank stranger.

| Also try | Expect |
|----------|--------|
| “what do you know about me?” | Profile + memory |
| “look into [public topic]” | Research with sources |
| “draft a reply to …” (if Gmail is connected) | Draft only; no send until you say yes |

---

## What you get

| Piece | Why it matters |
|-------|----------------|
| Always-on `grok-runtime` rule | Session start + memory + tool translation |
| SessionStart hook → `~/.claudia/runtime/last-session-briefing.md` | Grok ignores SessionStart stdout; the file is the bridge |
| Dual-runtime agent dispatcher | Claude Task tool **and** Grok `spawn_subagent` |
| Product agents under `~/.grok/agents/` | Archivist, processor, schedule, research routes, … |
| Tier A skill notes | morning-brief, inbox, research, meditate, email draft |

**Does not:** rewrite Claudia, port your content trees, or replace claudia-memory with Grok experimental memory.

---

## Claudia's Brain (Grok Bot Page)

Hosted canvas for the public Grok Bot template: [`grokbot/brain/`](./grokbot/brain/) — download [`claudia-brain.canvas.tsx`](./grokbot/brain/claudia-brain.canvas.tsx) from the raw URL documented there.

## Prefer copy-paste templates?

If you want files without running the agent, see [`templates/`](./templates/):

| Template | Copy into your install |
|----------|------------------------|
| `templates/rules/grok-runtime.md` | `.claude/rules/grok-runtime.md` |
| `templates/hooks/grok-session-start.py` | `.claude/hooks/grok-session-start.py` (executable) |
| `templates/hooks/session-start.json` | `.grok/hooks/session-start.json` |
| `templates/skills/agent-dispatcher.md` | `.claude/skills/agent-dispatcher.md` |
| `templates/docs/*` | `docs/grok-runtime/` |

Then run the hook once:

```bash
chmod +x .claude/hooks/grok-session-start.py
CLAUDE_PROJECT_DIR="$PWD" python3 .claude/hooks/grok-session-start.py
```

---

## Design principles

1. **Mirror the OS, not the hard drive** — identity, rules, skills, memory, agents; not every client folder.  
2. **Compat first** — Grok already scans `.claude/skills` and `.claude/rules`.  
3. **File bridge for SessionStart** — write a briefing file the parent can read.  
4. **One memory** — claudia-memory MCP only.  
5. **Parent orchestrates** — Grok subagents cannot nest.  
6. **Dual-runtime** — Claude Code should still work.

---

## Share / tweet

Link this repo (or the prompt file) so people get a real destination:

```text
https://github.com/kbanc85/claudia-grok
```

Paste-ready prompt only:

```text
https://github.com/kbanc85/claudia-grok/blob/main/PROMPT.md
```

See [SHARE.md](./SHARE.md) for short copy that actually helps.

---

## Related

| Repo | Role |
|------|------|
| [kbanc85/claudia](https://github.com/kbanc85/claudia) | Full Claudia product |
| [kbanc85/claudia-core](https://github.com/kbanc85/claudia-core) | Host-agnostic core layer (broader multi-host work) |
| **This repo** | Practical Grok Build adapt kit for existing installs |

---

## License

MIT — see [LICENSE](./LICENSE).

*Runtime bridge, not a rewrite. Adapt and create.*
