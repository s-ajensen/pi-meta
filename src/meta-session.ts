import { SessionManager } from "@earendil-works/pi-coding-agent";

export const META_NAME_PREFIX = "meta: ";

interface SessionManagerView {
	getSessionName?: () => string | undefined;
	getHeader?: () => { parentSession?: string } | null;
}

export function buildMetaSessionName(targetSessionFile: string): string {
	return `${META_NAME_PREFIX}${extractBaseName(targetSessionFile)}`;
}

export function isMetaSession(session: SessionManagerView): boolean {
	const name = session.getSessionName?.();
	return typeof name === "string" && name.startsWith(META_NAME_PREFIX);
}

export function resolveMetaTarget(session: SessionManagerView): string | undefined {
	return session.getHeader?.()?.parentSession;
}

function stripTrailingSlash(path?: string): string | undefined {
	return path ? path.replace(/\/+$/, "") : path;
}

export async function findMetaChild(cwd: string, targetSessionFile: string): Promise<string | undefined> {
	let sessions;
	try {
		sessions = await SessionManager.list(cwd);
	} catch {
		return undefined;
	}
	const target = stripTrailingSlash(targetSessionFile);
	const isMetaChildOfTarget = (candidate: { parentSessionPath?: string; name?: string }) =>
		stripTrailingSlash(candidate.parentSessionPath) === target &&
		typeof candidate.name === "string" &&
		candidate.name.startsWith(META_NAME_PREFIX);
	return sessions.find(isMetaChildOfTarget)?.path;
}

export function buildSeedPrompt(targetSession: string, task: string): string {
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

function extractBaseName(path: string): string {
	const segments = path.split("/");
	return segments[segments.length - 1] ?? path;
}
