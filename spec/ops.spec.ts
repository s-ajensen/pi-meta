import { test, expect } from "bun:test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { applyElisions, runElideTool, ELIDED_TYPE, type SessionLike } from "../src/ops.ts";

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

function activeMessages(manager: SessionManager) {
	return activeBranch(manager).filter((entry) => entry.type === "message");
}

function activeElisions(manager: SessionManager) {
	return activeBranch(manager).filter((entry) => entry.type === "custom_message");
}

test("a single region is replaced by one elision on the active branch", () => {
	const manager = buildSession(6);
	const original = activeMessages(manager);

	applyElisions(manager as unknown as SessionLike, [
		{ fromId: original[2].id, toId: original[3].id, synopsis: "S" },
	]);

	expect(activeElisions(manager)).toHaveLength(1);
	expect(activeMessages(manager)).toHaveLength(4);
});

test("the elided originals remain recoverable on the orphaned branch", () => {
	const manager = buildSession(6);
	const original = activeMessages(manager);
	const elidedId = original[2].id;

	applyElisions(manager as unknown as SessionLike, [
		{ fromId: elidedId, toId: original[3].id, synopsis: "S" },
	]);

	expect(activeBranch(manager).some((entry) => entry.id === elidedId)).toBe(false);
	expect(manager.getEntries().some((entry) => entry.id === elidedId)).toBe(true);
});

test("the elision entry carries the verbatim of the messages it replaced", () => {
	const manager = buildSession(6);
	const original = activeMessages(manager);

	applyElisions(manager as unknown as SessionLike, [
		{ fromId: original[2].id, toId: original[3].id, synopsis: "S" },
	]);

	const elision = activeElisions(manager)[0] as { details?: { count: number; verbatim: unknown[] } };
	expect(elision.details?.count).toBe(2);
	expect(elision.details?.verbatim).toHaveLength(2);
});

test("serial elisions over a growing session stay bounded, not exponential", () => {
	const manager = buildSession(40);

	for (let pass = 0; pass < 12; pass++) {
		const messages = activeMessages(manager);
		applyElisions(manager as unknown as SessionLike, [
			{ fromId: messages[1].id, toId: messages[3].id, synopsis: `pass ${pass}` },
		]);
	}

	expect(activeMessages(manager).length).toBeLessThan(40);
});

test("runElideTool reports an error when not called from a meta session", () => {
	const result = runElideTool({ regions: [] }, { sessionManager: { getHeader: () => ({}) } });
	expect(result.isError).toBe(true);
	expect(result.content[0].text).toContain("meta session");
});
