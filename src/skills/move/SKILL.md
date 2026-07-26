---
name: move
description: How to reposition a run of the target's messages within the view — the
  turn-group unit, the branch-replay model, and the cache doctrine for batching.
  Read when the human wants to bring spent or scattered context to the window's tail.
---

# Moving a run within a target session

Move repositions a contiguous run of the target's messages to another point in
the conversation — for example, bringing scattered skill reads to the tail so
they sit in the attention-hot end of the window.

## The model

Move is **non-destructive**, exactly like elision: it branches the target's
append-only tree at the earliest touched position and replays the reordered
tail. The originals stay on the sibling branch; the on-disk record is never
rewritten. A `meta-moved` entry records the move's provenance.

You drive it with the `move_region` tool, identifying the run by its first and
last message `id` and the destination by the id it should follow:
`{ from, to, after }`.

Replayed messages get new ids; the move records the old-to-new correspondence in
a `meta-remap` entry so tags follow their messages. Ids you read before a move do
not survive it — re-read before referring to them again.

## Rules

- **The unit is the turn-group.** A run should be a user message with its
  assistant response(s) and their complete toolCall/toolResult chains. A move
  whose boundary would sever a tool call from its result is rejected — widen the
  run to include both.
- Resolve every id from a **single fresh read** of the current target, and issue
  the move as one call. A move rewrites the tail, so ids from a stale read will
  not resolve afterward.

## Cache doctrine

A move reprices the prompt cache from the earliest touched position — everything
from the branch point onward is re-sent. So **batch moves at boundaries where
the cache is already being repriced** — a persona flip, an elision pass — rather
than sprinkling them between working turns. One deliberate reordering at a
boundary is cheap; a move mid-conversation throws away the cached prefix for
pure repositioning.
