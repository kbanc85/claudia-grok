# Claudia's Brain (Grok Bot Page)

Fixed, hosted design file for the public Grok Bot template **Claudia, Chief of Staff**. Every installed copy should download this exact framework instead of improvising its own design.

## The file

[`claudia-brain.canvas.tsx`](./claudia-brain.canvas.tsx) is a single-file React canvas (Grok Bot Page) that renders **Claudia's Brain**: a network graph with the owner as a gold central node, people / orgs / projects, promises as colored edges, search that keeps matches highlighted, label toggles, a tap-a-promise “Ask Claudia about this?” prompt, filters, and person cards.

## Download URL

Grok Bot copies of Claudia download the template from the raw URL:

```text
https://raw.githubusercontent.com/kbanc85/claudia-grok/main/grokbot/brain/claudia-brain.canvas.tsx
```

## Data contract

Ledger data lives between the markers `/* LEDGER-DATA-START */` and `/* LEDGER-DATA-END */` as:

```ts
const LEDGER: Ledger = <json>;
```

**Only that marker block may be replaced.** Do not edit the surrounding UI.

Shape (from `type Ledger` and related types in the canvas):

```ts
type Person = {
  id: string;
  name: string;
  org_id: string | null;
  role: string;
  network: string;
  relationship: string;
  cadence_days: number;
  last_contact: string;
  days_since: number;
  health: string;
  city: string;
  how_met: string;
};

type Org = { id: string; name: string };

type Project = { id: string; name: string; org_id: string; status: string };

type Link = {
  from_id: string;
  to_id: string;
  type: string;
  basis: string;
  source: string;
};

type Commitment = {
  id: string;
  direction: string;
  person_id: string;
  what: string;
  due: string;
  status: string;
  source_link: string;
};

type Interaction = {
  id: string;
  date: string;
  person_id: string;
  channel: string;
  actor: string;
  summary: string;
  source_link: string;
};

type Ledger = {
  generated: string;
  example: boolean;
  owner?: { name: string };
  people: Person[];
  orgs: Org[];
  projects: Project[];
  links: Link[];
  commitments: Commitment[];
  interactions: Interaction[];
};
```

The owner hub uses id `ME`. Person / org / project ids conventionally look like `P-…`, `O-…`, and project ids respectively.

## Privacy

The data must **never** include emails, phone numbers, or other sensitive fields (no `notes_pointer`, no rows tagged sensitive). The shipped template uses made-up example data only (`example: true`).

## Inject helper

[`inject.py`](./inject.py) (Python 3, stdlib only) takes the downloaded template and a ledger JSON file and writes a canvas with only the marker block replaced. It fails loudly if the markers are missing.

```bash
python3 inject.py claudia-brain.canvas.tsx ledger.json -o out.canvas.tsx
```

## Version

v1, 2026-10-24

Made with Grok Bot.
