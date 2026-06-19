import { SessionManager } from "@earendil-works/pi-coding-agent";

export const ELIDED_TYPE = "meta-elided";

export interface ElidedMessage {
	role: string;
	content: unknown;
}

export interface ElidedDetails {
	op: "elided";
	count: number;
	verbatim: ElidedMessage[];
}

interface MessageEntry {
	id: string;
	type: string;
	message?: { role: string; content: unknown };
}

export interface SessionLike {
	getEntries(): MessageEntry[];
	getBranch(fromId?: string): MessageEntry[];
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
	fromId: string;
	toId: string;
	synopsis: string;
}

interface ResolvedRegion {
	branchPointId: string | undefined;
	elided: MessageEntry[];
	survivors: MessageEntry[];
}

function resolveRegion(session: SessionLike, region: ElideRegion): ResolvedRegion {
	const entries = session.getBranch(session.getLeafId() ?? undefined);
	const messages = entries.filter((e) => e.type === "message");
	const fromIdx = messages.findIndex((e) => e.id === region.fromId);
	const toIdx = messages.findIndex((e) => e.id === region.toId);

	if (fromIdx === -1 || toIdx === -1) {
		throw new Error(`could not resolve elide region [${region.fromId}..${region.toId}]`);
	}
	if (toIdx < fromIdx) {
		throw new Error("elide region toId precedes fromId");
	}

	return {
		branchPointId: findBranchPointBefore(entries, messages, fromIdx),
		elided: messages.slice(fromIdx, toIdx + 1),
		survivors: messages.slice(toIdx + 1),
	};
}

function findBranchPointBefore(entries: MessageEntry[], messages: MessageEntry[], fromIdx: number): string | undefined {
	if (fromIdx > 0) return messages[fromIdx - 1].id;
	const firstMessageIdx = entries.findIndex((e) => e.id === messages[fromIdx].id);
	return firstMessageIdx > 0 ? entries[firstMessageIdx - 1].id : undefined;
}

function buildElidedDetails(elided: MessageEntry[]): ElidedDetails {
	return {
		op: "elided",
		count: elided.length,
		verbatim: elided.map((e) => ({
			role: e.message?.role ?? "unknown",
			content: e.message?.content ?? null,
		})),
	};
}

export function applyElision(session: SessionLike, region: ElideRegion): string {
	const { branchPointId, elided, survivors } = resolveRegion(session, region);

	if (branchPointId) session.branch(branchPointId);

	const elidedId = session.appendCustomMessageEntry(ELIDED_TYPE, region.synopsis, true, buildElidedDetails(elided));
	for (const survivor of survivors) {
		session.appendMessage(survivor.message);
	}
	return elidedId;
}

export function openAndElide(targetPath: string, region: ElideRegion): string {
	const target = SessionManager.open(targetPath) as unknown as SessionLike;
	applyElision(target, region);
	return `Elided region [${region.fromId}..${region.toId}] in target. Verbatim preserved on the prior branch.`;
}
