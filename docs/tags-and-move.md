# Spec: Session Tags + Move (pi-meta v2)

Status: ratified design, awaiting implementation.
Provenance: extracted from the 2026-07-24 Fable session mining the cask corpus
(18 sessions). The failure data motivating each mechanism is summarized in
"Motivation" so this doc stands alone.

## Motivation

Corpus analysis of ~5 weeks of cask sessions showed that the signal needed for
meta-work (where did the human correct the agent, where were checkpoints, where
did the agent shine, where do skill reads sit in the window) exists unambiguously
at *generation* time but is expensive and error-prone to reconstruct at
*extraction* time. Every meta pass re-walks the grown target to find region
boundaries; the worst observed meta failure was a boundary error (a forward-only
walk that missed churn). Separately, corrections and standing context decay under
context pressure (skill text scrolled deep in the window stops firing).

Two primitives address this:

1. **Tags** — a human (or the meta agent) marks messages with named attributes
   at the moment they occur. The session becomes an addressable, queryable
   index over itself. No parallel document that drifts; the annotation lives at
   the coordinates of the thing it marks.
2. **Move** — reposition content within the *view* (never the on-disk log), so
   standing context (e.g. skill reads) can be brought back to the attention-hot
   tail of the window.

Design invariants, inherited from elision:

- **The on-disk log is append-only and never rewritten.** All operations append
  entries; all views are derived.
- **Invisible to the target model by default.** Tags are `custom` entries, which
  `buildContextEntries()` excludes from model context by design. Invisibility
  (and prompt-cache protection) is structural, not implemented.
- **Derive, don't duplicate.** Current tag state is a fold over the log; tag
  colors resolve at render time from definitions; nothing is stored twice.

---

## 1. Tag records

A tag application is an appended `custom` entry in the session log:

```jsonc
{
  "type": "custom",
  "customType": "tag",
  "data": {
    "op": "apply",            // "apply" | "retract"
    "tag": "REGRESSION",      // definition name, uppercase by convention
    "target": "<entry-id>",   // the tagged entry's on-disk id
    "by": "user"              // "user" | "meta" | "auto"
  }
}
```

- `target` references the on-disk entry id — stable across views, branches, and
  elisions.
- Any entry may be tagged (user, assistant, custom), not just user messages.
- Multiple tags may apply to one target; each application is its own entry.
- Retraction: append the same record with `op: "retract"`. Applying then
  retracting then re-applying is legal; state is the fold.
- `by` provenance from day one:
  - `user` — applied via `/tag` in the TUI.
  - `meta` — applied by the meta agent (e.g. retroactive back-filling:
    "tag the regressions I didn't mark").
  - `auto` — applied by an auto-tagger (see §4).

**Fold semantics:** walk the log in order; for each `(tag, target)` pair the
latest `op` wins. The fold is over the *full log*, not the active branch —
a tag applied before a branch point survives into sibling branches referencing
the same target entry.

## 2. Tag definitions

Definitions live outside session logs, so tags are defined once and available
in every session:

- **Workspace scope (default):** `<workspace>/.pi/tags.json`
- **Global scope:** `~/.pi/agent/tags.json`

```jsonc
{
  "REGRESSION": { "color": "#e05252" },
  "CHECKPOINT": { "color": "#52a8e0" },
  "BRILLIANT":  { "color": "#e0c752" },
  "ERROR":      { "color": "#e08552" },
  "SKILL":      { "color": "#7a7a7a" }
}
```

- Resolution: merge global then workspace; workspace wins on name collision.
- `/tag def TYPE #HEX` writes the workspace file (creating `.pi/` if absent).
- `/tag def TYPE #HEX --global` writes the global file.
- Applied tags reference definitions **by name only**. Rendering resolves color
  at view time; recoloring a tag later touches no session log.
- A tag applied in a session whose definition has since been deleted still
  renders (name in default color); the log never becomes invalid.

## 3. Commands & TUI interaction

### `/tag TYPE`

1. Selection mode opens with the **most recent message** selected (any role).
2. `↑`/`↓` move selection; the selected message is visually outlined.
3. `Enter` applies the tag to the selected message; `Esc` cancels.
4. If `TYPE` is undefined, prompt inline to define it (color picker or hex
   input → writes workspace `tags.json`, then proceeds to selection).

### `/untag TYPE`

Same selection interaction; `Enter` appends a retraction. Selection should
indicate which visible messages currently carry `TYPE`.

### `/tag` (bare)

Lists defined tags with colors and scope (workspace/global).

### `/tag def TYPE #HEX [--global]`

Defines or redefines a tag. Redefinition changes color only (name is identity).

### Rendering (target TUI)

- A tagged message renders with a single line above it: each applied tag's
  name in its color. Multiple tags accumulate on that line.
- The tagged message body is subtly highlighted (implementation's choice of
  mechanism; must not impair readability).
- Tags never render into model-visible content. TUI only.

## 4. Auto-tags

