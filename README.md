# pi-meta

A conversational **meta-channel** for [pi](https://github.com/). Open a linked
child *meta* session to reason *about* a target session — in a separate thread,
so the target agent's context stays clean.

The meta thread is general-purpose: mine the conversation for insights, surface
improvements to the pi harness from what happened in the target, extract a
principle worth preserving, or **elide** spent stretches of the target into
summaries. Elision is one capability among several, not the channel's purpose.

## Why

You often want to think *about* a session without polluting it — to ask another
agent to reason over the conversation, or to collapse spent context out of the
running window. pi-meta gives you that side thread, and a growing set of
capabilities to act on the target from within it.

## Use

- **`/meta`** — from any session, opens (or resumes) a meta thread paired with
  it. Takes no arguments: it spawns the thread and waits for you to say what you
  want to explore.
- **`/back`** — from a meta thread, returns to the target.

Inside the meta thread you converse with an agent that can read the target's log
and reason over it. What it can *do* to the target is a set of capabilities,
surfaced to it as skills; the agent reads a skill's instructions when your
request calls for it.

### Elision

The first capability: collapse a contiguous run of target messages into a single
synopsis, so the target's running context drops the spent detail while the
verbatim is preserved.

Ask the meta agent to elide part of the target. It reads the log, agrees the
regions with you, and applies them. Back in the target you'll see each elided run
as a collapsed banner showing the synopsis; the original messages aren't gone —
they expand inline with pi's expand hotkey, and the on-disk record is never
rewritten. The target's model sees only the synopsis.

Capabilities only appear inside meta sessions — a normal session never sees the
elision tool or its skill.

## Install

**Folder drop:** copy `pi-meta/` into `~/.pi/agent/extensions/`.

**npm:** publish, then add `"npm:pi-meta"` to your `settings.json` `packages`.

No runtime dependencies beyond pi itself.

## Develop

Tests run on `bun`, fully isolated from any real pi installation — they use the
SDK's in-memory session and the real extension loader, touching no filesystem
state outside the repo.

```
bun test           # the suite
bun run typecheck   # tsc --noEmit against the real SDK types
```

Adding a capability is an append to the registry in `src/capabilities.ts`: a
meta-scoped tool paired with a skill documenting how to use it. The core meta
prompt doesn't change.
