---
name: elision
description: How to elide regions of a target session well — the branch model, the
  one-fresh-read discipline, and synopsis formatting. Read when the human wants to
  collapse spent stretches of the target into summaries.
---

# Eliding regions of a target session

Elision collapses a contiguous run of target messages into a single synopsis
entry, so the target's running context drops the spent detail while the verbatim
record is preserved. You drive it with the `elide_regions` tool.

## The model

Eliding is **non-destructive**. The tool branches the target's append-only
session tree: the original messages stay on a sibling branch, and a new
`meta-elided` entry takes their place on the active branch.

- The target **model** sees the synopsis in place of the run.
- The **human** sees a collapsed banner that expands to the greyed verbatim.
- Nothing is deleted; the on-disk record is never overwritten.

## How to do it

1. Read the target `.jsonl` with your file tools. Each line is an entry
   `{ id, parentId, timestamp, type, message }`. The conversation turns are
   `type: "message"` entries; each has a stable `id`.
2. With the human, agree on which runs to collapse. Be specific about what stays
   and what goes; confirm before acting.
3. Identify each run by the **first** and **last** message `id` within it. Call
   `elide_regions` **once** with every run, each as `{ fromId, toId, synopsis }`.

### The one rule that matters

Resolve every `fromId`/`toId` from a **single fresh read** of the current file,
and pass them all in **one** call. Do not compute ids from one read and then
fire several calls, or precompute a batch across separate reads — each elision
rewrites the tail, so ids from a stale read will no longer resolve. One read,
one call, non-overlapping regions.

## Writing the synopsis

Each synopsis renders as **markdown** in its collapsed banner, so make it
scannable, not a wall of text. Prefer a one-line bold gist followed by a short
bullet list of the key points or decisions — a few bullets, not paragraphs:

```
**Reworked elision to a branch-based model.**
- tool opens the target via the SDK and writes through directly
- /back is pure navigation; no payload travels
- verbatim preserved on the sibling branch
```
