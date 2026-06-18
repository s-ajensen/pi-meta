/**
 * The meta sidecar: a single JSON file living next to a target session's .jsonl,
 * named `<target>.jsonl.meta.json`.
 *
 * It holds two things:
 *  - `metaSession`: absolute path to the linked child "meta" session (the
 *    conversation-about-the-conversation). This is the target -> meta link.
 *  - `ops`: an ordered list of view-rewrite operations the meta-agent has agreed
 *    on. The target session's `context` handler applies these to its in-flight
 *    message array on every LLM call. The .jsonl on disk is NEVER touched.
 *
 * The op list is a forward-compatible discriminated union. v1 implements exactly
 * one verb, `elide`. Future verbs (`replace`, `inject`, ...) slot in here and in
 * ops.ts without changing the link/switch machinery. Unknown ops are ignored by
 * older builds rather than crashing (see ops.ts).
 */

import * as fs from "node:fs";

/** Drop every message whose message.timestamp is within [from, to] (inclusive),
 *  splicing a single ephemeral synopsis line in at that point. Matching is by the
 *  timestamp VALUE carried on each message, not by array index, so it is robust to
 *  reordering by other context handlers. Within-millisecond collisions are always
 *  contiguous bursts, so a window treats them as a unit (verified behavior). */
export interface ElideOp {
	op: "elide";
	from: number;
	to: number;
	synopsis: string;
}

/** The forward-compatible op union. Only ElideOp is implemented in v1. */
export type MetaOp = ElideOp;

export interface MetaSidecar {
	/** Absolute path to the linked child meta session, if one exists yet. */
	metaSession?: string;
	/** Ordered view-rewrite operations applied to the TARGET session's view. */
	ops?: MetaOp[];
}

/** Derive the sidecar path for a given session .jsonl path. */
export function sidecarPathFor(sessionFile: string): string {
	return `${sessionFile}.meta.json`;
}

/** Read and parse the sidecar. Returns an empty object if absent or unparseable —
 *  a corrupt sidecar must never break the host session, only disable meta features. */
export function readSidecar(sessionFile: string): MetaSidecar {
	const p = sidecarPathFor(sessionFile);
	try {
		if (!fs.existsSync(p)) return {};
		const raw = fs.readFileSync(p, "utf-8");
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return {};
		return parsed as MetaSidecar;
	} catch {
		return {};
	}
}

/** Merge a partial patch into the sidecar and write it back atomically-ish.
 *  Used only for the small fields the EXTENSION owns (currently `metaSession`).
 *  The `ops` array is authored by the meta-agent with its own `write` tool. */
export function patchSidecar(sessionFile: string, patch: Partial<MetaSidecar>): void {
	const current = readSidecar(sessionFile);
	const next: MetaSidecar = { ...current, ...patch };
	const p = sidecarPathFor(sessionFile);
	const tmp = `${p}.tmp`;
	fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
	fs.renameSync(tmp, p);
}
