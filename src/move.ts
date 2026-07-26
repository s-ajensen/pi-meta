import type { BranchMessage } from "./plan.ts";
import { rejectSeveredToolPairs } from "./tool-pairs.ts";

export interface MoveRegion {
	from: string;
	to: string;
	after: string;
}

export interface MoveStep {
	message: BranchMessage;
}

export interface MovePlan {
	branchPointId: string | undefined;
	tail: MoveStep[];
}

interface ResolvedMove {
	fromIdx: number;
	toIdx: number;
	afterIdx: number;
}

function resolveMove(messages: BranchMessage[], region: MoveRegion): ResolvedMove {
	const fromIdx = messages.findIndex((entry) => entry.id === region.from);
	const toIdx = messages.findIndex((entry) => entry.id === region.to);
	const afterIdx = messages.findIndex((entry) => entry.id === region.after);
	if (fromIdx === -1 || toIdx === -1 || afterIdx === -1) {
		throw new Error(`could not resolve move region [${region.from}..${region.to} after ${region.after}]`);
	}
	if (toIdx < fromIdx) {
		throw new Error(`move region toId precedes fromId [${region.from}..${region.to}]`);
	}
	if (afterIdx >= fromIdx && afterIdx <= toIdx) {
		throw new Error(`move destination is inside the moved run [after ${region.after}]`);
	}
	if (afterIdx === fromIdx - 1) {
		throw new Error(`move destination is immediately before the run (no-op)`);
	}
	return { fromIdx, toIdx, afterIdx };
}

function groupForMove(idx: number, resolved: ResolvedMove): number | undefined {
	return idx >= resolved.fromIdx && idx <= resolved.toIdx ? resolved.fromIdx : undefined;
}

function reorderTail(messages: BranchMessage[], resolved: ResolvedMove): BranchMessage[] {
	const run = messages.slice(resolved.fromIdx, resolved.toIdx + 1);
	const rest = messages.filter((_, idx) => idx < resolved.fromIdx || idx > resolved.toIdx);
	const afterId = messages[resolved.afterIdx].id;
	const insertAt = rest.findIndex((entry) => entry.id === afterId) + 1;
	return [...rest.slice(0, insertAt), ...run, ...rest.slice(insertAt)];
}

export function planMove(branch: BranchMessage[], region: MoveRegion): MovePlan {
	const messages = branch.filter((entry) => entry.type === "message");
	const resolved = resolveMove(messages, region);
	rejectSeveredToolPairs(
		messages,
		(idx) => groupForMove(idx, resolved),
		(callId) => `move boundary severs a tool call from its result (${callId}); widen the run to include both`,
	);

	const earliestTouched = Math.min(resolved.fromIdx, resolved.afterIdx + 1);
	const branchPointId = earliestTouched > 0 ? messages[earliestTouched - 1].id : undefined;
	const reordered = reorderTail(messages, resolved);
	return { branchPointId, tail: reordered.slice(earliestTouched).map((message) => ({ message })) };
}
