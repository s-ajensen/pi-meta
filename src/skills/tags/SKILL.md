---
name: tags
description: How to read and apply tags on a target session — the fold, resolving a
  tag to its messages, slicing a radius around each, and back-filling judgment tags.
  Read when the human wants to index the target or query it by tag.
---

# Tags on a target session

A tag is a named marker applied to a message. Tags turn the target into an
index over itself: the human (or you) marks a message, and later that mark is
queryable without re-walking the transcript.

## The model

Each tag application is one appended entry in the target log:

```jsonc
{ "type": "custom", "customType": "meta-tag",
  "data": { "op": "apply", "tag": "REGRESSION", "target": "<entry-id>", "by": "meta" } }
```

- `target` is the tagged entry's on-disk `id`.
- Retraction is the same record with `"op": "retract"`. Nothing is ever deleted.
- Tags are `type: "custom"` — **invisible to the target model by construction**
  (pi's context builder drops custom entries). They live only in the log and in
  the human's `/tag` view.

**Tag state is a fold, never stored.** Walk the whole log in order; for each
`(tag, target)` pair the latest `op` wins. Fold over the *full* log, not the
active branch — a tag applied before a branch point survives into siblings, and
a tag record appended before an elision is orphaned off the active branch even
though the tag still holds.

**Tags follow their message across replays.** Elision and move rebuild the tail
as new entries with new ids, and record the correspondence in a `meta-remap`
entry (`data.map`: old id → new id). Resolve every tag's `target` through the
composed remap chain — transitively, since a message replayed many times has a
chain of ids — before folding. A tag applied to an old id and retracted via the
replayed id must cancel out.

## Reading tags (no tool needed)

You already read the target `.jsonl` with your file tools. Tag records are lines
in that file, so query them directly:

- **List** — every applied `(tag, target, by)` after folding:
  `jq -c 'select(.customType=="meta-tag") | .data' <target>` then fold in your head.
- **Resolve** `TYPE → ids` — the folded targets carrying `TYPE`, in log order.
- **Slice** — for a radius around each hit, read the log offset around each id.

Compose with elision: "elide between the last two CHECKPOINTs" = resolve
CHECKPOINT, take the last two ids, elide the span between them.

## Applying tags (the `apply_tags` tool)

Use `apply_tags` to append apply/retract records with `by: "meta"`. Resolve
every `target` id from a fresh read of the current target.

**Back-filled judgment tags are proposals.** ERROR, REGRESSION, and BRILLIANT
are the human's calls. When the log shows an explicit human reaction that names
the judgment (an angry correction, a "that's exactly right"), applying the tag
is safe. When the call is inferred rather than stated, propose it and confirm
before applying. SKILL tags are auto-applied already; don't duplicate them.
