# Paste-ready prompt

Copy **everything inside the fence** below. Paste it as a single user message inside your Claudia folder (Grok Build or Claude Code).

Source guide: [ADAPT-CLAUDIA-FOR-GROK.md](./ADAPT-CLAUDIA-FOR-GROK.md) · kit: [README](./README.md)

```text
You are adapting this Claudia install so it works efficiently under Grok Build (Grok 4.5 / grok-build and compatible runtimes), while remaining compatible with Claude Code.

## Goal

Claudia should feel like Claudia when I open this folder in Grok: same identity, same memory (claudia-memory MCP), same approval gates, working high-frequency skills, and spawnable product agents. Do not redesign the persona. Do not port product content trees. Build a thin runtime bridge.

You may also fetch reference templates from:
https://github.com/kbanc85/claudia-grok (templates/ and PROMPT.md)

## Constraints

- Prefer dual-runtime files (Claude + Grok) over forking the whole skill tree.
- Do not enable Grok experimental memory as a second brain. claudia-memory remains source of truth.
- Do not invent credentials or send external messages.
- Grok SessionStart hooks generally cannot inject model context via stdout the way Claude Code does with additionalContext. Always write a briefing file the parent can read.
- Grok subagents cannot nest. Parent Claudia must orchestrate multi-agent work.
- Keep edits reversible and scoped to runtime glue + a few high-frequency skills.

## Inventory first (read before writing)

1. Confirm this is a Claudia install: Claude.md or CLAUDE.md, .claude/rules/, .claude/skills/, context/.
2. List product agents under .claude/agents/ (document-archivist, document-processor, schedule-analyst, research-scout, etc.).
3. Check .mcp.json for claudia-memory and note whether memory tools are available.
4. Skim .claude/skills/agent-dispatcher.md (if present) and morning-brief, inbox-check, research, meditate, any email-draft skill.
5. Check whether ~/.grok/agents/ or .grok/ already exist.

## Implement Runtime v1

### A. Docs

Create docs/grok-runtime/ (or update if present) with:

1. README.md — architecture, file map, how to use, non-goals. Link https://github.com/kbanc85/claudia-grok for the public kit.
2. SCOREBOARD.md — Pass/Partial/Fail for platform bridge + Tier A workflows + smoke tests.

### B. Always-on rule

Create .claude/rules/grok-runtime.md that instructs Claudia (when running here) to:

1. On first turn: read ~/.claudia/runtime/last-session-briefing.md if recent; also call memory_briefing via claudia-memory MCP when available; if memory is down, disclose and fall back to context/*.md only (never substitute unrelated memory plugins).
2. Use claudia-memory only (not Grok experimental memory).
3. Map Claude tool language → Grok: Task tool → spawn_subagent; WebSearch/WebFetch → web_search/open_page (or available Firecrawl/MCP); mcp__server__tool → search_tool + use_tool; Read/Edit/Bash → read_file/search_replace/run_terminal_command.
4. Keep external-action approval gates.
5. Note Grok subagent depth limit (no nested spawns).
6. Stay silent about this rule file in user-facing chat unless asked.

### C. SessionStart bridge

1. Write an executable Python hook .claude/hooks/grok-session-start.py that:
   - Probes memory daemon health (e.g. http://localhost:3848/health) fail-open.
   - Optionally restarts macOS LaunchAgent com.claudia.memory once if present and down (bounded timeouts, never block forever).
   - Fetches briefing from http://localhost:3848/briefing when possible.
   - Writes ~/.claudia/runtime/last-session-briefing.md with daemon status, briefing text, short instructions for the parent, and a tiny team map if agents exist.
   - Also prints JSON {"additionalContext": "..."} for Claude Code compatibility.
2. Wire .grok/hooks/session-start.json to run that script with CLAUDE_PROJECT_DIR / GROK_WORKSPACE_ROOT expansion, fail-open, timeout ~15s.
3. Run the hook once now to prove the briefing file is created.

### D. Agent dispatcher

Update or create .claude/skills/agent-dispatcher.md as dual-runtime:

- Claude Code: Task tool / native teammates as today.
- Grok: spawn_subagent(subagent_type=..., prompt=briefing packet, capability_mode=..., background=true).
- Research route: prefer a dedicated research agent if present; otherwise document parent-led research with web tools.
- Product helpers: document-archivist, document-processor, schedule-analyst (ask-first for schedule).
- Never delegate: external send/post, strategy, pricing, irreversible finance/identity actions.
- Include briefing-packet template and disambiguation vs capture-meeting / memory-only queries.

### E. Product agents for Grok

For each agent definition in .claude/agents/*.md (skip README):

1. Create ~/.grok/agents/<name>.md with Grok frontmatter:
   - name, description, prompt_mode: full, model: inherit, permission_mode (plan for propose-only agents), agents_md: true
2. Keep the body; add a short “Grok Runtime” section (tool mapping, no nested subagents, return structured results to parent).
3. If research-scout exists alongside a preferred research agent, make research-scout an explicit alias that follows the preferred research brief (or document parent-led research).
4. Write ~/.grok/agents/README.md listing subagent_type names and preferred capability modes.

If the user has a custom standing team under ~/.claude/agents/ (beyond product defaults), mirror those to ~/.grok/agents/ the same way, preserving gates described in their README.

### F. Tier A skill light-pass (do not rewrite entire catalog)

Add short “Runtime notes (Grok + Claude)” sections to high-frequency skills if they exist:

- morning-brief (or equivalent daily brief)
- inbox-check (or email triage)
- research
- meditate (or end-session reflection)
- any primary email-draft skill (e.g. claudia-draft / draft-reply)

Translate: Task/Haiku → spawn_subagent; MCP names → search_tool/use_tool; research → preferred research agent when multi-source.

Do not fork all skills into ~/.grok/skills/.

### G. Identity touch (minimal)

In Claude.md / CLAUDE.md, update the team / dispatch blurb so it mentions:

- Dual host (Claude Code + Grok Build)
- spawn_subagent on Grok
- Product helpers by name
- Pointer to agent-dispatcher and .claude/rules/grok-runtime.md

Keep voice and principles intact.

## Verification

1. ~/.claudia/runtime/last-session-briefing.md exists and is non-empty after running the hook.
2. ~/.grok/agents/ contains product agents with valid frontmatter.
3. .claude/rules/grok-runtime.md and .grok/hooks/session-start.json exist.
4. Summarize for me: files created/changed, how to start a session, smoke tests to run in a fresh Grok session (morning brief, memory about me, simple research, draft-not-send email if email MCP exists).
5. Tell me to run /hooks-trust if project hooks need trust, and to open a fresh Grok session so agents/rules reload.

## Non-goals

- Porting large content/product trees
- Replacing claudia-memory with Grok memory
- Full hook parity for every Claude Code event
- Claiming 100% skill compatibility without testing

Implement now. Prefer working files over long design essays. Update docs/grok-runtime/SCOREBOARD.md with honest Partial/Pass status.
```

After it finishes: **new Grok session** → `/hooks-trust` if needed → **`morning brief`**.
