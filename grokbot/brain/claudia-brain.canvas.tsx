import { Button, Input, Metrics, Page, Select, Toggle, Status, Text, useEffect, useGrokTheme, useMemo, useRef, useState } from "grok/canvas";
import type { PointerEvent, ReactNode } from "grok/canvas";

// Claudia rebuilds this Page in place: she replaces only the block between the LEDGER-DATA
// markers with JSON exported from the Claudia Ledger tabs (People, Orgs, Projects, Links,
// Commitments, Interactions) plus owner: { name } (the hub), then overwrites this same Page by
// its id. Allowed fields only: no email, phone, notes_pointer, or rows tagged sensitive.
/* LEDGER-DATA-START */
const LEDGER: Ledger = {
  "generated": "2026-10-24",
  "example": true,
  "owner": {
    "name": "You"
  },
  "people": [
    {
      "id": "P-0001",
      "name": "Alex Rivera",
      "org_id": "O-0001",
      "role": "Partner",
      "network": "work",
      "relationship": "collaborator",
      "cadence_days": 14,
      "last_contact": "2026-10-10",
      "days_since": 14,
      "health": "active",
      "city": "Austin",
      "how_met": "intro"
    },
    {
      "id": "P-0002",
      "name": "Jordan Lee",
      "org_id": "O-0002",
      "role": "Advisor",
      "network": "personal",
      "relationship": "mentor",
      "cadence_days": 30,
      "last_contact": "2026-09-01",
      "days_since": 53,
      "health": "cooling",
      "city": "NYC",
      "how_met": "conference"
    }
  ],
  "orgs": [
    {
      "id": "O-0001",
      "name": "Northwind Labs"
    },
    {
      "id": "O-0002",
      "name": "Harbor Advisory"
    }
  ],
  "projects": [
    {
      "id": "PR-0001",
      "name": "Launch kit",
      "org_id": "O-0001",
      "status": "active"
    }
  ],
  "links": [
    {
      "from_id": "ME",
      "to_id": "O-0001",
      "type": "works_at",
      "basis": "stated",
      "source": "example"
    },
    {
      "from_id": "P-0001",
      "to_id": "PR-0001",
      "type": "owns",
      "basis": "stated",
      "source": "example"
    }
  ],
  "commitments": [
    {
      "id": "C-0001",
      "direction": "I owe",
      "person_id": "P-0001",
      "what": "Send launch draft",
      "due": "2026-10-25",
      "status": "open",
      "source_link": "example"
    },
    {
      "id": "C-0002",
      "direction": "owed to me",
      "person_id": "P-0002",
      "what": "Intro to Harbor board",
      "due": "2026-10-20",
      "status": "open",
      "source_link": "example"
    }
  ],
  "interactions": [
    {
      "id": "I-0001",
      "date": "2026-10-10",
      "person_id": "P-0001",
      "channel": "email",
      "actor": "me",
      "summary": "Synced on launch kit timeline",
      "source_link": "example"
    }
  ]
};
/* LEDGER-DATA-END */

type Person = { id: string; name: string; org_id: string | null; role: string; network: string; relationship: string; cadence_days: number; last_contact: string; days_since: number; health: string; city: string; how_met: string };
type Org = { id: string; name: string };
type Project = { id: string; name: string; org_id: string; status: string };
type Link = { from_id: string; to_id: string; type: string; basis: string; source: string };
type Commitment = { id: string; direction: string; person_id: string; what: string; due: string; status: string; source_link: string };
type Interaction = { id: string; date: string; person_id: string; channel: string; actor: string; summary: string; source_link: string };
type Ledger = { generated: string; example: boolean; owner?: { name: string }; people: Person[]; orgs: Org[]; projects: Project[]; links: Link[]; commitments: Commitment[]; interactions: Interaction[] };
type Kind = "owner" | "person" | "org" | "project";
type GEdge = { from_id: string; to_id: string; type: string; basis: string; kind: "link" | "owner" | "commit"; commit?: Commitment };
type GNode = { id: string; label: string; kind: Kind; health: string | null; network: string | null; weight: number; x: number; y: number; r: number; ph: number };
type Cam = { x: number; y: number; k: number };
type Match = { active: boolean; nodes: Set<string>; edges: Set<number>; commits: Commitment[] };
type Labels = { people: boolean; orgs: boolean; projects: boolean; links: boolean; promises: boolean };
const LABEL_DEFAULTS: Labels = { people: true, orgs: true, projects: true, links: false, promises: false };
const LABEL_ROWS: Array<[keyof Labels, string]> = [["people", "People names"], ["orgs", "Org names"], ["projects", "Project names"], ["links", "Link types"], ["promises", "Promises"]];

const W = 1000;
const H = 700;
const LITE_ABOVE = 200; // above this many nodes: no glow, no drift, no flow (keeps 600+ nodes smooth)
// The owner is the hub. Its id can also appear in Links rows (e.g. ME works_at O-0001).
const OWNER_ID = "ME";
const OWNER_NAME = (LEDGER.owner && LEDGER.owner.name) || "You";

// The graph stage is a <canvas> with its own deep-space palette (dark on both hosts, by design).
const STAGE = {
  bg0: "#02050b", bg1: "#0a1628", grid: "120,170,255", star: "200,222,255", edge: "110,165,255", flow: "#7dd3fc",
  owner: "#fcd34d", ownerCore: "#fffbeb", person: "#4cc9f0", org: "#a78bfa", project: "#f472b6",
  active: "#34d399", cooling: "#fbbf24", inactive: "#7c8798", overdue: "#f87171",
  owe: "#fb923c", owed: "#22d3ee", bot: "#c084fc",
  scrim: "rgba(2,5,11,0.55)",
  label: "rgba(226,236,255,0.94)", labelSoft: "rgba(190,206,235,0.72)", edgeLabel: "rgba(170,212,255,0.96)",
};
const KIND_COLOR: Record<Kind, string> = { owner: STAGE.owner, person: STAGE.person, org: STAGE.org, project: STAGE.project };
const HEALTH_COLOR: Record<string, string> = { active: STAGE.active, cooling: STAGE.cooling, inactive: STAGE.inactive };
const commitColor = (c: Commitment): string => (c.direction === "I owe" ? STAGE.owe : c.direction === "owed to me" ? STAGE.owed : STAGE.bot);
const commitLabel = (c: Commitment): string => (c.direction === "I owe" ? "you owe" : c.direction === "owed to me" ? "owed to you" : c.direction);
const isLate = (c: Commitment): boolean => c.status === "open" && c.due < LEDGER.generated;
const trunc = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1) + "\u2026" : s);
const dayDiff = (a: string, b: string): number => Math.round((Date.parse(a + "T12:00:00Z") - Date.parse(b + "T12:00:00Z")) / 86400000);
// When a promise is due, in words: "due 2026-10-25 (overdue 2 days)".
function dueText(c: Commitment): string {
  if (!c.due) return "no due date";
  if (c.status !== "open") return `due ${c.due} (${c.status})`;
  const d = dayDiff(c.due, LEDGER.generated);
  const rel = d < 0 ? `overdue ${-d} day${d === -1 ? "" : "s"}` : d === 0 ? "due today" : `in ${d} day${d === 1 ? "" : "s"}`;
  return `due ${c.due} (${rel})`;
}
// A ready-to-paste prompt for Claudia's chat. The commitment ID lets her find the ledger row.
function promptFor(c: Commitment): string {
  const p = LEDGER.people.find((x) => x.id === c.person_id);
  const org = p && p.org_id ? LEDGER.orgs.find((o) => o.id === p.org_id)?.name : undefined;
  const who = (p ? p.name : c.person_id) + (org ? ` (${org})` : "");
  const what = `\u201c${c.what}\u201d`;
  const d = c.direction;
  const line = d === "I owe" ? `I owe ${who} ${what}` : d === "owed to me" ? `${who} owes me ${what}` : d === "Claudia owes" ? `you owe ${who} ${what}` : d === "bot owes" ? `one of my bots owes ${who} ${what}` : `${d}: ${who}, ${what}`;
  const src = c.source_link && c.source_link !== "example" ? ` Source: ${c.source_link}.` : "";
  return `Claudia, let's follow up on ${c.id}: ${line}, ${dueText(c)}.${src} What should I do?`;
}
// Copy text inside the tap itself (iOS drops the permission after any await). First a selected
// textarea with execCommand, which iOS honors during a tap; then the async clipboard as a backup.
// Returns "ok" when the browser confirmed a copy, otherwise a promise for the backup's result.
function copyNow(text: string): "ok" | Promise<boolean> {
  let ok = false;
  try {
    const active = document.activeElement as HTMLElement | null;
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.contentEditable = "true";
    ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px;pointer-events:none;";
    document.body.appendChild(ta);
    const range = document.createRange(); range.selectNodeContents(ta);
    const sel = window.getSelection(); if (sel) { sel.removeAllRanges(); sel.addRange(range); }
    ta.focus({ preventScroll: true }); ta.select(); ta.setSelectionRange(0, text.length);
    ok = document.execCommand("copy");
    if (sel) sel.removeAllRanges();
    document.body.removeChild(ta);
    if (active && active.focus) active.focus({ preventScroll: true });
  } catch { ok = false; }
  if (ok) return "ok";
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, () => false);
  } catch { /* fall through */ }
  return Promise.resolve(false);
}
// Open promises, overdue first, then by due date.
const byUrgency = (a: Commitment, b: Commitment): number => (isLate(a) !== isLate(b) ? (isLate(a) ? -1 : 1) : a.due < b.due ? -1 : a.due > b.due ? 1 : 0);
const OPEN = LEDGER.commitments.filter((c) => c.status === "open").sort(byUrgency);
const PROMISE_GROUPS: Array<[string, (c: Commitment) => boolean]> = [
  ["You owe", (c) => c.direction === "I owe"],
  ["Owed to you", (c) => c.direction === "owed to me"],
  ["Claudia and your bots owe", (c) => c.direction !== "I owe" && c.direction !== "owed to me"],
];

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function mix(hex: string, to: string, t: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return "#" + ((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1);
}
function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ease = (p: number): number => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const kindOf = (id: string): Kind => (id === OWNER_ID ? "owner" : id.startsWith("P-") ? "person" : id.startsWith("O-") ? "org" : "project");

// Every edge on the graph: Links rows, plus a derived owner link to each person (typed by their
// relationship) and one owner-to-person edge per commitment, pointing toward whoever is owed.
function buildEdges(): GEdge[] {
  const known = new Set(LEDGER.people.map((p) => p.id));
  const out: GEdge[] = LEDGER.links.map((l) => ({ from_id: l.from_id, to_id: l.to_id, type: l.type, basis: l.basis, kind: l.from_id === OWNER_ID || l.to_id === OWNER_ID ? "owner" : "link" }));
  const tied = new Set(out.filter((e) => e.kind === "owner").map((e) => (e.from_id === OWNER_ID ? e.to_id : e.from_id)));
  LEDGER.people.forEach((p) => { if (!tied.has(p.id)) out.push({ from_id: OWNER_ID, to_id: p.id, type: p.relationship || "knows", basis: "stated", kind: "owner" }); });
  LEDGER.commitments.forEach((c) => {
    if (!known.has(c.person_id)) return;
    const toThem = c.direction === "I owe";
    out.push({ from_id: toThem ? OWNER_ID : c.person_id, to_id: toThem ? c.person_id : OWNER_ID, type: commitLabel(c), basis: "stated", kind: "commit", commit: c });
  });
  return out;
}
const EDGES = buildEdges();

// Organic radial layout: the owner is pinned at the center, people settle on soft rings by health
// (active closest), and orgs and projects float where their links pull them.
function layout(n: number, springs: Array<[number, number]>, ring: Array<number | null>, pin: number): Array<[number, number]> {
  const cx = W / 2;
  const cy = H / 2;
  const rnd = rand(11);
  const R0 = Math.max(260, ...ring.map((r) => r || 0));
  const pos: Array<[number, number]> = Array.from({ length: n }, (_, i) => {
    if (i === pin) return [cx, cy];
    const a = rnd() * Math.PI * 2;
    const r = ring[i] ?? R0 * (0.5 + rnd() * 0.7);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  const iters = n > 300 ? 90 : n > 120 ? 160 : 260;
  const ideal = Math.max(40, Math.min(90, 900 / Math.sqrt(n + 1)));
  for (let it = 0; it < iters; it++) {
    const t = 1 - it / iters;
    const disp: Array<[number, number]> = pos.map(() => [0, 0]);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i][0] - pos[j][0];
        let dy = pos[i][1] - pos[j][1];
        let d2 = dx * dx + dy * dy;
        if (d2 > 90000) continue;
        if (d2 < 1) { dx = 1; dy = 1; d2 = 2; }
        const f = (ideal * ideal) / d2;
        disp[i][0] += dx * f; disp[i][1] += dy * f;
        disp[j][0] -= dx * f; disp[j][1] -= dy * f;
      }
    }
    for (const [a, b] of springs) {
      const dx = pos[a][0] - pos[b][0];
      const dy = pos[a][1] - pos[b][1];
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - ideal) / d * 0.5;
      disp[a][0] -= dx * f; disp[a][1] -= dy * f;
      disp[b][0] += dx * f; disp[b][1] += dy * f;
    }
    for (let i = 0; i < n; i++) {
      if (i === pin) continue;
      const dx = pos[i][0] - cx;
      const dy = pos[i][1] - cy;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const target = ring[i];
      if (target !== null) { const f = ((target - d) / d) * 0.6; disp[i][0] += dx * f; disp[i][1] += dy * f; }
      else { disp[i][0] -= dx * 0.01; disp[i][1] -= dy * 0.01; if (d < R0 * 0.3) { const f = ((R0 * 0.3 - d) / d) * 0.3; disp[i][0] += dx * f; disp[i][1] += dy * f; } }
      const m = Math.sqrt(disp[i][0] ** 2 + disp[i][1] ** 2) || 1;
      const step = Math.min(m, 30 * t + 1);
      pos[i][0] += (disp[i][0] / m) * step;
      pos[i][1] += (disp[i][1] / m) * step;
    }
  }
  pos[pin] = [cx, cy];
  return pos;
}

