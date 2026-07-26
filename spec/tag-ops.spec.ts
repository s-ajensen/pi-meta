import { test, expect } from "bun:test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { appendTagRecords, runApplyTagsTool, type TagSessionLike } from "../src/tag-ops.ts";
import { foldTags, type TagEntry } from "../src/tags.ts";
import { applyElisions, type SessionLike } from "../src/ops.ts";
import { applyMove, type MoveSessionLike } from "../src/move-ops.ts";
import { reconcileSkillTags } from "../src/auto-tag.ts";

function buildSession(messageCount: number): SessionManager {
	const manager = SessionManager.inMemory();
	for (let i = 0; i < messageCount; i++) {
		manager.appendMessage({ role: "user", content: [{ type: "text", text: `m${i}` }], timestamp: Date.now() });
	}
	return manager;
}

function messages(manager: SessionManager) {
	return manager.getBranch(manager.getLeafId() ?? undefined).filter((entry) => entry.type === "message");
}

function applied(manager: SessionManager) {
	return foldTags(manager.getEntries() as unknown as TagEntry[]);
}

test("appending an apply record makes the tag fold as applied to its target", () => {
	const manager = buildSession(3);
	const target = messages(manager)[1].id;

	appendTagRecords(manager as unknown as TagSessionLike, [{ op: "apply", tag: "REGRESSION", target, by: "meta" }]);

	expect(applied(manager)).toEqual([{ tag: "REGRESSION", target, by: "meta" }]);
});

test("appending a retract record after an apply folds the pair away", () => {
	const manager = buildSession(3);
	const target = messages(manager)[1].id;

	appendTagRecords(manager as unknown as TagSessionLike, [{ op: "apply", tag: "ERROR", target, by: "meta" }]);
	appendTagRecords(manager as unknown as TagSessionLike, [{ op: "retract", tag: "ERROR", target, by: "meta" }]);

	expect(applied(manager)).toEqual([]);
});

test("a batch of records is applied in one call", () => {
	const manager = buildSession(3);
	const [a, b] = messages(manager);

	appendTagRecords(manager as unknown as TagSessionLike, [
		{ op: "apply", tag: "CHECKPOINT", target: a.id, by: "meta" },
		{ op: "apply", tag: "CHECKPOINT", target: b.id, by: "meta" },
	]);

	expect(applied(manager).map((tag) => tag.target).sort()).toEqual([a.id, b.id].sort());
});

test("tags survive a branch: a tag applied before a fork still folds afterward", () => {
	const manager = buildSession(3);
	const [a, b] = messages(manager);
	appendTagRecords(manager as unknown as TagSessionLike, [{ op: "apply", tag: "CHECKPOINT", target: a.id, by: "meta" }]);

	manager.branch(b.id);
	manager.appendMessage({ role: "user", content: [{ type: "text", text: "sibling" }], timestamp: Date.now() });

	expect(applied(manager)).toEqual([{ tag: "CHECKPOINT", target: a.id, by: "meta" }]);
});

function activeMessages(manager: SessionManager) {
	return manager.getBranch(manager.getLeafId() ?? undefined).filter((entry) => entry.type === "message");
}

test("a tag follows its message when an elision replays it onto a new id", () => {
	const manager = buildSession(5);
	const before = activeMessages(manager);
	const tagged = before[3].id;
	appendTagRecords(manager as unknown as TagSessionLike, [{ op: "apply", tag: "CHECKPOINT", target: tagged, by: "user" }]);

	applyElisions(manager as unknown as SessionLike, [{ fromId: before[1].id, toId: before[1].id, synopsis: "S" }]);

	const survivingId = activeMessages(manager).at(-2)?.id;
	expect(applied(manager)).toEqual([{ tag: "CHECKPOINT", target: survivingId as string, by: "user" }]);
});

