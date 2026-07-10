# Claudia Runtime for Grok (local install)

**Status:** Runtime v1  
**Public kit:** https://github.com/kbanc85/claudia-grok

Goal: When you open this Claudia folder in Grok Build, she behaves like Claudia: same memory, same gates, working high-frequency workflows.

Any Claudia user: paste-ready adapt prompt → https://github.com/kbanc85/claudia-grok/blob/main/PROMPT.md

---

## Architecture

```
Claudia parent (Grok session in your install)
├── Always-on: Claude.md + .claude/rules/* + grok-runtime.md
├── SessionStart: .grok/hooks → writes ~/.claudia/runtime/last-session-briefing.md
├── Skills: .claude/skills/* (Claude compat scan) + Tier A notes
├── Dispatch: agent-dispatcher skill (Grok spawn map)
└── Teammates: ~/.grok/agents/* (subagent_type by name)
         └── Memory: claudia-memory MCP only
```

---

## How to use

1. `cd` to the Claudia install and run `grok`.
2. Trust project hooks once: `/hooks-trust` if prompted.
3. First turn: read the briefing file or call `memory_briefing`, greet, surface urgents.
4. Delegate with `spawn_subagent(subagent_type="…")`.

---

## Non-goals

- Porting product content trees
- Dual-writing facts into Grok experimental memory
- Nested subagents (parent orchestrates)