function daysLabel(d: number): string {
  return d === 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`;
}
function nameOf(x: string): string {
  if (x === OWNER_ID) return OWNER_NAME;
  return LEDGER.people.find((p) => p.id === x)?.name || LEDGER.orgs.find((o) => o.id === x)?.name || LEDGER.projects.find((p) => p.id === x)?.name || x;
}

function shapePath(ctx: CanvasRenderingContext2D, kind: Kind, x: number, y: number, r: number) {
  ctx.beginPath();
  if (kind === "person" || kind === "owner") {
    ctx.arc(x, y, r, 0, Math.PI * 2);
  } else if (kind === "org") {
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      const px = x + Math.cos(a) * r * 1.12;
      const py = y + Math.sin(a) * r * 1.12;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else {
    const d = r * 1.3;
    ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d, y); ctx.closePath();
  }
}

export default function PeopleGraph() {
  const theme = useGrokTheme();

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [network, setNetwork] = useState("all");
  const [health, setHealth] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [sheetTall, setSheetTall] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [labels, setLabels] = useState<Labels>(LABEL_DEFAULTS);
  const [labelMenu, setLabelMenu] = useState(false);
  const [ask, setAsk] = useState<Commitment | null>(null); // the promise in the confirm popup
  const [askWhere, setAskWhere] = useState<"stage" | "list">("stage"); // over the graph, or inline under a list row
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");
  const [toast, setToast] = useState<{ text: string; where: "stage" | "list"; id: string } | null>(null);
  const [promiseMode, setPromiseMode] = useState(false); // "All open promises": only those nodes and edges

  const base = useMemo(() => {
    const weight: Record<string, number> = {};
    const bump = (id: string) => { weight[id] = (weight[id] || 0) + 1; };
    LEDGER.interactions.forEach((i) => bump(i.person_id));
    LEDGER.commitments.forEach((c) => bump(c.person_id));
    LEDGER.links.forEach((l) => { if (!l.from_id.startsWith("P-")) bump(l.from_id); if (!l.to_id.startsWith("P-")) bump(l.to_id); });
    const raw: Array<Omit<GNode, "x" | "y" | "r" | "ph">> = [
      { id: OWNER_ID, label: OWNER_NAME, kind: "owner" as Kind, health: null, network: null, weight: 0 },
      ...LEDGER.people.map((p) => ({ id: p.id, label: p.name, kind: "person" as Kind, health: p.health, network: p.network, weight: weight[p.id] || 0 })),
      ...LEDGER.orgs.map((o) => ({ id: o.id, label: o.name, kind: "org" as Kind, health: null, network: null, weight: weight[o.id] || 0 })),
      ...LEDGER.projects.map((p) => ({ id: p.id, label: p.name, kind: "project" as Kind, health: null, network: null, weight: weight[p.id] || 0 })),
    ];
    const index: Record<string, number> = {};
    raw.forEach((n, i) => { index[n.id] = i; });
    const edges = EDGES.filter((l) => index[l.from_id] !== undefined && index[l.to_id] !== undefined);
    const pairs = edges.map((l) => [index[l.from_id], index[l.to_id]] as [number, number]);
    const springs = pairs.filter((_, e) => edges[e].kind === "link");
    const rnd = rand(7);
    const ideal = Math.max(40, Math.min(90, 900 / Math.sqrt(raw.length + 1)));
    const R = Math.max(260, ideal * Math.sqrt(raw.length) * 0.55);
    const ringF: Record<string, number> = { active: 0.45, cooling: 0.72, inactive: 1 };
    const ring = raw.map((n) => (n.kind === "person" ? R * (ringF[n.health || "inactive"] || 1) * (0.9 + rnd() * 0.2) : null));
    const pos = layout(raw.length, springs, ring, 0);
    const lite = raw.length > LITE_ABOVE;
    const rs = lite ? 0.65 : 1;
    const nodes: GNode[] = raw.map((n, i) => ({ ...n, x: pos[i][0], y: pos[i][1], r: n.kind === "owner" ? (lite ? 16 : 20) : (7 + 2.5 * Math.sqrt(n.weight)) * rs, ph: rnd() * Math.PI * 2 }));
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const pad = 70;
    const box = { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, y0: Math.min(...ys) - pad, y1: Math.max(...ys) + pad };
    const open = new Set(LEDGER.commitments.filter((c) => c.status === "open").map((c) => c.person_id));
    const late = new Set(LEDGER.commitments.filter(isLate).map((c) => c.person_id));
    const perPerson: Record<string, number> = {};
    const commitEdge: Record<string, number> = {};
    const bend = edges.map((l, e) => {
      if (l.kind === "owner") return (rnd() < 0.5 ? -1 : 1) * (0.03 + rnd() * 0.04);
      if (l.kind === "commit" && l.commit) {
        commitEdge[l.commit.id] = e;
        const k = perPerson[l.commit.person_id] = (perPerson[l.commit.person_id] ?? -1) + 1;
        return (k % 2 ? -1 : 1) * (0.14 + 0.08 * Math.floor(k / 2));
      }
      return (rnd() < 0.5 ? -1 : 1) * (0.1 + rnd() * 0.12);
    });
    const rings = LEDGER.people.length ? [0.45, 0.72, 1].map((f) => f * R) : [];
    const stars = Array.from({ length: 170 }, () => ({ x: rnd(), y: rnd(), z: 0.3 + rnd() * 0.9, a: 0.15 + rnd() * 0.5, sp: 0.4 + rnd() * 1.2, ph: rnd() * 6.28 }));
    return { nodes, edges, pairs, index, box, open, late, bend, commitEdge, rings, stars, lite };
  }, []);

  const lite = base.lite;
  const q = query.trim().toLowerCase();
  const visibleIds = useMemo(() => {
    const s = new Set<string>();
    base.nodes.forEach((n) => {
      if (n.kind === "owner") { s.add(n.id); return; }
      if (kind !== "all" && n.kind !== kind) return;
      if (network !== "all" && n.network !== network) return;
      if (health !== "all" && n.health !== health) return;
      s.add(n.id);
    });
    return s;
  }, [base, kind, network, health]);
  // Search matches people, orgs, projects (name or ID) and commitment text. Matches always stay lit.
  // The "All open promises" set: you, each person with an open promise, and those promise edges.
  // (Ledger promises name a person only, so no org or project is attached to one.)
  const promiseSet = useMemo(() => {
    const nodes = new Set<string>([OWNER_ID]);
    const edges = new Set<number>();
    OPEN.forEach((c) => { const e = base.commitEdge[c.id]; if (e === undefined) return; nodes.add(c.person_id); edges.add(e); });
    return { nodes, edges };
  }, [base]);
  const only = promiseMode ? promiseSet : null;
  const match = useMemo<Match>(() => {
    const nodes = new Set<string>();
    const edges = new Set<number>();
    if (!q) return { active: false, nodes, edges, commits: [] };
    base.nodes.forEach((n) => { if ((n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) && (!only || only.nodes.has(n.id))) nodes.add(n.id); });
    const commits = LEDGER.commitments.filter((c) => (c.what.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) && base.commitEdge[c.id] !== undefined && (!only || only.edges.has(base.commitEdge[c.id])));
    commits.forEach((c) => { nodes.add(c.person_id); nodes.add(OWNER_ID); edges.add(base.commitEdge[c.id]); });
    return { active: true, nodes, edges, commits };
  }, [base, q, only]);

  // Everything the draw loop reads lives in refs, so panning and animation never re-render React.
  const rowRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const size = useRef({ w: 800, h: 560, dpr: 1 });
  const home = (): Cam => ({ x: (base.box.x0 + base.box.x1) / 2, y: (base.box.y0 + base.box.y1) / 2, k: 1 });
  const cam = useRef<Cam>(home());
  const tween = useRef<{ from: Cam; to: Cam; t0: number; dur: number } | null>(null);
  const preFocus = useRef<Cam | null>(null);
  const preSearch = useRef<Cam | null>(null);
  const selRef = useRef<string | null>(null);
  const nbrRef = useRef<Set<string>>(new Set());
  const visRef = useRef<Set<string>>(visibleIds);
  const matchRef = useRef<Match>(match);
  const moved = useRef<Record<string, [number, number]>>({});
  const dirty = useRef(true);
  const motion = useRef(false);
  const lastT = useRef(0);
  const narrowRef = useRef(false);
  const hoverRef = useRef<string | null>(null);
  const lastSel = useRef<string | null>(null);
  const labelsRef = useRef<Labels>(labels);
  const onlyRef = useRef<{ nodes: Set<string>; edges: Set<number> } | null>(only);
  const prePromise = useRef<{ cam: Cam; sel: string | null; preFocus: Cam | null } | null>(null);
  const pillRef = useRef<Array<{ box: [number, number, number, number]; c: Commitment }>>([]); // tappable promise pills, screen px

  visRef.current = visibleIds;
  matchRef.current = match;
  narrowRef.current = narrow;
  labelsRef.current = labels;
  onlyRef.current = only;
  motion.current = !reduced && !lite;
  if (selected) lastSel.current = selected;
  useEffect(() => { dirty.current = true; }, [visibleIds, match, selected, reduced, narrow, labels, only]);

  const fit = (): number => {
    const { w, h } = size.current;
    return Math.min(w / (base.box.x1 - base.box.x0), h / (base.box.y1 - base.box.y0));
  };
  const scale = (c: Cam): number => c.k * fit();
  const toWorld = (sx: number, sy: number): [number, number] => {
    const c = cam.current; const s = scale(c); const { w, h } = size.current;
    return [(sx - w / 2) / s + c.x, (sy - h / 2) / s + c.y];
  };
  const restPos = (i: number): [number, number] => {
    const n = base.nodes[i];
    const m = moved.current[n.id];
    return m ? [m[0], m[1]] : [n.x, n.y];
  };
  const nodePos = (i: number, t: number): [number, number] => {
    const n = base.nodes[i];
    let [x, y] = restPos(i);
    if (motion.current && n.kind !== "owner") { x += Math.sin(t * 0.00045 + n.ph) * 3.2; y += Math.cos(t * 0.00037 + n.ph * 1.3) * 3.2; }
    return [x, y];
  };
  const flyTo = (to: Cam) => {
    if (reduced) { cam.current = to; tween.current = null; dirty.current = true; return; }
    tween.current = { from: { ...cam.current }, to, t0: performance.now(), dur: 440 };
  };
  // Fit a set of nodes into the part of the stage that is not covered by the HUD or the bottom sheet.
  const fitIds = (ids: string[], maxK = 3) => {
    const idx = ids.map((id) => base.index[id]).filter((i) => i !== undefined);
    if (!idx.length) return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    idx.forEach((i) => { const [x, y] = restPos(i); const r = base.nodes[i].r * 1.4 + 8; x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r + 18); });
    const { w, h } = size.current;
    const sheet = narrowRef.current && selRef.current ? 0.52 : 0;
    const top = 52;
    const bottom = 26 + sheet * h;
    const side = 28;
    const aw = Math.max(40, w - 2 * side);
    const ah = Math.max(40, h - top - bottom);
    const k = Math.min(maxK, Math.max(0.35, Math.min(aw / Math.max(1, x1 - x0), ah / Math.max(1, y1 - y0)) / fit()));
    const s = k * fit();
    flyTo({ k, x: (x0 + x1) / 2, y: (y0 + y1) / 2 - (top + ah / 2 - h / 2) / s });
  };

  const focusOn = (id: string) => {
    const i = base.index[id];
    if (i === undefined) return;
    if (!selRef.current) preFocus.current = { ...cam.current };
    const nb = new Set<string>();
    const O = onlyRef.current;
    base.edges.forEach((l, e) => { if (O && !O.edges.has(e)) return; if (l.from_id === id) nb.add(l.to_id); if (l.to_id === id) nb.add(l.from_id); });
    selRef.current = id;
    nbrRef.current = nb;
    setSelected(id);
    // Tapped from a list below the graph (nudges, search chips): bring the graph back into view.
    const st = stageRef.current;
    if (st && typeof window !== "undefined") { const r = st.getBoundingClientRect(); if (r.top < 0 || r.bottom > window.innerHeight + 4) st.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: narrowRef.current ? "start" : "nearest" }); }
    if (matchRef.current.active && matchRef.current.nodes.size) { fitIds([...matchRef.current.nodes, id]); return; }
    if (id === OWNER_ID) { fitIds([id, ...nb], 1.6); return; }
    const k = Math.min(6, Math.max(1.8, cam.current.k));
    const s = k * fit();
    const { h } = size.current;
    const [nx, ny] = nodePos(i, lastT.current);
    const dy = narrowRef.current ? h * 0.25 : h / 2; // on phones, center above the bottom sheet
    flyTo({ k, x: nx, y: ny - (dy - h / 2) / s });
  };
  const unfocus = () => {
    if (!selRef.current) return;
    selRef.current = null;
    nbrRef.current = new Set();
    setSelected(null);
    setSheetTall(false);
    if (matchRef.current.active && matchRef.current.nodes.size) fitIds([...matchRef.current.nodes]);
    else if (onlyRef.current) fitIds([...onlyRef.current.nodes]);
    else flyTo(preFocus.current || home());
    preFocus.current = null;
  };
  // "All open promises" on: remember the view, hide everything else, fit the promise set.
  // Off: bring the full graph and the previous view back.
  const setPromises = (on: boolean) => {
    if (on === promiseMode) return;
    setAsk(null); setLabelMenu(false);
    if (on) {
      prePromise.current = { cam: selRef.current ? preFocus.current || home() : { ...cam.current }, sel: selRef.current, preFocus: preFocus.current };
      selRef.current = null; nbrRef.current = new Set(); setSelected(null); setSheetTall(false); preFocus.current = null;
      onlyRef.current = promiseSet; setPromiseMode(true);
      const ids = matchRef.current.active && matchRef.current.nodes.size ? [...matchRef.current.nodes].filter((id) => promiseSet.nodes.has(id)) : [...promiseSet.nodes];
      fitIds(ids.length ? ids : [...promiseSet.nodes]);
    } else {
      const back = prePromise.current; prePromise.current = null;
      onlyRef.current = null; setPromiseMode(false);
      selRef.current = null; nbrRef.current = new Set(); setSelected(null);
      if (back && back.sel) { preFocus.current = back.cam; focusOn(back.sel); } else flyTo(back ? back.cam : home());
    }
  };
  // Typing a search fits every match on screen; clearing it flies back.
  useEffect(() => {
    if (match.active) {
      if (!preSearch.current) preSearch.current = selRef.current ? preFocus.current || home() : { ...cam.current };
      setSheetTall(false);
      const ids = [...match.nodes];
      if (selRef.current) ids.push(selRef.current);
      if (ids.length) fitIds(ids);
    } else if (preSearch.current) {
      const back = preSearch.current;
      preSearch.current = null;
      if (selRef.current) { preFocus.current = back; focusOn(selRef.current); } else flyTo(back);
    }
  }, [q]);

  const zoomAt = (sx: number, sy: number, f: number) => {
    tween.current = null;
    const [wx, wy] = toWorld(sx, sy);
    const c = cam.current;
    const k = Math.min(8, Math.max(0.35, c.k * f));
    const s = k * fit(); const { w, h } = size.current;
    cam.current = { k, x: wx - (sx - w / 2) / s, y: wy - (sy - h / 2) / s };
    dirty.current = true;
  };
  const hit = (sx: number, sy: number, tight = false): string | null => {
    const [wx, wy] = toWorld(sx, sy);
    const s = scale(cam.current);
    let best: string | null = null;
    let bestD = Infinity;
    for (let i = 0; i < base.nodes.length; i++) {
      const n = base.nodes[i];
      if (onlyRef.current && !onlyRef.current.nodes.has(n.id)) continue;
      if (!visRef.current.has(n.id) && n.id !== selRef.current && !matchRef.current.nodes.has(n.id)) continue;
      const [x, y] = nodePos(i, lastT.current);
      const d = Math.hypot(wx - x, wy - y);
      if (d < (tight ? n.r : n.r * 1.35 + 8 / s) && d < bestD) { best = n.id; bestD = d; }
    }
    return best;
  };

  // Promise label pills are tap targets (padded), checked before anything else.
  const hitPill = (sx: number, sy: number, pad: number): Commitment | null => {
    for (let i = pillRef.current.length - 1; i >= 0; i--) {
      const { box, c } = pillRef.current[i];
      if (sx >= box[0] - pad && sx <= box[2] + pad && sy >= box[1] - pad && sy <= box[3] + pad) return c;
    }
    return null;
  };
  // Promise edges get a wide invisible hit band (12 px with a mouse, 18 px on touch); nodes still win.
  const hitCommit = (sx: number, sy: number, band = 12): Commitment | null => {
    const c = cam.current; const s = scale(c); const { w, h } = size.current;
    const sel = selRef.current; const M = matchRef.current; const dimAll = sel !== null || M.active;
    let best: Commitment | null = null; let bestD = band;
    base.edges.forEach((l, e) => {
      const cm = l.commit;
      if (!cm) return;
      if (onlyRef.current && !onlyRef.current.edges.has(e)) return;
      const hot = sel !== null && (l.from_id === sel || l.to_id === sel);
      const shownP = visRef.current.has(cm.person_id) || M.nodes.has(cm.person_id);
      if (!(hot || M.edges.has(e) || (!dimAll && shownP))) return;
      const [a, b] = base.pairs[e];
      const [ax, ay] = nodePos(a, lastT.current); const [bx, by] = nodePos(b, lastT.current);
      const k = base.bend[e];
      const cx = (ax + bx) / 2 - (by - ay) * k; const cy = (ay + by) / 2 + (bx - ax) * k;
      for (let i = 2; i <= 22; i++) {
        const t = i / 24;
        const x = (1 - t) * (1 - t) * ax + 2 * t * (1 - t) * cx + t * t * bx;
        const y = (1 - t) * (1 - t) * ay + 2 * t * (1 - t) * cy + t * t * by;
        const d = Math.hypot((x - c.x) * s + w / 2 - sx, (y - c.y) * s + h / 2 - sy);
        if (d < bestD) { bestD = d; best = cm; }
      }
    });
    return best;
  };
  const askAbout = (c: Commitment, where: "stage" | "list" = "stage") => { setLabelMenu(false); setCopyState("idle"); setAskWhere(where); setAsk(c); };
  // Runs synchronously inside the tap. "Copied" only when the browser confirms it.
  const doCopy = (close: boolean) => {
    if (!ask) return;
    const c = ask; const where = askWhere;
    const done = (ok: boolean) => {
      if (ok && close) { setAsk(null); setCopyState("idle"); setToast({ text: "Copied. Paste it into Claudia's chat.", where, id: c.id }); }
      else setCopyState(ok ? "ok" : "fail");
    };
    const r = copyNow(promptFor(c));
    if (r === "ok") done(true); else r.then(done);
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // Reduced-motion preference.
  useEffect(() => {
    const mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  // Size the canvas to its box, and switch to the phone layout on narrow rows.
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const row = rowRef.current; const st = stageRef.current; const cv = canvasRef.current;
      if (row) setNarrow(row.getBoundingClientRect().width < 760);
      if (st && cv) {
        const r = st.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        size.current = { w: Math.max(1, r.width), h: Math.max(1, r.height), dpr };
        cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
        dirty.current = true;
      }
    });
    if (rowRef.current) ro.observe(rowRef.current);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  // Wheel zoom and Escape to go back.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 0.89);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key !== "Escape") return; if (ask) setAsk(null); else unfocus(); };
    cv.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => { cv.removeEventListener("wheel", onWheel); window.removeEventListener("keydown", onKey); };
  });

  // The render loop. Draws every frame only while something moves; otherwise only when dirty.
  useEffect(() => {
    let raf = 0;
    const setFont = (ctx: CanvasRenderingContext2D, px: number, wt: number) => {
      ctx.font = `${wt} ${px}px ${theme.font.family}`;
      if (!ctx.font.includes(`${px}px`)) ctx.font = `${wt} ${px}px system-ui, sans-serif`;
    };
    const draw = (t: number) => {
      const cv = canvasRef.current;
      const ctx = cv ? cv.getContext("2d") : null;
      if (!cv || !ctx) return;
      const { w, h, dpr } = size.current;
      const c = cam.current;
      const s = scale(c);
      const anim = motion.current;
      const glow = !lite;
      const sel = selRef.current;
      const nb = nbrRef.current;
      const vis = visRef.current;
      const M = matchRef.current;
      const O = onlyRef.current; // promise mode: everything outside this set is not drawn at all
      const dimAll = sel !== null || M.active;
      const lit = (id: string) => id === sel || (sel !== null && nb.has(id)) || M.nodes.has(id);
      const shown = (id: string) => vis.has(id) || M.nodes.has(id);

      // Deep background, starfield, grid.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
      bg.addColorStop(0, STAGE.bg1); bg.addColorStop(1, STAGE.bg0);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      const hm = home();
      for (const st of base.stars) {
        const ox = ((st.x * w - (c.x - hm.x) * s * 0.04 * st.z) % w + w) % w;
        const oy = ((st.y * h - (c.y - hm.y) * s * 0.04 * st.z) % h + h) % h;
        const a = anim ? st.a * (0.6 + 0.4 * Math.sin(t * 0.001 * st.sp + st.ph)) : st.a;
        ctx.fillStyle = `rgba(${STAGE.star},${a})`;
        ctx.fillRect(ox, oy, st.z * 1.3, st.z * 1.3);
      }
      let g = 40;
      while (g * s < 16) g *= 2;
      const [x0, y0] = toWorld(0, 0);
      const [x1, y1] = toWorld(w, h);
      ctx.lineWidth = 1;
      for (const major of [false, true]) {
        const step = major ? g * 5 : g;
        ctx.beginPath();
        for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) { const sx = Math.round((x - c.x) * s + w / 2) + 0.5; ctx.moveTo(sx, 0); ctx.lineTo(sx, h); }
        for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) { const sy = Math.round((y - c.y) * s + h / 2) + 0.5; ctx.moveTo(0, sy); ctx.lineTo(w, sy); }
        ctx.strokeStyle = `rgba(${STAGE.grid},${major ? 0.075 : 0.035})`;
        ctx.stroke();
      }

      // World transform for rings, edges and nodes.
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (w / 2 - c.x * s), dpr * (h / 2 - c.y * s));
      const P = base.nodes.map((_, i) => nodePos(i, t));
      const px = 1 / s;
      const [hx, hy] = P[0];
      base.rings.forEach((rr) => {
        ctx.beginPath(); ctx.arc(hx, hy, rr, 0, Math.PI * 2);
        ctx.setLineDash([2 * px, 7 * px]);
        ctx.strokeStyle = `rgba(${STAGE.grid},${dimAll ? 0.06 : 0.14})`; ctx.lineWidth = px; ctx.stroke();
      });
      ctx.setLineDash([]);
      const curve = (e: number): [number, number, number, number, number, number] => {
        const [a, b] = base.pairs[e];
        const [ax, ay] = P[a]; const [bx, by] = P[b];
        const k = base.bend[e];
        const cx = (ax + bx) / 2 - (by - ay) * k; const cy = (ay + by) / 2 + (bx - ax) * k;
        ctx.moveTo(ax, ay); ctx.quadraticCurveTo(cx, cy, bx, by);
        return [cx, cy, ax, ay, bx, by];
      };
      const buckets: Record<string, number[]> = { hidden: [], dim: [], solid: [], inferred: [], owner: [], hot: [], hotInferred: [] };
      const commits: number[] = [];
      base.edges.forEach((l, e) => {
        if (O && !O.edges.has(e)) return;
        if (l.kind === "commit") { commits.push(e); return; }
        const on = shown(l.from_id) && shown(l.to_id);
        const hot = sel !== null && (l.from_id === sel || l.to_id === sel);
        const inf = l.basis === "inferred";
        if (hot) buckets[inf ? "hotInferred" : "hot"].push(e);
        else if (!on) buckets.hidden.push(e);
        else if (dimAll) buckets.dim.push(e);
        else if (l.kind === "owner") buckets.owner.push(e);
        else if (inf) buckets.inferred.push(e);
        else buckets.solid.push(e);
      });
      const stroke = (ids: number[], color: string, width: number, dash?: number[], offset?: number) => {
        if (!ids.length) return;
        ctx.beginPath();
        ids.forEach((e) => { curve(e); });
        ctx.setLineDash(dash ? dash.map((d) => d * px) : []);
        ctx.lineDashOffset = (offset || 0) * px;
        ctx.strokeStyle = color; ctx.lineWidth = width * px; ctx.stroke();
      };
      ctx.lineCap = "round";
      stroke(buckets.hidden, `rgba(${STAGE.edge},0.03)`, 1);
      stroke(buckets.dim, `rgba(${STAGE.edge},0.045)`, 1);
      stroke(buckets.owner, rgba(STAGE.owner, 0.09), 0.9);
      if (glow) stroke(buckets.solid, `rgba(${STAGE.edge},0.05)`, 6);
      stroke(buckets.solid, `rgba(${STAGE.edge},0.28)`, 1.1);
      stroke(buckets.inferred, `rgba(${STAGE.edge},0.32)`, 1.1, [5, 5]);
      if (buckets.hot.length || buckets.hotInferred.length) {
        const many = buckets.hot.length > 60;
        stroke([...buckets.hot, ...buckets.hotInferred], `rgba(${STAGE.edge},${many ? 0.08 : 0.16})`, many ? 4 : 9);
        stroke(buckets.hot, rgba(STAGE.flow, many ? 0.45 : 0.9), many ? 1 : 1.8);
        stroke(buckets.hotInferred, rgba(STAGE.flow, 0.85), 1.6, [5, 5]);
        if (anim && !many) stroke(buckets.hot, "rgba(255,255,255,0.95)", 2.2, [2, 14], -t * 0.045);
      }
      ctx.setLineDash([]);

      // Commitment edges: colored by direction, glowing and flowing toward whoever is owed while open.
      for (const e of commits) {
        const l = base.edges[e];
        const cm = l.commit;
        if (!cm) continue;
        const open = cm.status === "open";
        const col = isLate(cm) ? STAGE.overdue : commitColor(cm);
        const hot = sel !== null && (l.from_id === sel || l.to_id === sel);
        const m = M.edges.has(e);
        const bright = hot || m || (!dimAll && shown(cm.person_id));
        const a = bright ? (open ? 1 : 0.45) : 0.06;
        ctx.beginPath();
        const [cx, cy, ax, ay, bx, by] = curve(e);
        if (bright && open && (glow || hot || m)) { ctx.strokeStyle = rgba(col, 0.18); ctx.lineWidth = (hot || m ? 10 : 6) * px; ctx.stroke(); }
        ctx.setLineDash(open ? [] : [3 * px, 4 * px]);
        ctx.strokeStyle = rgba(col, (open ? 0.8 : 0.4) * a); ctx.lineWidth = (open ? 1.6 : 1) * px; ctx.stroke();
        if (bright && open && anim) {
          ctx.setLineDash([2 * px, 10 * px]); ctx.lineDashOffset = -t * 0.035 * px;
          ctx.strokeStyle = rgba(mix(col, "#ffffff", 0.4), 0.95); ctx.lineWidth = 2.1 * px; ctx.stroke();
        }
        ctx.setLineDash([]);
        if (open && a > 0.1) {
          const tt = 0.8;
          const mx = (1 - tt) * (1 - tt) * ax + 2 * tt * (1 - tt) * cx + tt * tt * bx;
          const my = (1 - tt) * (1 - tt) * ay + 2 * tt * (1 - tt) * cy + tt * tt * by;
          const tx = 2 * (1 - tt) * (cx - ax) + 2 * tt * (bx - cx);
          const ty = 2 * (1 - tt) * (cy - ay) + 2 * tt * (by - cy);
          const dl = Math.hypot(tx, ty) || 1;
          const ux = tx / dl; const uy = ty / dl;
          const z = (bright ? 6 : 4.5) * px;
          ctx.beginPath();
          ctx.moveTo(mx + ux * z, my + uy * z);
          ctx.lineTo(mx - ux * z - uy * z * 0.75, my - uy * z + ux * z * 0.75);
          ctx.lineTo(mx - ux * z + uy * z * 0.75, my - uy * z - ux * z * 0.75);
          ctx.closePath();
          ctx.fillStyle = rgba(mix(col, "#ffffff", 0.2), a); ctx.fill();
        }
      }

      // Nodes: dimmed first, then the rest, focus set and matches last.
      const order = base.nodes.map((_, i) => i);
      const tier = (i: number) => { const n = base.nodes[i]; return n.id === sel ? 4 : n.kind === "owner" ? 3 : dimAll && lit(n.id) ? 2 : (!shown(n.id) || dimAll) ? 0 : 1; };
      order.sort((a, b) => tier(a) - tier(b));
      for (const i of order) {
        const n = base.nodes[i];
        if (O && !O.nodes.has(n.id)) continue;
        const [x, y] = P[i];
        const isLit = lit(n.id);
        const a = dimAll ? (isLit ? 1 : n.kind === "owner" ? 0.55 : shown(n.id) ? 0.15 : 0.05) : shown(n.id) ? 1 : 0.07;
        const breathe = anim ? 1 + 0.045 * Math.sin(t * 0.0021 + n.ph) : 1;
        const r = n.r * breathe * (n.id === sel ? 1.15 : 1);
        const col = KIND_COLOR[n.kind];
        const halo = n.kind === "person" && n.health ? HEALTH_COLOR[n.health] : col;
        if ((glow || isLit || n.kind === "owner") && a > 0.2) {
          const big = n.kind === "owner" ? 4.6 : n.kind === "person" ? 3.3 : 2.6;
          const hg = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * big);
          hg.addColorStop(0, rgba(halo, (n.kind === "owner" ? 0.55 : n.kind === "person" ? 0.6 : 0.34) * a));
          hg.addColorStop(1, rgba(halo, 0));
          ctx.fillStyle = hg;
          ctx.beginPath(); ctx.arc(x, y, r * big, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = a;
        shapePath(ctx, n.kind, x, y, r);
        if (glow || isLit || n.kind === "owner") {
          const fg = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.35);
          fg.addColorStop(0, n.kind === "owner" ? STAGE.ownerCore : mix(col, "#ffffff", 0.6)); fg.addColorStop(0.55, col); fg.addColorStop(1, mix(col, "#000000", 0.5));
          ctx.fillStyle = fg;
        } else ctx.fillStyle = col;
        ctx.fill();
        ctx.lineJoin = "round";
        ctx.strokeStyle = rgba(mix(col, "#ffffff", 0.45), 0.85); ctx.lineWidth = (n.kind === "owner" ? 1.6 : 1) * px; ctx.stroke();
        if (n.kind === "owner") {
          ctx.beginPath(); ctx.arc(x, y, r * 1.55, 0, Math.PI * 2);
          ctx.setLineDash([3 * px, 5 * px]); ctx.lineDashOffset = anim ? t * 0.012 * px : 0;
          ctx.strokeStyle = rgba(STAGE.owner, 0.75); ctx.lineWidth = 1.3 * px; ctx.stroke();
          ctx.setLineDash([]);
          if (anim) {
            const p = (t % 2600) / 2600;
            ctx.beginPath(); ctx.arc(x, y, r * (1.25 + 1.4 * p), 0, Math.PI * 2);
            ctx.strokeStyle = rgba(STAGE.owner, 0.5 * (1 - p)); ctx.lineWidth = 1.2 * px; ctx.stroke();
          }
        }
        if (n.kind === "person" && n.health) {
          ctx.beginPath(); ctx.arc(x, y, r + 3 * px, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(halo, 0.85); ctx.lineWidth = 1.6 * px; ctx.stroke();
        }
        if (base.late.has(n.id) && a > 0.5) {
          ctx.beginPath(); ctx.arc(x + r * 0.78, y - r * 0.78, 3.2 * px, 0, Math.PI * 2);
          ctx.fillStyle = STAGE.overdue; ctx.fill();
        }
        if (M.nodes.has(n.id) && n.id !== sel) {
          ctx.beginPath(); ctx.arc(x, y, r * 1.35 + 5 * px, 0, Math.PI * 2);
          ctx.setLineDash([4 * px, 3 * px]); ctx.lineDashOffset = anim ? -t * 0.02 * px : 0;
          ctx.strokeStyle = rgba(STAGE.flow, 0.95); ctx.lineWidth = 1.5 * px; ctx.stroke();
          ctx.setLineDash([]);
        }
        if (n.id === sel) {
          ctx.beginPath(); ctx.arc(x, y, r * (n.kind === "owner" ? 1.75 : 1.3) + 6 * px, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.4 * px; ctx.stroke();
          if (anim && n.kind !== "owner") {
            const p = (t % 1800) / 1800;
            ctx.beginPath(); ctx.arc(x, y, r * 1.3 + (6 + 22 * p) * px, 0, Math.PI * 2);
            ctx.strokeStyle = rgba(halo, 0.6 * (1 - p)); ctx.lineWidth = 1.2 * px; ctx.stroke();
          }
        }
        if (hoverRef.current === n.id && n.id !== sel) {
          ctx.beginPath(); ctx.arc(x, y, r * 1.3 + 4 * px, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1 * px; ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Labels in screen space so they stay crisp.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const toS = (x: number, y: number): [number, number] => [(x - c.x) * s + w / 2, (y - c.y) * s + h / 2];
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
      if (!dimAll && base.rings.length) {
        setFont(ctx, 9.5, 500);
        ["active", "cooling", "inactive"].forEach((nm, i) => {
          const [sx, sy] = toS(hx, hy - base.rings[i]);
          if (sy < 14 || sy > h - 10) return;
          ctx.fillStyle = `rgba(${STAGE.grid},0.5)`; ctx.fillText(nm.toUpperCase(), sx, sy - 7);
        });
      }
      // Edge labels. Focus and search always label their own edges; elsewhere the Labels toggles decide.
      const LT = labelsRef.current;
      const many = O ? O.nodes.size : base.nodes.length;
      const showAll = many <= w / 12 || (many <= 140 && c.k >= 1.5) || c.k >= 2.6;
      const thin = many > 120 && !showAll; // same thinning rule as node names
      const wantEdge = (e: number) => (base.edges[e].kind === "commit" ? LT.promises : LT.links);
      const pills: number[] = [];
      const addPill = (e: number) => { if (!pills.includes(e) && (!O || O.edges.has(e))) pills.push(e); };
      const tapPills: Array<{ box: [number, number, number, number]; c: Commitment }> = [];
      M.edges.forEach(addPill);
      if (sel) {
        const hotE = base.edges.map((_, e) => e).filter((e) => base.edges[e].from_id === sel || base.edges[e].to_id === sel);
        // Hub focus: the panel lists every promise, so pills there follow the toggles (no pile-up by default).
        if (sel === OWNER_ID) hotE.filter(wantEdge).forEach(addPill);
        else hotE.filter((e) => base.edges[e].kind === "commit" || hotE.length <= 40).forEach(addPill);
      } else if (!thin && (LT.links || LT.promises)) {
        base.edges.forEach((l, e) => {
          if (!wantEdge(e)) return;
          if (M.active ? !(M.nodes.has(l.from_id) && M.nodes.has(l.to_id)) : !(vis.has(l.from_id) && vis.has(l.to_id))) return;
          addPill(e);
        });
      }
      if (pills.length) {
        setFont(ctx, 10, 500);
        const placed: Array<[number, number, number, number]> = [];
        let drawn = 0;
        for (const e of pills) {
          if (drawn >= 60) break;
          const [a, b] = base.pairs[e];
          const [ax, ay] = P[a]; const [bx, by] = P[b];
          const k = base.bend[e];
          const cx = (ax + bx) / 2 - (by - ay) * k; const cy = (ay + by) / 2 + (bx - ax) * k;
          const l = base.edges[e];
          const [mx, my] = toS(0.25 * ax + 0.5 * cx + 0.25 * bx, 0.25 * ay + 0.5 * cy + 0.25 * by);
          if (mx < -60 || mx > w + 60 || my < -20 || my > h + 20) continue;
          const txt = l.commit ? `${l.type}: ${trunc(l.commit.what, 26)}` : l.type.replace(/_/g, " ") + (l.basis === "inferred" ? " (inferred)" : "");
          const tw = ctx.measureText(txt).width + 10;
          const box: [number, number, number, number] = [mx - tw / 2, my - 8, mx + tw / 2, my + 8];
          const must = M.edges.has(e);
          if (!must && placed.some((q2) => box[0] < q2[2] && box[2] > q2[0] && box[1] < q2[3] && box[3] > q2[1])) continue;
          placed.push(box); drawn++;
          if (l.commit) tapPills.push({ box, c: l.commit });
          const tone = l.commit ? (isLate(l.commit) ? STAGE.overdue : commitColor(l.commit)) : STAGE.flow;
          ctx.fillStyle = "rgba(4,10,22,0.86)"; ctx.fillRect(mx - tw / 2, my - 8, tw, 16);
          ctx.strokeStyle = rgba(tone, 0.5); ctx.lineWidth = 1; ctx.strokeRect(mx - tw / 2 + 0.5, my - 7.5, tw - 1, 15);
          ctx.fillStyle = l.commit ? rgba(mix(tone, "#ffffff", 0.35), 1) : STAGE.edgeLabel; ctx.fillText(txt, mx, my + 0.5);
        }
      }
      pillRef.current = tapPills;
      const kindOn = (k: Kind) => (k === "person" ? LT.people : k === "org" ? LT.orgs : k === "project" ? LT.projects : true);
      const bigFocus = sel !== null && nb.size > 60;
      base.nodes.forEach((n, i) => {
        if (O && !O.nodes.has(n.id)) return;
        const m = M.nodes.has(n.id);
        let show = false;
        let strong = false;
        if (n.kind === "owner") { show = true; strong = true; }
        else if (m) { show = true; strong = true; }
        else if (sel) { show = n.id === sel || (nb.has(n.id) && (!bigFocus || base.open.has(n.id))); strong = n.id === sel; }
        else if (M.active) show = false;
        else show = (vis.has(n.id) && kindOn(n.kind) && (showAll || (n.kind !== "person" && many <= LITE_ABOVE))) || (vis.has(n.id) && hoverRef.current === n.id);
        if (!show) return;
        const [sx, sy] = toS(P[i][0], P[i][1]);
        if (!m && (sx < -80 || sx > w + 80 || sy < -40 || sy > h + 40)) return;
        const px2 = n.kind === "owner" ? 13.5 : strong ? 12.5 : n.kind === "person" ? 11 : 11.5;
        setFont(ctx, px2, strong || n.kind !== "person" ? 600 : 500);
        const ly = sy + n.r * s * (n.kind === "project" ? 1.3 : n.kind === "owner" ? 1.6 : 1.15) + (strong ? 15 : 12);
        ctx.globalAlpha = n.kind === "owner" && dimAll && !lit(n.id) ? 0.6 : 1;
        ctx.strokeStyle = "rgba(2,5,11,0.88)"; ctx.lineWidth = 3.5; ctx.strokeText(n.label, sx, ly);
        ctx.fillStyle = n.kind === "owner" ? STAGE.owner : m ? STAGE.flow : strong || sel ? STAGE.label : n.kind === "person" ? STAGE.labelSoft : STAGE.label;
        ctx.fillText(n.label, sx, ly);
        ctx.globalAlpha = 1;
      });

      // Soft vignette.
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    };
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      lastT.current = t;
      const tw = tween.current;
      if (tw) {
        const p = Math.min(1, Math.max(0, (t - tw.t0) / tw.dur));
        const e = ease(p);
        cam.current = {
          x: tw.from.x + (tw.to.x - tw.from.x) * e,
          y: tw.from.y + (tw.to.y - tw.from.y) * e,
          k: tw.from.k * Math.pow(tw.to.k / tw.from.k, e),
        };
        if (p >= 1) tween.current = null;
        dirty.current = true;
      }
      if (motion.current || dirty.current) { dirty.current = false; draw(t); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [base, lite, theme]);

  // Pointer input: tap a node to focus, tap a promise (its pill or line) to ask about it, tap the
  // background to go back, drag to pan or move a node, pinch to zoom. A tap is under 10 px of travel
  // (and under 500 ms on touch), measured as straight distance from where the finger landed.
  const pointers = useRef<Map<number, [number, number]>>(new Map());
  const drag = useRef<{ mode: "pan" | "node" | "pinch" | "commit"; id?: string; commit?: Commitment; start: [number, number]; t0: number; touch: boolean; last: [number, number]; dist?: number; far: boolean } | null>(null);
  const local = (e: PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (labelMenu) setLabelMenu(false);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = local(e);
    const touch = e.pointerType !== "mouse";
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      drag.current = { mode: "pinch", start: p, t0: 0, touch, last: [0, 0], dist: Math.hypot(a[0] - b[0], a[1] - b[1]), far: true };
      return;
    }
    const now = performance.now();
    // Order: a node right under the finger, a promise pill, a node's wider ring, a promise line's band.
    const direct = hit(p[0], p[1], true);
    const pill = direct ? null : hitPill(p[0], p[1], touch ? 8 : 3);
    const id = direct || (pill ? null : hit(p[0], p[1]));
    const line = direct || pill || id ? null : hitCommit(p[0], p[1], touch ? 18 : 12);
    const cm = pill || line;
    drag.current = { mode: id ? "node" : cm ? "commit" : "pan", id: id || undefined, commit: cm || undefined, start: p, t0: now, touch, last: p, far: false };
  };
  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const p = local(e);
    const d = drag.current;
    if (!d) {
      const id = hit(p[0], p[1]);
      if (id !== hoverRef.current) { hoverRef.current = id; dirty.current = true; }
      e.currentTarget.style.cursor = id || hitPill(p[0], p[1], 3) || hitCommit(p[0], p[1]) ? "pointer" : "grab";
      return;
    }
    pointers.current.set(e.pointerId, p);
    if (d.mode === "pinch") {
      if (pointers.current.size !== 2) return;
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, dist / (d.dist || dist));
      d.dist = dist;
      return;
    }
    const dx = p[0] - d.last[0];
    const dy = p[1] - d.last[1];
    d.last = p;
    if (!d.far && Math.hypot(p[0] - d.start[0], p[1] - d.start[1]) < 10) return; // still a tap
    d.far = true;
    if (d.mode === "commit") d.mode = "pan"; // dragging from a promise pans the map
    const s = scale(cam.current);
    if (d.mode === "pan" || d.id === OWNER_ID) {
      tween.current = null;
      cam.current = { ...cam.current, x: cam.current.x - dx / s, y: cam.current.y - dy / s };
    } else if (d.id) {
      const n = base.nodes[base.index[d.id]];
      const cur = moved.current[d.id] || [n.x, n.y];
      moved.current = { ...moved.current, [d.id]: [cur[0] + dx / s, cur[1] + dy / s] };
    }
    dirty.current = true;
  };
  const onUp = (e: PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (d && d.mode !== "pinch" && !d.far && (!d.touch || performance.now() - d.t0 < 500)) {
      if (d.mode === "node" && d.id) focusOn(d.id);
      else if (d.mode === "commit" && d.commit) askAbout(d.commit, "stage");
      else if (d.mode === "pan") unfocus();
    }
    if (pointers.current.size === 0) drag.current = null;
  };
  const onCancel = (e: PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) drag.current = null;
  };

  const resetView = () => {
    moved.current = {};
    selRef.current = null; nbrRef.current = new Set(); setSelected(null); setSheetTall(false);
    preFocus.current = null;
    preSearch.current = null;
    prePromise.current = null; onlyRef.current = null; setPromiseMode(false); setAsk(null);
    setQuery("");
    flyTo(home());
  };
  const zoomBy = (f: number) => { const { w, h } = size.current; zoomAt(w / 2, h / 2, f); };

  const countHealth = (hh: string) => String(LEDGER.people.filter((p) => p.health === hh).length);
  const openCount = LEDGER.commitments.filter((c) => c.status === "open").length;
  const overdue = LEDGER.commitments.filter(isLate).length;
  const nodeMatches = base.nodes.filter((n) => match.nodes.has(n.id) && (n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)));

  const hudBtn = {
    border: `1px solid ${theme.border.default}`, background: theme.bg.elevated, color: theme.text.primary,
    borderRadius: theme.radius.md, padding: "6px 11px", fontSize: theme.font.caption.fontSize, fontFamily: theme.font.family,
    cursor: "pointer", lineHeight: 1.2, backdropFilter: "blur(6px)",
  };
  const chip = (text: string, onClick: () => void, key: string | number) => (
    <button key={key} onClick={onClick} style={{ fontSize: theme.font.caption.fontSize, border: `1px solid ${theme.border.weak}`, background: theme.fill.secondary, color: theme.text.primary, borderRadius: theme.radius.full, padding: "3px 10px", cursor: "pointer", fontFamily: theme.font.family }}>{text}</button>
  );
  const panelId = selected || (narrow ? lastSel.current : null);
  const sheetOpen = narrow && selected !== null;

  const toolbar = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
      <div style={{ flex: "1 1 200px" }}><Input label="Search" value={query} onChange={setQuery} placeholder="Person, org, project or promise" /></div>
      <Select label="Type" value={kind} onChange={setKind} options={[{ value: "all", label: "All types" }, { value: "person", label: "People" }, { value: "org", label: "Orgs" }, { value: "project", label: "Projects" }]} />
      <Select label="Network" value={network} onChange={setNetwork} options={[{ value: "all", label: "Both networks" }, { value: "professional", label: "Professional" }, { value: "personal", label: "Personal" }]} />
      <Select label="Health" value={health} onChange={setHealth} options={[{ value: "all", label: "Any health" }, { value: "active", label: "Active" }, { value: "cooling", label: "Cooling" }, { value: "inactive", label: "Inactive" }]} />
      <Button label="Reset view" onClick={resetView} />
    </div>
  );
  const labelCount = LABEL_ROWS.filter(([k]) => labels[k]).length;

  // The Ask Claudia card: the prompt is always shown as selectable text, so a blocked clipboard
  // still leaves a way to copy it by hand. "Copied" appears only when the browser confirms it.
  const roundBtn = (bg: string) => ({ width: 44, height: 44, flex: "0 0 auto", borderRadius: theme.radius.full, border: "none", background: bg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" });
  const askCard = () => ask && (
    <div role="dialog" aria-label="Ask Claudia about this promise" style={{ width: "min(400px, 100%)", maxHeight: "100%", overflowY: "auto", boxSizing: "border-box", background: theme.bg.elevated, border: `1px solid ${theme.border.strong}`, borderRadius: theme.radius.lg, padding: 14, display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <CommitGlyph c={ask} />
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: theme.font.label.fontSize, color: theme.text.tertiary }}>{ask.id} {"\u00b7"} {commitLabel(ask)} {"\u00b7"} {nameOf(ask.person_id)}</span>
          <span style={{ fontSize: theme.font.subtext.fontSize, lineHeight: theme.font.subtext.lineHeight, fontWeight: theme.weight.semibold, color: theme.text.primary }}>{ask.what}</span>
          <span style={{ fontSize: theme.font.label.fontSize, color: isLate(ask) ? theme.text.danger : theme.text.secondary }}>{dueText(ask)}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: theme.font.label.fontSize, fontWeight: theme.weight.semibold, color: theme.text.secondary }}>Prompt for Claudia</span>
        <button aria-label="Copy the prompt" onClick={() => doCopy(false)} style={{ minHeight: 36, padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 6, borderRadius: theme.radius.full, border: `1px solid ${theme.border.default}`, background: theme.fill.secondary, color: theme.text.primary, fontSize: theme.font.caption.fontSize, fontFamily: theme.font.family, cursor: "pointer" }}><CopyIcon />{copyState === "ok" ? "Copied" : "Copy"}</button>
      </div>
      <div style={{ userSelect: "text", WebkitUserSelect: "text", cursor: "text", fontFamily: theme.font.family, fontSize: theme.font.body2.fontSize, lineHeight: theme.font.body2.lineHeight, color: theme.text.primary, background: theme.bg.base, border: `1px solid ${theme.border.default}`, borderRadius: theme.radius.md, padding: "10px 12px", maxHeight: 150, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{promptFor(ask)}</div>
      <span aria-live="polite" style={{ fontSize: theme.font.label.fontSize, color: copyState === "ok" ? theme.text.success : copyState === "fail" ? theme.text.warning : theme.text.tertiary }}>
        {copyState === "ok" ? "Copied. Paste it into Claudia's chat." : copyState === "fail" ? "This page couldn't reach your clipboard. Tap and hold the text to copy." : "Copy it, then paste it into Claudia's chat."}
      </span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: theme.font.subtext.fontSize, color: theme.text.primary }}>Ask Claudia about this?</span>
        <div style={{ display: "flex", gap: 10 }}>
          <button aria-label="No, close" onClick={() => setAsk(null)} style={roundBtn(theme.text.danger)}>
            <svg width={16} height={16} viewBox="0 0 16 16"><path d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5" stroke={theme.text.onColor} strokeWidth={2.2} strokeLinecap="round" /></svg>
          </button>
          <button aria-label="Yes, copy a prompt for Claudia" onClick={() => doCopy(true)} style={roundBtn(theme.text.success)}>
            <svg width={18} height={18} viewBox="0 0 18 18"><path d="M3.5 9.5 L7.5 13.5 L14.5 5" fill="none" stroke={theme.text.onColor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
    </div>
  );

  // "All open promises" list: grouped, overdue first. Search narrows it like the graph.
  const listed = OPEN.filter((c) => !q || c.what.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || nameOf(c.person_id).toLowerCase().includes(q));
  const promiseRow = (c: Commitment) => {
    const lt = isLate(c);
    return (
      <div key={c.id} style={{ border: `1px solid ${lt ? theme.border.default : theme.border.weak}`, borderRadius: theme.radius.md, background: theme.fill.secondary, overflow: "hidden" }}>
        <button onClick={() => askAbout(c, "list")} aria-label={`Ask Claudia about ${c.id}`} style={{ width: "100%", minHeight: 52, display: "flex", alignItems: "center", gap: 10, padding: "12px 12px 6px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontFamily: theme.font.family }}>
          <CommitGlyph c={c} />
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: theme.font.body2.fontSize, lineHeight: theme.font.body2.lineHeight, color: lt ? theme.text.danger : theme.text.primary }}>{c.what}</span>
            <span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>{c.id}{PROMISE_GROUPS[2][1](c) ? ` \u00b7 ${c.direction}` : ""}</span>
          </span>
          <Status tone={lt ? "danger" : "neutral"}>{lt ? `overdue ${c.due}` : `due ${c.due}`}</Status>
          <CopyIcon />
        </button>
        <div style={{ display: "flex", padding: "0 12px 10px 36px" }}>
          <button onClick={() => { focusOn(c.person_id); stageRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); }} aria-label={`Show ${nameOf(c.person_id)} on the map`} style={{ minHeight: 36, padding: "6px 12px", borderRadius: theme.radius.full, border: `1px solid ${theme.border.default}`, background: theme.bg.elevated, color: theme.text.primary, fontSize: theme.font.caption.fontSize, fontFamily: theme.font.family, cursor: "pointer" }}>{nameOf(c.person_id)} {"\u2192"}</button>
        </div>
        {ask && ask.id === c.id && askWhere === "list" && <div style={{ padding: "0 8px 8px" }}>{askCard()}</div>}
        {toast && toast.where === "list" && toast.id === c.id && <div role="status" style={{ padding: "0 12px 10px 36px", fontSize: theme.font.label.fontSize, color: theme.text.success }}>{toast.text}</div>}
      </div>
    );
  };
  const promiseList = (
    <div role="region" aria-label="All open promises list" style={{ display: "flex", flexDirection: "column", gap: 14, border: `1px solid ${theme.border.weak}`, borderRadius: theme.radius.lg, background: theme.bg.elevated, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.secondary }}>{q ? `${listed.length} of ${OPEN.length} open promises match your search.` : `The graph now shows only you, the ${promiseSet.nodes.size - 1} people with open promises, and those promises.`} Tap a promise to ask Claudia; tap a name to fly to it.</span>
        <Button label="Show everything" onClick={() => setPromises(false)} />
      </div>
      {!listed.length && <span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>No open promises{q ? " match" : ""}.</span>}
      {PROMISE_GROUPS.map(([title, test]) => {
        const list = listed.filter(test);
        if (!list.length) return null;
        const late = list.filter(isLate).length;
        return (
          <div key={title} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: theme.font.subtext.fontSize, fontWeight: theme.weight.semibold, color: theme.text.primary }}>{title} ({list.length}{late ? `, ${late} overdue` : ""})</span>
            {list.map(promiseRow)}
          </div>
        );
      })}
    </div>
  );

  return (
    <Page
      title="Claudia's Brain"
      summary={LEDGER.example ? "Example data: every person, org and project here is made up. Yours is rebuilt from your Claudia Ledger." : `Built from your Claudia Ledger, generated ${LEDGER.generated}.`}
      width="full"
    >
      <div ref={rowRef} style={{ display: "flex", flexWrap: narrow ? "wrap" : "nowrap", gap: 14, alignItems: "stretch" }}>
        <div ref={stageRef} style={{ position: "relative", flex: "1 1 auto", width: narrow ? "100%" : undefined, minWidth: 0, aspectRatio: narrow ? "2 / 3" : "10 / 7", borderRadius: theme.radius.lg, overflow: "hidden", border: `1px solid ${theme.border.weak}` }}>
          <canvas
            ref={canvasRef}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", touchAction: "none", userSelect: "none", cursor: "grab" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onCancel}
            onPointerLeave={() => { if (hoverRef.current) { hoverRef.current = null; dirty.current = true; } }}
          />
          <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, pointerEvents: "none" }}>
            <div style={{ display: "flex", gap: 6, pointerEvents: "auto" }}>
              {selected && <button style={hudBtn} onClick={unfocus}>{"\u2190"} Back</button>}
              {selected !== OWNER_ID && <button style={hudBtn} onClick={() => focusOn(OWNER_ID)}>{OWNER_NAME}</button>}
              {promiseMode && !selected && <button style={hudBtn} onClick={() => setPromises(false)}>Show everything</button>}
            </div>
            <div style={{ display: "flex", gap: 6, pointerEvents: "auto" }}>
              <button style={{ ...hudBtn, background: labelMenu ? theme.fill.secondary : theme.bg.elevated }} aria-expanded={labelMenu} aria-label="Labels" onClick={() => setLabelMenu(!labelMenu)}>Labels {labelCount}/5</button>
              <button style={hudBtn} aria-label="Zoom in" onClick={() => zoomBy(1.3)}>+</button>
              <button style={hudBtn} aria-label="Zoom out" onClick={() => zoomBy(1 / 1.3)}>{"\u2212"}</button>
              <button style={hudBtn} onClick={resetView}>Fit</button>
            </div>
          </div>
          {labelMenu && (
            <div role="group" aria-label="Show labels" style={{ position: "absolute", top: 50, right: 10, width: 220, background: theme.bg.elevated, border: `1px solid ${theme.border.default}`, borderRadius: theme.radius.lg, padding: 10, display: "flex", flexDirection: "column", gap: 2, zIndex: 2 }}>
              <div style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary, padding: "0 4px 4px" }}>Show labels. Search matches and the tapped node always keep theirs.</div>
              {LABEL_ROWS.map(([k, name]) => (
                <div key={k} style={{ minHeight: 36, display: "flex", alignItems: "center", padding: "0 4px" }}>
                  <Toggle label={name} value={labels[k]} onChange={(v) => setLabels({ ...labels, [k]: v })} />
                </div>
              ))}
            </div>
          )}
          {!sheetOpen && (
            <div style={{ position: "absolute", left: 12, bottom: 10, fontFamily: theme.font.mono, fontSize: 11, letterSpacing: 0.4, color: theme.text.tertiary, opacity: 0.8, pointerEvents: "none" }}>
              {only ? `${only.nodes.size} nodes \u00b7 ${only.edges.size} open promises` : `${base.nodes.length} nodes \u00b7 ${base.edges.length} links`}{lite ? " \u00b7 lite mode" : ""}
            </div>
          )}
          {narrow && (
            <div style={{
              position: "absolute", left: 0, right: 0, bottom: 0, height: sheetTall ? "92%" : "52%",
              transform: sheetOpen ? "translateY(0)" : "translateY(105%)",
              transition: reduced ? "none" : `transform 340ms cubic-bezier(0.22, 1, 0.36, 1), height 300ms ease`,
              background: theme.bg.elevated, borderTop: `1px solid ${theme.border.default}`,
              borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl,
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}>
              <button aria-label={sheetTall ? "Shrink panel" : "Expand panel"} onClick={() => setSheetTall(!sheetTall)} style={{ border: "none", background: "transparent", padding: "8px 0 4px", cursor: "pointer", display: "flex", justifyContent: "center" }}>
                <span style={{ width: 40, height: 4, borderRadius: 2, background: theme.border.strong, display: "block" }} />
              </button>
              <div style={{ overflowY: "auto", padding: "4px 16px 18px", flex: 1, minHeight: 0 }}>
                {panelId && <SidePanel id={panelId} onPick={focusOn} onBack={unfocus} onAsk={askAbout} onPromises={() => setPromises(true)} />}
              </div>
            </div>
          )}
          {ask && askWhere === "stage" && (
            <div onClick={(e) => { if (e.target === e.currentTarget) setAsk(null); }} style={{ position: "absolute", inset: 0, zIndex: 30, background: STAGE.scrim, display: "flex", alignItems: "center", justifyContent: "center", padding: 12, boxSizing: "border-box" }}>
              {askCard()}
            </div>
          )}
          {toast && toast.where === "stage" && (
            <div role="status" style={{ position: "absolute", left: 12, right: 12, bottom: 14, zIndex: 31, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
              <span style={{ background: theme.fill.primary, color: theme.text.onPrimary, borderRadius: theme.radius.full, padding: "8px 16px", fontSize: theme.font.subtext.fontSize, fontFamily: theme.font.family, textAlign: "center" }}>{toast.text}</span>
            </div>
          )}
        </div>
        {!narrow && (
          <div style={{ flex: "0 0 340px", position: "relative", minHeight: 320 }}>
            <div style={{ position: "absolute", inset: 0, overflowY: "auto", border: `1px solid ${theme.border.weak}`, borderRadius: theme.radius.lg, background: theme.bg.elevated, padding: 14 }}>
              {selected ? <SidePanel id={selected} onPick={focusOn} onBack={unfocus} onAsk={askAbout} onPromises={() => setPromises(true)} /> : <NudgeList onPick={focusOn} onPromises={() => setPromises(true)} />}
            </div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        <button aria-pressed={promiseMode} onClick={() => setPromises(!promiseMode)} style={{ width: "100%", minHeight: 54, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 16px", borderRadius: theme.radius.lg, border: `1px solid ${promiseMode ? theme.border.focus : theme.border.default}`, background: promiseMode ? theme.fill.accentSubtle : theme.bg.elevated, color: theme.text.primary, cursor: "pointer", fontFamily: theme.font.family, textAlign: "left" }}>
          <span style={{ fontSize: theme.font.body1.fontSize, lineHeight: theme.font.body1.lineHeight, fontWeight: theme.weight.semibold }}>All open promises ({openCount}{overdue ? `, ${overdue} overdue` : ""})</span>
          <span style={{ fontSize: theme.font.caption.fontSize, color: promiseMode ? theme.text.accent : theme.text.secondary }}>{promiseMode ? "On \u00b7 tap to show everything" : "Show only these on the graph"}</span>
        </button>
        {promiseMode && promiseList}
        {toolbar}
        {match.active && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>
              {nodeMatches.length || match.commits.length ? [nodeMatches.length ? `${nodeMatches.length} on the map` : "", match.commits.length ? `${match.commits.length} promise${match.commits.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(", ") + ". Fly to:" : "No matches."}
            </span>
            {nodeMatches.slice(0, 8).map((n) => chip(n.label, () => focusOn(n.id), n.id))}
            {match.commits.slice(0, 6).map((c) => chip(`\u201c${trunc(c.what, 28)}\u201d \u00b7 ${nameOf(c.person_id)}`, () => focusOn(c.person_id), c.id))}
          </div>
        )}
        <GraphLegend />
        <div style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>Tap any node to fly in and see its connections and promises; tap a promise line or its label to ask Claudia about it; tap empty space to fly back out.</div>
      </div>
      {narrow && !selected && (
        <div style={{ marginTop: 4, border: `1px solid ${theme.border.weak}`, borderRadius: theme.radius.lg, background: theme.bg.elevated, padding: 14 }}>
          <NudgeList onPick={focusOn} onPromises={() => setPromises(true)} />
        </div>
      )}
      <Metrics metrics={[
        { value: countHealth("active"), label: "Active", tone: "success" },
        { value: countHealth("cooling"), label: "Cooling", tone: "warning" },
        { value: countHealth("inactive"), label: "Inactive" },
        { value: String(openCount), label: "Open commitments", detail: `${overdue} overdue`, tone: overdue ? "danger" : undefined },
      ]} />
      <Text>You sit at the center; the dotted rings hold active, cooling and inactive people, closest first. Colored links are promises and point toward whoever is owed: orange you owe, cyan owed to you, violet Claudia or your bots owe, red overdue; open ones glow and flow. Dashed blue lines are inferred links, never stated as fact. Contact details, private notes and sensitive conversations are kept off this Page. Made with Grok Bot.</Text>
    </Page>
  );
}

