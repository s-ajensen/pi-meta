export interface BranchReplaySession {
	branch(branchFromId: string): void;
	resetLeaf(): void;
}

export function branchAndReplay<TStep>(
	session: BranchReplaySession,
	branchPointId: string | undefined,
	tail: TStep[],
	replayStep: (step: TStep) => void,
): void {
	if (branchPointId) session.branch(branchPointId);
	else session.resetLeaf();
	for (const step of tail) {
		replayStep(step);
	}
}