test("a tag on a replayed message stays visible in the active branch after elision", () => {
	const manager = buildSession(5);
	const before = activeMessages(manager);
	appendTagRecords(manager as unknown as TagSessionLike, [{ op: "apply", tag: "ERROR", target: before[4].id, by: "user" }]);

	applyElisions(manager as unknown as SessionLike, [{ fromId: before[1].id, toId: before[2].id, synopsis: "S" }]);

	const liveIds = new Set(activeMessages(manager).map((entry) => entry.id));
	expect(liveIds.has(applied(manager)[0].target)).toBe(true);
});

test("a tag follows its message across two successive elisions", () => {
	const manager = buildSession(8);
	const before = activeMessages(manager);
	appendTagRecords(manager as unknown as TagSessionLike, [{ op: "apply", tag: "CHECKPOINT", target: before[7].id, by: "user" }]);

	applyElisions(manager as unknown as SessionLike, [{ fromId: before[1].id, toId: before[2].id, synopsis: "A" }]);
	const mid = activeMessages(manager);
	applyElisions(manager as unknown as SessionLike, [{ fromId: mid[1].id, toId: mid[2].id, synopsis: "B" }]);

	const liveIds = new Set(activeMessages(manager).map((entry) => entry.id));
	expect(liveIds.has(applied(manager)[0].target)).toBe(true);
});

test("a tag follows its message when a move replays it", () => {
	const manager = buildSession(5);
	const before = activeMessages(manager);
	appendTagRecords(manager as unknown as TagSessionLike, [{ op: "apply", tag: "CHECKPOINT", target: before[4].id, by: "user" }]);

	applyMove(manager as unknown as MoveSessionLike, { from: before[1].id, to: before[1].id, after: before[3].id });

	const liveIds = new Set(activeMessages(manager).map((entry) => entry.id));
	expect(liveIds.has(applied(manager)[0].target)).toBe(true);
});

test("retracting via the replayed id removes a tag applied before the elision", () => {
	const manager = buildSession(5);
	const before = activeMessages(manager);
	appendTagRecords(manager as unknown as TagSessionLike, [{ op: "apply", tag: "ERROR", target: before[4].id, by: "user" }]);

	applyElisions(manager as unknown as SessionLike, [{ fromId: before[1].id, toId: before[1].id, synopsis: "S" }]);
	const replayedId = applied(manager)[0].target;
	appendTagRecords(manager as unknown as TagSessionLike, [{ op: "retract", tag: "ERROR", target: replayedId, by: "user" }]);

	expect(applied(manager)).toEqual([]);
});

test("the skill auto-tagger proposes nothing for a replayed read it already tagged", () => {
	const manager = SessionManager.inMemory();
	manager.appendMessage({ role: "user", content: [{ type: "text", text: "go" }], timestamp: Date.now() });
	manager.appendMessage({
		role: "assistant",
		content: [{ type: "toolCall", id: "c1", name: "read", arguments: { path: "/skills/tdd/SKILL.md" } }],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "test",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
		stopReason: "toolUse",
		timestamp: Date.now(),
	} as never);
	manager.appendMessage({ role: "toolResult", toolCallId: "c1", toolName: "read", content: [], isError: false, timestamp: Date.now() });
	manager.appendMessage({ role: "user", content: [{ type: "text", text: "next" }], timestamp: Date.now() });

	const branch = manager.getBranch(manager.getLeafId() ?? undefined) as unknown as TagEntry[];
	appendTagRecords(manager as unknown as TagSessionLike, reconcileSkillTags(branch as never, applied(manager)));

	const first = activeMessages(manager);
	applyElisions(manager as unknown as SessionLike, [{ fromId: first[0].id, toId: first[0].id, synopsis: "S" }]);

	const after = manager.getBranch(manager.getLeafId() ?? undefined) as unknown as TagEntry[];
	expect(reconcileSkillTags(after as never, applied(manager))).toEqual([]);
});

test("runApplyTagsTool reports an error when not called from a meta session", () => {
	const result = runApplyTagsTool({ records: [] }, { sessionManager: { getHeader: () => ({}) } });
	expect(result.isError).toBe(true);
	expect(result.content[0].text).toContain("meta session");
});