function GraphLegend() {
  const theme = useGrokTheme();
  const item = (svg: ReactNode, label: string) => (
    <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: theme.text.secondary, fontSize: theme.font.caption.fontSize }}>
      <svg width={18} height={18} viewBox="0 0 18 18">{svg}</svg>{label}
    </span>
  );
  const hex = "9,1.5 15.5,5.25 15.5,12.75 9,16.5 2.5,12.75 2.5,5.25";
  const arrow = (color: string) => (
    <g><line x1={1} y1={9} x2={13} y2={9} stroke={color} strokeWidth={2} /><polygon points="17,9 11,5.5 11,12.5" fill={color} /></g>
  );
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
      {item(<g><circle cx={9} cy={9} r={5} fill={STAGE.owner} /><circle cx={9} cy={9} r={8} fill="none" stroke={STAGE.owner} strokeWidth={1.2} strokeDasharray="2 2" /></g>, OWNER_NAME)}
      {item(<circle cx={9} cy={9} r={6} fill={STAGE.person} />, "Person")}
      {item(<polygon points={hex} fill={STAGE.org} />, "Org")}
      {item(<polygon points="9,1 17,9 9,17 1,9" fill={STAGE.project} />, "Project")}
      {item(<circle cx={9} cy={9} r={5.5} fill="none" stroke={STAGE.active} strokeWidth={2.5} />, "Active")}
      {item(<circle cx={9} cy={9} r={5.5} fill="none" stroke={STAGE.cooling} strokeWidth={2.5} />, "Cooling")}
      {item(<circle cx={9} cy={9} r={5.5} fill="none" stroke={STAGE.inactive} strokeWidth={2.5} />, "Inactive")}
      {item(arrow(STAGE.owe), "You owe")}
      {item(arrow(STAGE.owed), "Owed to you")}
      {item(arrow(STAGE.bot), "Claudia / bots owe")}
      {item(arrow(STAGE.overdue), "Overdue")}
      {item(<line x1={1} y1={9} x2={17} y2={9} stroke={theme.text.tertiary} strokeWidth={1.5} strokeDasharray="4 3" />, "Inferred link")}
    </div>
  );
}

