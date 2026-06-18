# pi-meta

A conversational **meta-channel** for [pi](https://github.com/) — talk *about* a
session in a linked side thread, then non-destructively **elide** spent regions
from that session's view. The on-disk log is never modified; eliding is
deprecation-from-view, not deletion.

## Why

Sometimes a session spends a lot of context on work that was worth doing but
isn't worth keeping in the running window — a throwaway spike, a noisy tool
sweep, an abandoned exploration. You want to compress it out of what the model
sees **without** destroying the verbatim record of what happened.

pi-meta gives you a parallel conversation (a child "meta" session) to decide,
collaboratively, exactly what to elide — and an applier that collapses those
regions in the target's view on every turn.

## How it works

Three surfaces, one auto-loaded extension:

| Surface | Where | Does |
|---|---|---|
| `/meta [task]` | a **target** session | open or resume a linked child meta session |
| `/back` | a **meta** session | switch back to its target |
| `context` handler | every session | apply the target's elide ops to the in-flight view |

State lives next to the sessions, with no central registry:

- **Target side:** a sidecar `<target>.jsonl.meta.json` holding
  `{ metaSession, ops }`. The meta-agent authors `ops`; the extension owns
  `metaSession`.
- **Meta side:** a `meta-target` custom entry recording the target path (the
  reverse link). The meta session is created as a **child** of the target, so it
  also nests under it in the session selector.

### The elide mechanism

pi's `context` event hands every extension the message array right before each
LLM call, on a clone — whatever you return is what the model sees, and the
stored session is untouched. pi-meta matches messages by their `timestamp`
value (not array index, so it's robust to reordering by other extensions) and
collapses each `{from, to}` window into a single synopsis line.

## The sidecar format

```json
{
  "metaSession": "/abs/path/to/..._meta.jsonl",
  "ops": [
    {
      "op": "elide",
      "from": 1781741150324,
      "to": 1781741183506,
      "synopsis": "What happened in this region, in one tight paragraph."
    }
  ]
}
```

`ops` is a forward-compatible discriminated union. v1 implements **`elide`**.
Future verbs (e.g. `replace`, `inject`) slot in here and in `src/ops.ts` without
touching the link/switch machinery; unknown ops are ignored by older builds.

## Install

**Folder drop:** copy `pi-meta/` into `~/.pi/agent/extensions/`. Done — pi
discovers it via the `pi.extensions` manifest in `package.json`.

**npm:** publish, then add `"npm:pi-meta"` to your `settings.json` `packages`.

No runtime dependencies beyond pi itself.

## Files

```
pi-meta/
  package.json     # pi.extensions manifest
  src/
    index.ts       # /meta, /back, context handler
    ops.ts         # op types + appliers (elide)
    sidecar.ts     # sidecar read/write + path derivation
  README.md
```
