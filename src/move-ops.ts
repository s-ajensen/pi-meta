import { SessionManager } from "@earendil-works/pi-coding-agent";
import { planMove, type MoveRegion, type MoveStep } from "./move.ts";
import type { BranchMessage } from "./plan.ts";
import { resolveMetaTarget } from "./meta-session.ts";
import { okResult, errorResult, type ToolResult } from "./tool-result.ts";
import { branchAndReplay } from "./branch-replay.ts";
import { createRemapRecorder } from "./remap.ts";

export const MOVED_TYPE = "meta-moved";

export interface MoveSessionLike {
	getBranch(fromId?: string): BranchMessage[];
	getLeafId(): string | null;
	branch(branchFromId: string): void;
	resetLeaf(): void;
	appendCustomEntry(customType: string, data?: unknown): string;
	appendMessage(message: unknown): string;
}

function recordProvenance(session: MoveSessionLike, region: MoveRegion): void {
	session.appendCustomEntry(MOVED_TYPE, { op: "move", ...region });
}

export function applyMove(session: MoveSessionLike, region: MoveRegion): void {
	const branch = session.getBranch(session.getLeafId() ?? undefined);
	const plan = planMove(branch, region);
	const remap = createRemapRecorder(session);
	branchAndReplay(session, plan.branchPointId, plan.tail, (step: MoveStep) =>
		remap.record(step.message.id, session.appendMessage(step.message.message)),
	);
	remap.flush();
	recordProvenance(session, region);
}

export function moveRegion(targetPath: string, region: MoveRegion): string {
	const target = SessionManager.open(targetPath) as unknown as MoveSessionLike;
	applyMove(target, region);
	return `Moved run [${region.from}..${region.to}] after ${region.after} in target.`;
}

interface MoveToolContext {
	sessionManager: { getHeader?: () => { parentSession?: string } | null };
}

export function runMoveTool(region: MoveRegion, ctx: MoveToolContext): ToolResult {
	const target = resolveMetaTarget(ctx.sessionManager);
	if (!target) {
		return errorResult("move_region must be called from a meta session (no parent/target found).");
	}
	try {
		return okResult(moveRegion(target, region));
	} catch (err) {
		return errorResult(err instanceof Error ? err.message : String(err));
	}
}
