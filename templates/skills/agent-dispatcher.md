---
name: agent-dispatcher
description: Detects when to delegate tasks to specialized agents. Dual-runtime: Claude Code Task tool + Grok Build spawn_subagent. Use proactively when work matches a teammate lane.
user-invocable: false
invocation: proactive
---

# Agent Dispatcher (dual runtime)

Use this skill when work matches a specialized agent lane. **Do not** invent a second brain or dual-write memory.

Public kit: https://github.com/kbanc85/claudia-grok

## When to dispatch

| Signal | Route |
|--------|--------|
| Multi-source research / fact-check / news | Research agent if present; else parent + web tools |
| Code, infra, deploys, migrations | Code agent if present; else parent |
| Editorial / brand voice polish | Editorial agent if present |
| Client prep, meeting capture structure, health | Client agent if present |
| Video / motion / carousels / decks | Visual agent if present; **parent verifies real frames** |
| Invoices / SOW / P&L / tax | Finance agent if present |
| Vault hygiene / orphan notes | Plan-only vault agent if present |
| Pasted long content to file | `document-archivist` |
| Tables / action items extraction | `document-processor` |
| Calendar pattern analysis | `schedule-analyst` (ask first) |

## Never dispatch

- Sending email / posting / payments / deleting shared data
- Strategy, pricing, final judgment
- Family / personal matters the user keeps with the parent

## Claude Code path

Use the host’s Task / teammate tool with the agent name and a full briefing packet:

```
Task(subagent_type="<name>", prompt="<briefing packet>")
```

## Grok Build path

```
spawn_subagent(
  subagent_type="<name>",
  description="short label",
  prompt="<briefing packet>",
  capability_mode="all" | "read-only" | "read-write",
  background=true
)
```

Then collect with `get_command_or_subagent_output` when needed.

**Depth limit:** subagents cannot spawn subagents. Parent orchestrates multi-step chains.

## Briefing packet template

```text
## Mission
<what done looks like>

## Context
- User intent:
- Relevant entities / paths:
- Constraints (approval gates, dual-runtime, no external send):

## Sources to read first
- ...

## Output contract
- Format:
- What to return to parent:
- What NOT to do (send, post, delete, nest agents):
```

## Disambiguation

| User said | Prefer | Not |
|-----------|--------|-----|
| “capture this meeting” | capture-meeting skill | random agent |
| “what do you know about X?” | memory_about / memory_recall | research agent |
| “research X” | research agent / research skill | memory-only |
| “file this paste” | document-archivist | full research pipeline |

## Runtime notes (Grok + Claude)

- Map `mcp__…` names via `search_tool` + `use_tool` on Grok.
- Prefer `background: true` for long work on Grok.
- Product agents live under `~/.grok/agents/*.md` on Grok; under `.claude/agents/` for Claude product defaults.