**v1 ships exactly one auto-tagger:** skill reads are tagged `SKILL`
(`by: "auto"`) at the entry where the skill file's content enters the session
(the read tool result). This powers the "bring all skill reads to the forefront"
move query.

No other auto-taggers in v1. ERROR/REGRESSION/BRILLIANT are judgment calls
belonging to the human and the meta agent, not heuristics. Additional
auto-taggers must be earned by a concrete query that needs them.

## 5. Meta-channel query surface

A new capability (`tags`) alongside `elision`, surfaced to the meta agent via
the existing capabilities/skills mechanism. Operations the meta agent needs:

- **List** — all applied tags in the target: `(tag, target-id, by)` tuples
  after folding.
- **Resolve** — `TYPE → [entry ids]`, in log order.
- **Slice** — given an entry id and a radius N, return the surrounding
  messages from the target log (for "grab a 5-message radius around every
  REGRESSION").

These compose with elision: "elide everything between the two most recent
CHECKPOINTs" = resolve(CHECKPOINT), take last two, elide the span between them.

The meta agent may also **apply** tags (`by: "meta"`) — retroactive indexing is
a first-class use case, not an afterthought. The capability skill must state
that back-filled judgment tags (ERROR, REGRESSION, BRILLIANT) are proposals to
confirm with the human when the call is not obvious from explicit human
reaction in the log.

When the meta agent reads the target log, applied tags must be visible inline
in its view of the log (they are its index). This is a meta-channel render
choice; the target model's context remains tag-free.

## 6. Move

Reposition a contiguous run of the target's view to another point in the view.

```jsonc
{
  "type": "custom",
  "customType": "meta-moved",
  "data": {
    "op": "move",
    "from": "<entry-id>",     // first entry of the moved run
    "to": "<entry-id>",       // last entry of the moved run
    "after": "<entry-id>"     // the run now renders after this entry
  }
}
```

- **View-order only.** The on-disk log is never reordered. The view derives
  message order by folding move records, exactly as elision derives collapsed
  regions.
- **Unit of movement is the turn-group:** a user message plus its assistant
  response(s) and their complete toolCall/toolResult chains move as one atom.
  The implementation must generalize elision's existing severance guard: a
  move whose boundaries would sever a toolCall from its result is rejected
  atomically with a diagnostic.
- Moves and elisions compose: an elided banner may be moved; a moved run may
  later be elided. Fold order is log-append order.
- **v1 surface: meta-channel only** (the meta agent executes moves as part of
  its capability set, with the same plan-then-ratify discipline as elision).
  An in-target `/move` command may be earned later if reaching through the
  meta channel proves clunky.
- **Cache doctrine (goes in the capability skill text):** a move reprices the
  prompt cache from the earliest touched view position. Batch moves at the
  boundaries where the cache is already being repriced — persona flips,
  elision passes — not sprinkled between working turns.

## 7. Out of scope for v1

Each of these waits for a concrete friction that earns it:

- Per-type model visibility (letting the target model see e.g. CHECKPOINT).
- Tag hierarchies, namespaces, or parameterized tags.
- Heuristic auto-tagging of errors/regressions.
- Cross-session tag queries (the extraction corpus use case; needs its own
  design once tags exist in real sessions).
- In-target `/move` command.

## 8. Implementation notes

- Extend pi-meta; do not create a new extension. Tags and move are capabilities
  of the same kind as elision and slot into the existing seams:
  - `src/ops.ts` — tag fold, move fold, apply/retract/move ops.
  - `src/capabilities.ts` — new `tags` (and `move`) capability entries with
    skill files under `src/skills/`.
  - `src/commands.ts` — `/tag`, `/untag` registration.
  - `src/render.ts` — tag line + highlight in target TUI; inline tags in the
    meta agent's log view.
- TDD against `SessionManager.inMemory()` per the existing `spec/` layout.
- The TUI selection interaction (arrow-key message picking) is the one
  genuinely new surface — pi-meta has never needed message selection. Ground
  the mechanics against pi's extension UI API before committing to the exact
  interaction sketched in §3; the *semantics* (select any visible message,
  apply/retract) are the ratified part, the keystrokes are not.
- The view-fold for moves must be implemented where the target TUI and the
  meta agent's log reads both consume it — one fold, two consumers (one source
  of truth).

## 9. Worked queries (acceptance sketches)

1. Human tags two messages `CHECKPOINT` during a work session. In the meta
   channel: "elide everything between the two most recent checkpoints" —
   resolves to a span, elides it, banner appears in target.
2. Human tags an angry correction `REGRESSION`. Weeks later in a mining pass:
   "pull a 5-message radius around every REGRESSION in this session" — meta
   agent returns the slices verbatim, no transcript re-walk.
3. Skill reads auto-tagged `SKILL`. Human: "bring the skill reads to the
   forefront." Meta agent executes a batched move of the SKILL-tagged
   turn-groups to the view tail, at an elision-pass boundary.
4. Meta agent back-fills: "tag the places I corrected the agent that I didn't
   mark" — proposes `ERROR` applications with `by: "meta"`, human confirms.
