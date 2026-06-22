import { SessionManager } from "@earendil-works/pi-coding-agent";
import { capabilities, renderMetaSkills } from "./capabilities.ts";

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
	const hasMarker = typeof name === "string" && name.startsWith(META_NAME_PREFIX);
	return hasMarker && resolveMetaTarget(session) !== undefined;
}

export function resolveMetaTarget(session: SessionManagerView): string | undefined {
	return session.getHeader?.()?.parentSession;
}

export interface SessionCandidate {
	path: string;
	parentSessionPath?: string;
	name?: string;
}

function stripTrailingSlash(path?: string): string | undefined {
	return path ? path.replace(/\/+$/, "") : path;
}

export function selectMetaChild(candidates: SessionCandidate[], targetSessionFile: string): string | undefined {
	const target = stripTrailingSlash(targetSessionFile);
	const isMetaChildOfTarget = (candidate: SessionCandidate) =>
		stripTrailingSlash(candidate.parentSessionPath) === target &&
		typeof candidate.name === "string" &&
		candidate.name.startsWith(META_NAME_PREFIX);
	return candidates.find(isMetaChildOfTarget)?.path;
}

export async function findMetaChild(cwd: string, targetSessionFile: string): Promise<string | undefined> {
	try {
		return selectMetaChild(await SessionManager.list(cwd), targetSessionFile);
	} catch {
		return undefined;
	}
}

export function buildSeedPrompt(targetSession: string): string {
	const lines = [
		`You are a META thread paired with another pi session (the "target").`,
		``,
		`Target session log (read-only to you): ${targetSession}`,
		``,
		`Your purpose: reason about the target conversation on the human's behalf, in a`,
		`separate thread, so the target agent's context stays clean. You think about the`,
		`conversation; you never pollute it.`,
		``,
		`The target is a JSONL session log — each line is an entry`,
		`{ id, parentId, timestamp, type, message }. Read it with your file tools to`,
		`ground whatever the human asks.`,
		``,
		`Time may pass between the human's turns, and the target keeps growing as they`,
		`work in it — so re-orient to its current state before reasoning about it; don't`,
		`trust a stale read. Read surgically: narrow to the relevant span (by time,`,
		`region, or role) and read that span in full. Surgical means narrowing what you`,
		`read, not simply truncating it — a partial read of the relevant stretch (the`,
		`first 80 lines of a 2000-line conversation you were asked to discuss) is the`,
		`failure to avoid. Claims about the target must trace to spans you actually read.`,
		``,
		`People use this channel for many things — for example:`,
		`  - mine the conversation for insights or notable moments`,
		`  - surface improvements to the pi harness from what happened in the target`,
		`  - extract a principle, decision, or artifact worth preserving`,
		`  - collapse spent stretches of the target into summaries to declutter it`,
		`...among much else. Wait for the human to tell you what they want to explore.`,
		``,
		`When the work is done, the human returns to the target with /back.`,
	];
	const skills = renderMetaSkills(capabilities);
	return skills ? `${lines.join("\n")}\n\n${skills}` : lines.join("\n");
}

function extractBaseName(path: string): string {
	const segments = path.split("/");
	return segments[segments.length - 1] ?? path;
}
