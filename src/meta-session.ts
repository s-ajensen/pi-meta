/**
 * Meta-session identity & linking — all native, no sidecar.
 *
 * Links are carried by pi itself:
 *   - meta -> target : the meta session's header `parentSession` (set when we
 *     create it with newSession({ parentSession })).
 *   - target -> meta : found by scanning SessionManager.list(cwd) for a session
 *     whose `parentSessionPath` is the target AND whose name carries our marker.
 *
 * A meta session is identified by a POSITIVE marker (its session name prefix),
 * never by `parentSession` alone — a normal fork also has a parent, and we must
 * not arm the elide tool in a fork.
 */

import { SessionManager } from "@earendil-works/pi-coding-agent";

/** Name prefix that marks a session as a pi-meta meta session. */
export const META_NAME_PREFIX = "meta: ";

/** Build the display name for the meta session of a given target. */
export function metaSessionName(targetSessionFile: string): string {
	return `${META_NAME_PREFIX}${baseName(targetSessionFile)}`;
}

/** Is the CURRENT session (via its manager) a pi-meta meta session?
 *  Positive check: the session name starts with our marker. Robust against forks. */
export function isMetaSession(sm: {
	getSessionName?: () => string | undefined;
	getHeader?: () => { parentSession?: string } | null;
}): boolean {
	const name = sm.getSessionName?.();
	return typeof name === "string" && name.startsWith(META_NAME_PREFIX);
}

/** The target this meta session belongs to (its parent), or undefined. */
export function targetOfMeta(sm: { getHeader?: () => { parentSession?: string } | null }): string | undefined {
	return sm.getHeader?.()?.parentSession;
}

/** Find an existing meta child of `targetSessionFile` for this cwd, if any.
 *  Returns the meta session's file path, or undefined. */
export async function findMetaChild(cwd: string, targetSessionFile: string): Promise<string | undefined> {
	let sessions;
	try {
		sessions = await SessionManager.list(cwd);
	} catch {
		return undefined;
	}
	const canon = (p?: string) => (p ? p.replace(/\/+$/, "") : p);
	const target = canon(targetSessionFile);
	for (const s of sessions) {
		if (canon(s.parentSessionPath) === target && typeof s.name === "string" && s.name.startsWith(META_NAME_PREFIX)) {
			return s.path;
		}
	}
	return undefined;
}

/** Seed prompt planted into a freshly-created meta session. */
export function seedPrompt(targetSession: string, task: string): string {
	return [
		`You are the META thread for another pi session (the "target").`,
		``,
		`Target session log (read-only to you): ${targetSession}`,
		``,
		`Your job: help the human decide what to ELIDE from the target — to collapse`,
		`spent runs of messages into a short synopsis. Eliding is non-destructive: it`,
		`branches the session tree (append-only), so the verbatim messages are`,
		`preserved and the on-disk record is never overwritten. On resume, the target's`,
		`model sees the synopsis in place of the run; the human sees a collapsed banner`,
		`that expands to the greyed verbatim.`,
		``,
		`How to work:`,
		`1. Read the target .jsonl with your file tools. Each line is an entry`,
		`   { id, parentId, timestamp, type, message }. The turns are type:"message"`,
		`   entries; each has a stable "id".`,
		`2. Discuss candidate regions with the human. Be specific about what stays and`,
		`   goes. Confirm before acting.`,
		`3. To elide a contiguous run, call the elide_region tool with the FIRST and`,
		`   LAST message entry "id" of the run and a one-paragraph synopsis. The tool`,
		`   applies the elision directly to the target file; you do NOT edit the .jsonl`,
		`   yourself. The human returns to the target with /back (pure navigation — the`,
		`   elision is already applied).`,
		``,
		`Synopsis formatting: the synopsis renders as MARKDOWN in the collapsed banner,`,
		`so make it scannable, not a wall of text. Prefer a one-line bold gist followed`,
		`by a short bullet list of the key points/decisions — a few bullets, not`,
		`paragraphs. Example:`,
		`   **Reworked elision to a branch-based model.**`,
		`   - tool opens the target via the SDK and writes through directly`,
		`   - /back is pure navigation; no payload travels`,
		`   - verbatim preserved on the sibling branch`,
		``,
		`The human's opening request: ${task || "(none — ask what they want to elide.)"}`,
	].join("\n");
}

function baseName(p: string): string {
	const parts = p.split("/");
	return parts[parts.length - 1] ?? p;
}
