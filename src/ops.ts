import { SessionManager } from "@earendil-works/pi-coding-agent";
import { planElisions, type BranchMessage, type ElideRegion, type PlanStep } from "./plan.ts";
import { resolveMetaTarget } from "./meta-session.ts";
import { okResult, errorResult, type ToolResult } from "./tool-result.ts";
import { branchAndReplay } from "./branch-replay.ts";
import { createRemapRecorder, type RemapRecorder } from "./remap.ts";

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

export interface SessionLike {
	getBranch(fromId?: string): BranchMessage[];
	getLeafId(): string | null;
	branch(branchFromId: string): void;
	resetLeaf(): void;
	appendCustomMessageEntry(
		customType: string,
		content: string | unknown[],
		display: boolean,
		details?: unknown,
	): string;
	appendCustomEntry(customType: string, data?: unknown): string;
	appendMessage(message: unknown): string;
}

function toElidedDetails(elided: BranchMessage[]): ElidedDetails {
	return {
		op: "elided",
		count: elided.length,
		verbatim: elided.map((entry) => ({
			role: entry.message?.role ?? "unknown",
			content: entry.message?.content ?? null,
		})),
	};
}

function executeStep(session: SessionLike, step: PlanStep, remap: RemapRecorder): void {
	if (step.kind === "elide") {
		session.appendCustomMessageEntry(ELIDED_TYPE, step.synopsis, true, toElidedDetails(step.elided));
	} else {
		remap.record(step.message.id, session.appendMessage(step.message.message));
	}
}

export function applyElisions(session: SessionLike, regions: ElideRegion[]): void {
	const branch = session.getBranch(session.getLeafId() ?? undefined);
	const plan = planElisions(branch, regions);
	const remap = createRemapRecorder(session);
	branchAndReplay(session, plan.branchPointId, plan.tail, (step) => executeStep(session, step, remap));
	remap.flush();
}

export function elideRegions(targetPath: string, regions: ElideRegion[]): string {
	const target = SessionManager.open(targetPath) as unknown as SessionLike;
	applyElisions(target, regions);
	const count = regions.length;
	return `Elided ${count} ${count === 1 ? "region" : "regions"} in target. Verbatim preserved on the prior branch.`;
}

interface ElideToolContext {
	sessionManager: { getHeader?: () => { parentSession?: string } | null };
}

export function runElideTool(params: { regions: ElideRegion[] }, ctx: ElideToolContext): ToolResult {
	const target = resolveMetaTarget(ctx.sessionManager);
	if (!target) {
		return errorResult("elide_regions must be called from a meta session (no parent/target found).");
	}
	try {
		return okResult(elideRegions(target, params.regions));
	} catch (err) {
		return errorResult(err instanceof Error ? err.message : String(err));
	}
}