function NudgeList({ onPick, onPromises }: { onPick: (id: string) => void; onPromises: () => void }) {
  const theme = useGrokTheme();
  const small = { fontSize: theme.font.caption.fontSize, lineHeight: theme.font.caption.lineHeight };
  const tone: Record<string, string> = { active: theme.text.success, cooling: theme.text.warning, inactive: theme.text.tertiary };
  const quiet = LEDGER.people.filter((p) => p.health !== "active").sort((a, b) => b.days_since - a.days_since).slice(0, 6);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: theme.font.heading3.fontSize, fontWeight: theme.weight.semibold, color: theme.text.primary }}>Needs a nudge</div>
      <div style={{ ...small, color: theme.text.tertiary }}>Tap a name to fly to it. Quiet relationships first:</div>
      {quiet.map((p) => (
        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => onPick(p.id)} style={{ ...small, border: `1px solid ${theme.border.weak}`, background: theme.fill.secondary, color: theme.text.primary, borderRadius: theme.radius.full, padding: "3px 10px", cursor: "pointer", fontFamily: theme.font.family }}>{p.name}</button>
          <span style={{ ...small, color: tone[p.health] }}>{p.days_since}d, usually every {p.cadence_days}d</span>
        </div>
      ))}
      <button onClick={onPromises} style={{ ...small, alignSelf: "flex-start", minHeight: 36, border: `1px solid ${theme.border.default}`, background: theme.fill.secondary, color: theme.text.primary, borderRadius: theme.radius.md, padding: "6px 12px", cursor: "pointer", fontFamily: theme.font.family }}>See all your open promises</button>
    </div>
  );
}

