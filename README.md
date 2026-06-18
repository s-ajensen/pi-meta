# pi-meta

A conversational **meta-channel** for [pi](https://github.com/). Open a linked
child *meta* session to talk *about* a target session, and **elide** spent runs
of messages — collapsing them into a single synopsis — non-destructively, by
branching pi's append-only session tree.

The on-disk record is never overwritten. The model (and the TUI) see the
synopsis in place of the run; the verbatim is preserved on the prior branch and
expands inline with the standard expand hotkey.

## Why

Some work is worth doing but not worth keeping in the running context — a
throwaway spike, a noisy tool sweep, an abandoned exploration. pi-meta lets you
decide, in a side conversation, exactly what to collapse out of the model's view
without destroying the verbatim history.

## Surfaces

| Surface | Where | Does |
|---|---|---|
| `/meta [task]` | a **target** session | open or resume a linked child meta session |
| `/back` | a **meta** session | pure navigation back to the target |
| `elide_region` tool | meta sessions only | apply an elision to the target file directly |
| `meta-elided` renderer | every session | collapsed banner / expanded greyed verbatim |

### How an elision happens

1. `/meta` opens a child session (linked via pi's native `parentSession`).
2. You and the meta-agent read the target's `.jsonl` and agree on a run to elide.
3. The agent calls the `elide_region` tool with the first/last message entry
   `id` and a synopsis. **The tool opens the target file via the SDK
   `SessionManager`, branches from the entry before the run, appends one
   `meta-elided` entry (synopsis as content, verbatim in `details`), and
   re-appends the survivors — written through to disk immediately.**
4. `/back` returns to the target, which re-reads fresh from disk and now shows
   the collapsed elision. `/back` does nothing but navigate — the elision was
   already applied at tool-call time.

Because the tool re-opens the target fresh on every call, repeated elisions
always resolve against current on-disk state. If you elide and never `/back`,
the elision is still applied; it simply appears next time the target is opened.

### What the model sees vs. what's on disk

- **Model:** the elided run is replaced by the synopsis (`meta-elided` entry's
  `content`). The verbatim lives in `details` and never reaches the model — no
  context filtering needed; it's structurally absent.
- **Disk:** append-only. The originals stay on a sibling branch; the new branch
  is `... anchor → meta-elided → survivors`. Nothing is deleted or rewritten.
- **TUI:** collapsed by default (one banner); the global expand hotkey reveals
  every elided region's verbatim, greyed but readable.

### Rendering

- Collapsed, 1 message:   `⌁ [1 message elided] <synopsis>`
- Collapsed, N messages:  `⌁ [N messages elided ▼] <synopsis>`
- Expanded: banner with `▲`, then each elided message dimmed, then
  `⌁ [end of N elided ▲]`.

## Tool scoping

`elide_region` is registered globally but **activated only in meta sessions**.
On every `session_start`, the extension recomputes the active tool set: it adds
the tool in a meta session (identified by its `meta:` name prefix, not by having
a parent — a normal fork has a parent too) and **strips it everywhere else**.
This is authoritative on every entry path (startup/new/resume/fork/reload), so
the tool can never leak into a non-meta session via active-tool carry-forward.

## Links (no sidecar, no files)

- **meta → target:** the meta session's `parentSession` header.
- **target → meta:** `SessionManager.list(cwd)` matched by `parentSessionPath`
  + the `meta:` name marker.

pi-meta writes **no files of its own** — elisions are entries inside the
target's existing `.jsonl`; links are pi-native session metadata.

## Install

**Folder drop:** copy `pi-meta/` into `~/.pi/agent/extensions/`. Discovered via
the `pi.extensions` manifest in `package.json`.

**npm:** publish, then add `"npm:pi-meta"` to `settings.json` `packages`.

No runtime dependencies beyond pi itself (`typebox` and `@earendil-works/pi-tui`
are provided by the host).

## Files

```
pi-meta/
  package.json        # pi.extensions manifest
  src/
    index.ts          # /meta, /back, elide_region tool, renderer + session_start guard
    ops.ts            # applyElision (branch+transmute) + openAndElide (opens target via SDK)
    render.ts         # meta-elided renderer
    meta-session.ts   # native linking, meta-session identity, seed prompt
  README.md
```
