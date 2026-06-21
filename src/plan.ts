export interface BranchMessage {
	id: string;
	type: string;
	message?: { role: string; content: unknown };
}

export interface ElideRegion {
	fromId: string;
	toId: string;
	synopsis: string;
}

export type PlanStep =
	| { kind: "elide"; synopsis: string; elided: BranchMessage[] }
	| { kind: "keep"; message: BranchMessage };

export interface ElisionPlan {
	branchPointId: string | undefined;
	tail: PlanStep[];
}

interface ResolvedRegion {
	fromIdx: number;
	toIdx: number;
	synopsis: string;
}

function resolveRegion(messages: BranchMessage[], region: ElideRegion): ResolvedRegion {
	const synopsis = region.synopsis.trim();
	if (!synopsis) {
		throw new Error(`elide region [${region.fromId}..${region.toId}] needs a non-empty synopsis`);
	}
	const fromIdx = messages.findIndex((entry) => entry.id === region.fromId);
	const toIdx = messages.findIndex((entry) => entry.id === region.toId);
	if (fromIdx === -1 || toIdx === -1) {
		throw new Error(`could not resolve elide region [${region.fromId}..${region.toId}]`);
	}
	if (toIdx < fromIdx) {
		throw new Error(`elide region toId precedes fromId [${region.fromId}..${region.toId}]`);
	}
	return { fromIdx, toIdx, synopsis };
}

function orderByPosition(regions: ResolvedRegion[]): ResolvedRegion[] {
	return [...regions].sort((a, b) => a.fromIdx - b.fromIdx);
}

function rejectOverlaps(ordered: ResolvedRegion[]): void {
	for (let i = 1; i < ordered.length; i++) {
		if (ordered[i].fromIdx <= ordered[i - 1].toIdx) {
			throw new Error("elide regions overlap");
		}
	}
}

function resolveRegions(messages: BranchMessage[], regions: ElideRegion[]): ResolvedRegion[] {
	const ordered = orderByPosition(regions.map((region) => resolveRegion(messages, region)));
	rejectOverlaps(ordered);
	return ordered;
}

function findBranchPointId(messages: BranchMessage[], firstFromIdx: number): string | undefined {
	return firstFromIdx > 0 ? messages[firstFromIdx - 1].id : undefined;
}

export function planElisions(branch: BranchMessage[], regions: ElideRegion[]): ElisionPlan {
	if (regions.length === 0) {
		throw new Error("no regions to elide");
	}
	const messages = branch.filter((entry) => entry.type === "message");
	const resolved = resolveRegions(messages, regions);

	const regionByStart = new Map(resolved.map((region) => [region.fromIdx, region]));
	const tail: PlanStep[] = [];
	let index = resolved[0].fromIdx;
	while (index < messages.length) {
		const region = regionByStart.get(index);
		if (region) {
			tail.push({ kind: "elide", synopsis: region.synopsis, elided: messages.slice(region.fromIdx, region.toIdx + 1) });
			index = region.toIdx + 1;
		} else {
			tail.push({ kind: "keep", message: messages[index] });
			index += 1;
		}
	}

	return { branchPointId: findBranchPointId(messages, resolved[0].fromIdx), tail };
}
