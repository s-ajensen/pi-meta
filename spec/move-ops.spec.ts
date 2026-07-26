import { test, expect } from "bun:test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { applyMove, runMoveTool, MOVED_TYPE } from "../src/move-ops.ts";
import type { MoveSessionLike } from "../src/move-ops.ts";

function buildSession(messageCount: number): SessionManager {
	const manager = SessionManager.inMemory();
	for (let i = 0; i < messageCount; i++) {
		manager.appendMessage({ role: "user", content: [{ type: "text", text: `m${i}` }], timestamp: Date.now() });
	}
	return manager;
}

function activeBranch(manager: SessionManager) {
	return manager.getBranch(manager.getLeafId() ?? undefined);
}

function activeMessageTexts(manager: SessionManager) {
	return activeBranch(manager)
		.filter((entry) => entry.type === "message")
		.map((entry) => {
			const content = (entry as { message?: { content?: unknown } }).message?.content;
			return Array.isArray(content) ? (content[0] as { text?: string }).text : content;
		});
}

test("moving a run to the tail reorders the active branch", () => {
	const manager = buildSession(5);
	const messages = activeBranch(manager).filter((entry) => entry.type === "message");

	applyMove(manager as unknown as MoveSessionLike, { from: messages[1].id, to: messages[1].id, after: messages[3].id });

	expect(activeMessageTexts(manager)).toEqual(["m0", "m2", "m3", "m1", "m4"]);
});

test("a move records a meta-moved provenance entry on the active branch", () => {
	const manager = buildSession(5);
	const messages = activeBranch(manager).filter((entry) => entry.type === "message");

	applyMove(manager as unknown as MoveSessionLike, { from: messages[1].id, to: messages[1].id, after: messages[3].id });

	expect(activeBranch(manager).some((entry) => entry.type === "custom" && entry.customType === MOVED_TYPE)).toBe(true);
});

test("the moved-away originals remain recoverable in the full log", () => {
	const manager = buildSession(5);
	const messages = activeBranch(manager).filter((entry) => entry.type === "message");
	const movedId = messages[1].id;

	applyMove(manager as unknown as MoveSessionLike, { from: movedId, to: movedId, after: messages[3].id });

	expect(manager.getEntries().some((entry) => entry.id === movedId)).toBe(true);
});

test("runMoveTool reports an error when not called from a meta session", () => {
	const result = runMoveTool({ from: "a", to: "b", after: "c" }, { sessionManager: { getHeader: () => ({}) } });
	expect(result.isError).toBe(true);
	expect(result.content[0].text).toContain("meta session");
});
