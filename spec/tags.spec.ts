import { test, expect } from "bun:test";
import { foldTags, resolveTag, tagsForTarget, type TagActor, type TagEntry } from "../src/tags.ts";

function apply(tag: string, target: string, by: TagActor = "user"): TagEntry {
	return { type: "custom", customType: "meta-tag", data: { op: "apply", tag, target, by } };
}

function retract(tag: string, target: string, by: TagActor = "user"): TagEntry {
	return { type: "custom", customType: "meta-tag", data: { op: "retract", tag, target, by } };
}

function message(id: string): TagEntry {
	return { id, type: "message", message: { role: "user", content: id } } as TagEntry;
}

test("an unrelated custom entry contributes no tags", () => {
	const entries = [{ type: "custom", customType: "meta-elided", data: {} } as TagEntry];
	expect(foldTags(entries)).toEqual([]);
});

test("a lone retract with no prior apply leaves the pair unapplied", () => {
	expect(foldTags([retract("REGRESSION", "e1")])).toEqual([]);
});

test("a single apply folds to one applied tag carrying its provenance", () => {
	expect(foldTags([apply("REGRESSION", "e1")])).toEqual([{ tag: "REGRESSION", target: "e1", by: "user" }]);
});

test("apply then retract folds to nothing", () => {
	expect(foldTags([apply("REGRESSION", "e1"), retract("REGRESSION", "e1")])).toEqual([]);
});

test("apply, retract, re-apply folds to applied (latest op wins)", () => {
	const entries = [apply("REGRESSION", "e1"), retract("REGRESSION", "e1"), apply("REGRESSION", "e1")];
	expect(foldTags(entries)).toEqual([{ tag: "REGRESSION", target: "e1", by: "user" }]);
});

test("a re-apply by a different actor updates the winning provenance", () => {
	const entries = [apply("ERROR", "e1", "user"), retract("ERROR", "e1", "user"), apply("ERROR", "e1", "meta")];
	expect(foldTags(entries)).toEqual([{ tag: "ERROR", target: "e1", by: "meta" }]);
});

test("multiple distinct tags on one target all survive the fold", () => {
	const entries = [apply("CHECKPOINT", "e1"), apply("BRILLIANT", "e1")];
	expect(foldTags(entries)).toEqual([
		{ tag: "CHECKPOINT", target: "e1", by: "user" },
		{ tag: "BRILLIANT", target: "e1", by: "user" },
	]);
});

test("tagsForTarget returns only the tags applied to the given entry", () => {
	const applied = foldTags([apply("CHECKPOINT", "e1"), apply("ERROR", "e2"), apply("SKILL", "e1", "auto")]);
	expect(tagsForTarget(applied, "e1")).toEqual([
		{ tag: "CHECKPOINT", target: "e1", by: "user" },
		{ tag: "SKILL", target: "e1", by: "auto" },
	]);
});

test("resolveTag returns targets ordered by their position in the log, not application order", () => {
	const entries = [message("e1"), message("e2"), message("e3"), apply("REGRESSION", "e3"), apply("REGRESSION", "e1")];
	expect(resolveTag(entries, "REGRESSION")).toEqual(["e1", "e3"]);
});

test("resolveTag excludes a target whose tag was retracted", () => {
	const entries = [message("e1"), message("e2"), apply("ERROR", "e1"), apply("ERROR", "e2"), retract("ERROR", "e1")];
	expect(resolveTag(entries, "ERROR")).toEqual(["e2"]);
});

function remap(map: Record<string, string>): TagEntry {
	return { type: "custom", customType: "meta-remap", data: { op: "remap", map } } as unknown as TagEntry;
}

test("a tag applied before a replay follows its message to the new id", () => {
	const entries = [apply("REGRESSION", "e1"), remap({ e1: "e2" })];
	expect(foldTags(entries)).toEqual([{ tag: "REGRESSION", target: "e2", by: "user" }]);
});

test("a tag follows its message across a chain of replays", () => {
	const entries = [apply("CHECKPOINT", "e1"), remap({ e1: "e2" }), remap({ e2: "e3" }), remap({ e3: "e4" })];
	expect(foldTags(entries)).toEqual([{ tag: "CHECKPOINT", target: "e4", by: "user" }]);
});

test("applying to an old id and retracting via the new id cancel out", () => {
	const entries = [apply("ERROR", "e1"), remap({ e1: "e2" }), retract("ERROR", "e2")];
	expect(foldTags(entries)).toEqual([]);
});

test("a tag applied after a replay is not re-mapped away from its target", () => {
	const entries = [remap({ e1: "e2" }), apply("BRILLIANT", "e2")];
	expect(foldTags(entries)).toEqual([{ tag: "BRILLIANT", target: "e2", by: "user" }]);
});

test("two tags on a replayed message both follow it, without duplication", () => {
	const entries = [apply("SKILL", "e1", "auto"), apply("CHECKPOINT", "e1"), remap({ e1: "e2" })];
	expect(foldTags(entries)).toEqual([
		{ tag: "SKILL", target: "e2", by: "auto" },
		{ tag: "CHECKPOINT", target: "e2", by: "user" },
	]);
});

test("resolveTag reports the replayed id, not the orphaned original", () => {
	const entries = [message("e2"), apply("REGRESSION", "e1"), remap({ e1: "e2" })];
	expect(resolveTag(entries, "REGRESSION")).toEqual(["e2"]);
});