function CommitGlyph({ c }: { c: Commitment }) {
  const color = isLate(c) ? STAGE.overdue : commitColor(c);
  return (
    <svg width={14} height={10} viewBox="0 0 18 12" style={{ flex: "0 0 auto", marginTop: 3 }}>
      <line x1={1} y1={6} x2={12} y2={6} stroke={color} strokeWidth={2} /><polygon points="17,6 11,2 11,10" fill={color} />
    </svg>
  );
}

function CopyIcon() {
  const theme = useGrokTheme();
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "0 0 auto" }}>
      <rect x={5.5} y={5.5} width={8} height={8} rx={1.5} fill="none" stroke={theme.text.tertiary} strokeWidth={1.4} />
      <path d="M10.5 3.5 V3 a1.5 1.5 0 0 0 -1.5 -1.5 H4 A1.5 1.5 0 0 0 2.5 3 V9 a1.5 1.5 0 0 0 1.5 1.5 h0.5" fill="none" stroke={theme.text.tertiary} strokeWidth={1.4} />
    </svg>
  );
}

function OwnerPanel({ onBack, onPromises }: { onBack: () => void; onPromises: () => void }) {
  const theme = useGrokTheme();
  const small = { fontSize: theme.font.caption.fontSize, lineHeight: theme.font.caption.lineHeight };
  const label = { ...small, fontWeight: theme.weight.semibold, color: theme.text.primary };
  const muted = { ...small, color: theme.text.tertiary };
  const open = OPEN;
  const late = open.filter(isLate).length;
  const hc = (hh: string) => LEDGER.people.filter((p) => p.health === hh).length;
  const recent = [...LEDGER.interactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  const actorLabel: Record<string, string> = { owner: "You", them: "They", claudia: "Claudia", both: "You + them" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={muted}>Center of your network</div>
          <div style={{ fontSize: theme.font.heading3.fontSize, fontWeight: theme.weight.semibold, color: theme.text.primary }}>{OWNER_NAME}</div>
        </div>
        <Button label="Back" onClick={onBack} />
      </div>
      <div style={{ ...small, color: theme.text.secondary }}>{LEDGER.people.length} people {"\u00b7"} {LEDGER.orgs.length} orgs {"\u00b7"} {LEDGER.projects.length} projects {"\u00b7"} {hc("active")} active, {hc("cooling")} cooling, {hc("inactive")} inactive</div>
      <div style={{ ...small, color: late ? theme.text.danger : theme.text.primary, fontWeight: theme.weight.semibold }}>{open.length} open promises{late ? `, ${late} overdue` : ""}</div>
      <button onClick={onPromises} style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", textAlign: "left", border: `1px solid ${theme.border.default}`, background: theme.fill.secondary, color: theme.text.primary, borderRadius: theme.radius.md, padding: "10px 12px", cursor: "pointer", fontFamily: theme.font.family, fontSize: theme.font.subtext.fontSize }}>
        <span>See all your open promises</span><span style={{ color: theme.text.secondary }}>{"\u2192"}</span>
      </button>
      {recent.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={label}>Latest activity</span>
          {recent.map((t) => (
            <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ ...muted, minWidth: 78 }}>{t.date}</span>
              <span style={{ ...small, color: theme.text.primary }}>{actorLabel[t.actor] || t.actor} ({nameOf(t.person_id)}): {t.summary} <span style={muted}>{"\u00b7"} {t.channel}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SidePanel({ id, onPick, onBack, onAsk, onPromises }: { id: string; onPick: (id: string) => void; onBack: () => void; onAsk: (c: Commitment) => void; onPromises: () => void }) {
  const theme = useGrokTheme();
  if (id === OWNER_ID) return <OwnerPanel onBack={onBack} onPromises={onPromises} />;
  const small = { fontSize: theme.font.caption.fontSize, lineHeight: theme.font.caption.lineHeight };
  const label = { ...small, fontWeight: theme.weight.semibold, color: theme.text.primary };
  const muted = { ...small, color: theme.text.tertiary };
  const tone: Record<string, string> = { active: theme.text.success, cooling: theme.text.warning, inactive: theme.text.tertiary };
  const person = LEDGER.people.find((p) => p.id === id);
  const org = LEDGER.orgs.find((o) => o.id === id);
  const project = LEDGER.projects.find((p) => p.id === id);
  const related = EDGES.filter((l) => l.kind !== "commit" && (l.from_id === id || l.to_id === id));
  const groups: Record<Kind, Array<{ other: string; type: string; inferred: boolean }>> = { owner: [], person: [], org: [], project: [] };
  related.forEach((l) => {
    const other = l.from_id === id ? l.to_id : l.from_id;
    groups[kindOf(other)].push({ other, type: l.type.replace(/_/g, " "), inferred: l.basis === "inferred" });
  });
  const groupName: Record<Kind, string> = { owner: "You", person: "People", org: "Organizations", project: "Projects" };
  const peopleIds = person ? [id] : groups.person.map((g) => g.other);
  const commits = LEDGER.commitments.filter((c) => peopleIds.includes(c.person_id));
  const mine = commits.filter((c) => c.direction === "I owe");
  const theirs = commits.filter((c) => c.direction === "owed to me");
  const team = commits.filter((c) => c.direction !== "I owe" && c.direction !== "owed to me");
  const timeline = LEDGER.interactions.filter((i) => peopleIds.includes(i.person_id)).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);
  const actorLabel: Record<string, string> = { owner: "You", them: "They", claudia: "Claudia", both: "You + them" };
  const glyph = (k: Kind) => (
    <svg width={12} height={12} viewBox="0 0 18 18" style={{ flex: "0 0 auto" }}>
      {k === "owner" ? <circle cx={9} cy={9} r={7} fill={STAGE.owner} /> : k === "person" ? <circle cx={9} cy={9} r={7} fill={STAGE.person} /> : k === "org" ? <polygon points="9,1 16,5 16,13 9,17 2,13 2,5" fill={STAGE.org} /> : <polygon points="9,1 17,9 9,17 1,9" fill={STAGE.project} />}
    </svg>
  );
  const commitRow = (c: Commitment) => {
    const late = isLate(c);
    return (
      <button key={c.id} onClick={() => onAsk(c)} aria-label={`Ask Claudia about ${c.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%", minHeight: 48, textAlign: "left", border: `1px solid ${theme.border.weak}`, background: theme.fill.secondary, borderRadius: theme.radius.md, padding: "10px 12px", cursor: "pointer", fontFamily: theme.font.family }}>
        <span style={{ display: "inline-flex", gap: 8, minWidth: 0, ...small, color: late ? theme.text.danger : theme.text.primary }}>
          <CommitGlyph c={c} />
          <span>{c.what}{!person ? `, ${nameOf(c.person_id)}` : ""} <span style={muted}>{c.id}{team.includes(c) ? `, ${c.direction}` : ""}</span></span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
          <Status tone={c.status === "done" ? "success" : late ? "danger" : c.status === "renegotiated" ? "accent" : "neutral"}>{late ? `overdue ${c.due}` : c.status === "open" ? `due ${c.due}` : c.status}</Status>
          <CopyIcon />
        </span>
      </button>
    );
  };
  const commitGroup = (title: string, list: Commitment[]) => list.length > 0 && (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={label}>{title} ({list.filter((c) => c.status === "open").length} open)</span>
      {list.map(commitRow)}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={muted}>{id}{person ? ", person" : org ? ", organization" : ", project"}</div>
          <div style={{ fontSize: theme.font.heading3.fontSize, fontWeight: theme.weight.semibold, color: theme.text.primary }}>{nameOf(id)}</div>
        </div>
        <Button label="Back" onClick={onBack} />
      </div>
      {person && <div style={{ ...small, color: theme.text.secondary }}>{person.role}{person.org_id ? `, ${nameOf(person.org_id)}` : ""} · {person.city} · {person.network} · {person.relationship} · met via {person.how_met}</div>}
      {project && <div style={{ ...small, color: theme.text.secondary }}>{project.status} · {nameOf(project.org_id)}</div>}
      {person && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, background: tone[person.health], display: "inline-block", flex: "0 0 auto" }} />
          <span style={{ ...small, color: theme.text.primary }}>{person.health} · last contact {daysLabel(person.days_since)} · usually every {person.cadence_days} days</span>
        </div>
      )}
      {commitGroup("You owe", mine)}
      {commitGroup("Owed to you", theirs)}
      {commitGroup("Claudia and your bots owe", team)}
      {related.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={label}>Connected to ({related.length})</span>
          {(["owner", "person", "org", "project"] as Kind[]).filter((k) => groups[k].length > 0).map((k) => (
            <div key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={muted}>{groupName[k]}</span>
              {groups[k].map((g, i) => (
                <button key={g.other + i} onClick={() => onPick(g.other)} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", width: "100%", textAlign: "left", border: `1px solid ${theme.border.weak}`, background: theme.fill.secondary, borderRadius: theme.radius.md, padding: "6px 10px", cursor: "pointer", fontFamily: theme.font.family }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, ...small, color: theme.text.primary }}>{glyph(k)}{nameOf(g.other)}</span>
                  <span style={{ ...muted, textAlign: "right" }}>{g.type}{g.inferred ? " (inferred)" : ""}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {timeline.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={label}>Timeline</span>
          {timeline.map((t) => (
            <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ ...muted, minWidth: 78 }}>{t.date}</span>
              <span style={{ ...small, color: theme.text.primary }}>{actorLabel[t.actor] || t.actor}{!person ? ` (${nameOf(t.person_id)})` : ""}: {t.summary} <span style={muted}>· {t.channel}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
