/**
 * Elision as a tree operation.
 *
 * An elision collapses a contiguous run of message entries into ONE
 * `meta-elided` custom_message entry, performed on a new branch:
 *
 *   ... anchor ─┬─ [original m1 m2 ... mN]            (sibling branch: verbatim, untouched)
 *               └─ meta-elided(content=synopsis,      (active branch: what we render & send)
 *                              details={verbatim:[...]}) ─ survivors...
 *
 * Why ONE entry per region (not one per message): pi's CustomMessageComponent
 * adds an unconditional Spacer(1) per custom entry, so N entries => N blank lines
 * even when the renderer draws nothing. Collapsing the region into a single entry
 * gives a clean one-line banner when collapsed.
 *
 * What reaches the LLM: only `content` (the synopsis). `convertToLlm` maps a
 * custom message to a user message using `content` and ignores `details`. So the
 * verbatim, stored in `details.verbatim`, is structurally absent from the model
 * view — no context() filter required. (`details.verbatim` is also the seam a
 * future one-off "reinject this section" would expand from, in context(), without
 * touching the tree. Not implemented yet — kept deliberately as data, not entries.)
 *
 * History is never destroyed: the originals persist on the sibling branch, and
 * the full verbatim is mirrored in `details`.
 */

import { SessionManager } from "@earendil-works/pi-coding-agent";

export const ELIDED_TYPE = "meta-elided";

/** A single elided message, preserved verbatim for the TUI (expanded view) and
 *  for potential future reinjection. role + content mirror the original Message. */
export interface ElidedMessage {
	role: string;
	content: unknown;
}

/** Payload stored in the `meta-elided` custom_message's `details`. TUI-only. */
export interface ElidedDetails {
	op: "elided";
	/** Number of original messages collapsed into this entry. */
	count: number;
	/** The original messages, in order. Rendered (greyed) when expanded. */
	verbatim: ElidedMessage[];
}

/** Minimal shape of a pi session manager we depend on (subset, for typing). */
export interface SessionLike {
	getEntries(): Array<{ id: string; type: string; message?: { role: string; content: unknown } }>;
	getLeafId(): string | null;
	branch(branchFromId: string): void;
	appendCustomMessageEntry(
		customType: string,
		content: string | unknown[],
		display: boolean,
		details?: unknown,
	): string;
	appendMessage(message: unknown): string;
}

export interface ElideRegion {
	/** Entry id of the first message to elide (inclusive). */
	fromId: string;
	/** Entry id of the last message to elide (inclusive). */
	toId: string;
	/** One-paragraph synopsis — this is what the LLM sees in place of the run. */
	synopsis: string;
}

/**
 * Apply one elision to the session tree by branching.
 *
 * Resolves [fromId, toId] to a contiguous run of message entries on the current
 * branch, branches from the entry just before `fromId`, appends a single
 * `meta-elided` entry (synopsis as content, verbatim in details), then re-appends
 * every message after `toId`. Returns the new `meta-elided` entry id.
 *
 * Throws if the region can't be resolved (caller surfaces this to the user);
 * the tree is only mutated via append/branch, so a throw before branching leaves
 * the session untouched.
 */
export function applyElision(session: SessionLike, region: ElideRegion): string {
	const entries = session.getEntries();
	const messageEntries = entries.filter((e) => e.type === "message");

	const fromIdx = messageEntries.findIndex((e) => e.id === region.fromId);
	const toIdx = messageEntries.findIndex((e) => e.id === region.toId);
	if (fromIdx === -1 || toIdx === -1) {
		throw new Error(`pi-meta: could not resolve elide region [${region.fromId}..${region.toId}]`);
	}
	if (toIdx < fromIdx) {
		throw new Error("pi-meta: elide region toId precedes fromId");
	}

	const anchor = fromIdx > 0 ? messageEntries[fromIdx - 1] : undefined;
	const regionEntries = messageEntries.slice(fromIdx, toIdx + 1);
	const survivors = messageEntries.slice(toIdx + 1);

	const verbatim: ElidedMessage[] = regionEntries.map((e) => ({
		role: e.message?.role ?? "unknown",
		content: e.message?.content ?? null,
	}));
	const details: ElidedDetails = { op: "elided", count: regionEntries.length, verbatim };

	// Branch from the anchor (or to before-first if eliding from the very start).
	if (anchor) {
		session.branch(anchor.id);
	} else {
		// Eliding from the first message: branch from the entry just before it in
		// the full entry list if any (e.g. model/thinking change), else leave leaf.
		const firstMsgEntry = regionEntries[0];
		const fullIdx = entries.findIndex((e) => e.id === firstMsgEntry.id);
		if (fullIdx > 0) session.branch(entries[fullIdx - 1].id);
	}

	const elidedId = session.appendCustomMessageEntry(ELIDED_TYPE, region.synopsis, true, details);
	for (const s of survivors) {
		session.appendMessage(s.message);
	}
	return elidedId;
}

/**
 * Open the target session file directly (SDK SessionManager), apply one elision,
 * and write it through to disk. This is what the meta-scoped tool calls: the
 * mutation lands on the target file at tool-call time — no payload travels, and
 * /back is left as pure navigation. Re-opens fresh every call, so repeated
 * elisions always resolve against the current on-disk state.
 *
 * Returns a human-readable result string. Throws on unresolved/invalid region
 * BEFORE any mutation (applyElision resolves before it branches).
 */
export function openAndElide(targetPath: string, region: ElideRegion): string {
	const target = SessionManager.open(targetPath) as unknown as SessionLike;
	applyElision(target, region);
	return `Elided region [${region.fromId}..${region.toId}] in target. Verbatim preserved on the prior branch.`;
}
