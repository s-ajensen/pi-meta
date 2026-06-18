/**
 * Op appliers: pure transforms over the in-flight message array.
 *
 * Each applier takes the current messages and one op, and returns a new array.
 * They run inside the `context` event, on a clone pi already made, so they must
 * be pure and never touch disk. The dispatcher skips unknown ops so that a spec
 * authored against a newer build (e.g. containing a future `replace`/`inject`)
 * degrades gracefully on an older one instead of throwing.
 */

import type { MetaOp, ElideOp } from "./sidecar.ts";

/** A minimal structural view of a pi context message. We only rely on the
 *  `timestamp` carried by every Message (UserMessage/AssistantMessage/
 *  ToolResultMessage all have it). `role`/`content` are passed through untouched. */
interface CtxMessage {
	role?: string;
	content?: unknown;
	timestamp?: number;
	[k: string]: unknown;
}

/** Build the single ephemeral message that stands in for an elided region.
 *  Rendered as a plain user message so it is unmistakable and model-legible.
 *  It exists only in the view; it is never persisted. */
function synopsisMessage(count: number, synopsis: string, timestamp: number): CtxMessage {
	return {
		role: "user",
		content: [
			{
				type: "text",
				text:
					`[meta · ${count} message${count === 1 ? "" : "s"} elided] ${synopsis}\n` +
					`(verbatim preserved on disk; elided from this view only)`,
			},
		],
		timestamp,
	};
}

/** Apply one elide op: drop every message whose timestamp is within [from, to],
 *  and splice the synopsis in where the first dropped message was. If nothing
 *  matches (e.g. the region was already navigated away), the array is unchanged. */
function applyElide(messages: CtxMessage[], op: ElideOp): CtxMessage[] {
	const lo = Math.min(op.from, op.to);
	const hi = Math.max(op.from, op.to);
	const inWindow = (m: CtxMessage) =>
		typeof m.timestamp === "number" && m.timestamp >= lo && m.timestamp <= hi;

	const matched = messages.filter(inWindow).length;
	if (matched === 0) return messages;

	const out: CtxMessage[] = [];
	let spliced = false;
	for (const m of messages) {
		if (inWindow(m)) {
			if (!spliced) {
				out.push(synopsisMessage(matched, op.synopsis, lo));
				spliced = true;
			}
			continue; // drop the original from the view
		}
		out.push(m);
	}
	return out;
}

/** Dispatch all ops in order. Unknown op types are ignored (forward-compat). */
export function applyOps(messages: CtxMessage[], ops: MetaOp[] | undefined): CtxMessage[] {
	if (!ops || ops.length === 0) return messages;
	let current = messages as CtxMessage[];
	for (const op of ops) {
		switch (op.op) {
			case "elide":
				current = applyElide(current, op);
				break;
			default:
				// Unknown verb from a newer spec: skip rather than crash.
				break;
		}
	}
	return current;
}
