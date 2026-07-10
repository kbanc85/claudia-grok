#!/usr/bin/env python3
"""Grok-compatible SessionStart hook for Claudia.

Grok Build ignores SessionStart stdout for model injection (unlike Claude Code's
additionalContext). This hook therefore:

1. Probes/repairs the memory daemon (bounded timeouts).
2. Fetches a compact briefing from http://localhost:3848/briefing when possible.
3. Writes ~/.claudia/runtime/last-session-briefing.md for the parent to read.
4. Still prints Claude-style {"additionalContext": ...} so Claude Code keeps working
   if this script is also wired there.

Fail-open: never block session start; never raise out of main.

Source: https://github.com/kbanc85/claudia-grok
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DAEMON_HEALTH_URL = "http://localhost:3848/health"
DAEMON_BRIEFING_URL = "http://localhost:3848/briefing"
LAUNCHD_LABEL = "com.claudia.memory"
LAUNCHD_PLIST = Path.home() / "Library" / "LaunchAgents" / "com.claudia.memory.plist"
RUNTIME_DIR = Path.home() / ".claudia" / "runtime"
BRIEFING_FILE = RUNTIME_DIR / "last-session-briefing.md"


def _daemon_up(timeout: float = 2.0) -> bool:
    try:
        req = urllib.request.Request(DAEMON_HEALTH_URL)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return getattr(resp, "status", 200) == 200
    except Exception:
        return False


def _fetch_briefing(timeout: float = 3.0) -> str | None:
    try:
        req = urllib.request.Request(DAEMON_BRIEFING_URL)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            text = data.get("briefing")
            return text if isinstance(text, str) and text.strip() else None
    except Exception:
        return None


def _launchd_restart() -> None:
    if sys.platform != "darwin" or not LAUNCHD_PLIST.exists():
        return
    for action in ("unload", "load"):
        try:
            subprocess.run(
                ["launchctl", action, str(LAUNCHD_PLIST)],
                capture_output=True,
                timeout=5,
            )
        except Exception:
            pass


def _ensure_daemon() -> str:
    try:
        if _daemon_up():
            return "Memory daemon: healthy."
        if sys.platform == "darwin" and LAUNCHD_PLIST.exists():
            _launchd_restart()
            time.sleep(2)
            if _daemon_up():
                return "Memory daemon was down; auto-restarted via launchd. Memory available."
        return (
            "Memory daemon is not responding. "
            "Run `claudia system-health` and/or reinstall LaunchAgent with `npx get-claudia .`. "
            "Work from context/ files only until fixed."
        )
    except Exception:
        return "Memory daemon status unknown (health probe failed open)."


def _project_dir() -> Path:
    for key in ("CLAUDE_PROJECT_DIR", "GROK_WORKSPACE_ROOT"):
        val = os.environ.get(key)
        if val:
            return Path(val)
    return Path.cwd()


def _profile_snippet(project: Path, limit: int = 1200) -> str:
    path = project / "context" / "me.md"
    if not path.exists():
        return ""
    try:
        return path.read_text(encoding="utf-8")[:limit]
    except OSError:
        return ""


def _list_grok_agents() -> list[str]:
    agents_dir = Path.home() / ".grok" / "agents"
    if not agents_dir.is_dir():
        return []
    names = []
    for p in sorted(agents_dir.glob("*.md")):
        if p.name.lower() == "readme.md":
            continue
        names.append(p.stem)
    return names


def _write_briefing_file(body: str) -> None:
    try:
        RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
        BRIEFING_FILE.write_text(body, encoding="utf-8")
    except OSError:
        pass


def main() -> int:
    project = _project_dir()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    daemon_note = _ensure_daemon()
    briefing = _fetch_briefing() if "healthy" in daemon_note or "auto-restarted" in daemon_note else None
    if briefing is None and _daemon_up():
        briefing = _fetch_briefing()

    sections = [
        "# Claudia session briefing (Grok runtime)",
        "",
        f"Generated: {now}",
        f"Project: {project}",
        "",
        "## Daemon",
        daemon_note,
        "",
        "## Instructions for Claudia (parent)",
        "1. Treat this file as a SessionStart packet if still same day / recent.",
        "2. Prefer a live `memory_briefing` MCP call when tools are available.",
        "3. Greet with logo; surface at most 3 urgent items.",
        "4. Do not use Grok experimental memory as a substitute for claudia-memory.",
        "",
    ]

    if briefing:
        sections.extend(["## Session Briefing (from daemon)", briefing, ""])
    else:
        sections.extend(
            [
                "## Session Briefing (from daemon)",
                "No briefing available from the daemon HTTP endpoint.",
                "Call `memory_briefing` via MCP, or read context/commitments.md and context/waiting.md.",
                "",
            ]
        )

    profile = _profile_snippet(project)
    if profile:
        sections.extend(["## Profile snippet (context/me.md)", profile, ""])

    agent_names = _list_grok_agents()
    sections.append("## Team quick map (spawn_subagent)")
    if agent_names:
        sections.append("Available agent files under ~/.grok/agents/:")
        for name in agent_names[:20]:
            sections.append(f"- `{name}`")
        if len(agent_names) > 20:
            sections.append(f"- … +{len(agent_names) - 20} more")
    else:
        sections.extend(
            [
                "- Product defaults (if installed): document-archivist, document-processor, schedule-analyst",
                "- Research: preferred research agent or parent-led web tools",
                "- No ~/.grok/agents/*.md found yet; adapt prompt creates them.",
            ]
        )
    sections.append("")

    body = "\n".join(sections)
    _write_briefing_file(body)

    try:
        print(json.dumps({"additionalContext": body[:12000]}))
    except Exception:
        print(json.dumps({"additionalContext": "Grok session-start hook completed."}))

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        try:
            print(json.dumps({"additionalContext": "Grok session-start hook failed open."}))
        except Exception:
            pass
        raise SystemExit(0)
