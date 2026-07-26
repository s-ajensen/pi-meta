export interface PairMessage {
	toolCallId?: string;
	content: unknown;
}

export interface PairEntry {
	message?: PairMessage;
}

function callIdsIn(message: PairMessage | undefined): string[] {
	if (!Array.isArray(message?.content)) return [];
	return message.content
		.filter((block): block is { type: string; id: string } => {
			return !!block && typeof block === "object" && (block as { type?: string }).type === "toolCall";
		})
		.map((block) => block.id);
}

export function rejectSeveredToolPairs<E extends PairEntry>(
	messages: E[],
	groupOf: (index: number) => number | undefined,
	describe: (callId: string) => string,
): void {
	const callGroup = new Map<string, number | undefined>();
	messages.forEach((entry, idx) => {
		for (const callId of callIdsIn(entry.message)) {
			callGroup.set(callId, groupOf(idx));
		}
	});

	messages.forEach((entry, idx) => {
		const answeredCallId = entry.message?.toolCallId;
		if (!answeredCallId || !callGroup.has(answeredCallId)) return;
		if (callGroup.get(answeredCallId) !== groupOf(idx)) {
			throw new Error(describe(answeredCallId));
		}
	});
}
