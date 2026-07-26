import { test, expect } from "bun:test";
import { reconcileSkillTags, type ReconcileEntry } from "../src/auto-tag.ts";
import { foldTags, type TagEntry } from "../src/tags.ts";

function readCall(entryId: string, callId: string, path: string): ReconcileEntry {
	return { id: entryId, type: "message", message: { role: "assistant", content: [{ type: "toolCall", id: callId, name: "read", arguments: { path } }] } };
}

function toolResult(entryId: string, callId: string): ReconcileEntry {
	return { id: entryId, type: "message", message: { role: "toolResult", toolCallId: callId, content: [] } };
}

function skillTag(target: string): TagEntry {
	return { type: "custom", customType: "meta-tag", data: { op: "apply", tag: "SKILL", target, by: "auto" } };
}

test("a branch with no skill reads produces no records", () => {
	const branch = [readCall("e1", "c1", "/home/x/notes.md"), toolResult("e2", "c1")];
	expect(reconcileSkillTags(branch, foldTags([]))).toEqual([]);
});

test("a skill read's result entry earns a SKILL apply record tagged auto", () => {
	const branch = [readCall("e1", "c1", "/agent/skills/tdd/SKILL.md"), toolResult("e2", "c1")];
	expect(reconcileSkillTags(branch, foldTags([]))).toEqual([
		{ op: "apply", tag: "SKILL", target: "e2", by: "auto" },
	]);
});

test("a skill read already carrying its SKILL tag is not re-proposed", () => {
	const branch = [readCall("e1", "c1", "/agent/skills/tdd/SKILL.md"), toolResult("e2", "c1")];
	expect(reconcileSkillTags(branch, foldTags([skillTag("e2")]))).toEqual([]);
});

test("each untagged skill read among many yields exactly one record", () => {
	const branch = [
		readCall("e1", "c1", "/skills/a/SKILL.md"),
		toolResult("e2", "c1"),
		readCall("e3", "c2", "/skills/b/SKILL.md"),
		toolResult("e4", "c2"),
	];
	expect(reconcileSkillTags(branch, foldTags([skillTag("e2")]))).toEqual([
		{ op: "apply", tag: "SKILL", target: "e4", by: "auto" },
	]);
});

test("a skill toolCall whose result has not yet landed proposes nothing", () => {
	const branch = [readCall("e1", "c1", "/skills/a/SKILL.md")];
	expect(reconcileSkillTags(branch, foldTags([]))).toEqual([]);
});
