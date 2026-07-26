import { test, expect } from "bun:test";
import { resolveDefinitions, buildOverlayData, isTagDefined } from "../src/tag-binding.ts";
import type { DefinitionFileIO } from "../src/definition-store.ts";
import type { TagEntry } from "../src/tags.ts";

function io(files: Record<string, string>): DefinitionFileIO {
	return { read: (path) => files[path], write: () => {} };
}

function message(id: string, text: string): TagEntry {
	return { id, type: "message", message: { role: "user", content: [{ type: "text", text }] } } as TagEntry;
}

function skillTag(target: string): TagEntry {
	return { type: "custom", customType: "meta-tag", data: { op: "apply", tag: "SKILL", target, by: "auto" } };
}

function remapEntry(map: Record<string, string>): TagEntry {
	return { type: "custom", customType: "meta-remap", data: { op: "remap", map } } as unknown as TagEntry;
}

test("resolveDefinitions merges global then workspace with workspace winning", () => {
	const files = {
		"/home/.pi/agent/tags.json": JSON.stringify({ SKILL: { color: "#111111" }, ONLYGLOBAL: { color: "#222222" } }),
		"/ws/.pi/tags.json": JSON.stringify({ SKILL: { color: "#7a7a7a" } }),
	};
	const merged = resolveDefinitions(io(files), "/ws", "/home");
	expect(merged.SKILL.color).toBe("#7a7a7a");
	expect(merged.ONLYGLOBAL.color).toBe("#222222");
});

test("resolveDefinitions tolerates both scopes being absent", () => {
	expect(resolveDefinitions(io({}), "/ws", "/home")).toEqual({});
});

test("isTagDefined reflects presence in the merged definitions", () => {
	const files = { "/ws/.pi/tags.json": JSON.stringify({ CHECKPOINT: { color: "#52a8e0" } }) };
	expect(isTagDefined(io({ ...files }), "/ws", "/home", "CHECKPOINT")).toBe(true);
	expect(isTagDefined(io({ ...files }), "/ws", "/home", "REGRESSION")).toBe(false);
});

test("buildOverlayData builds rows from the branch and tags from the full log", () => {
	const branch = [message("e1", "hi"), message("e2", "yo")];
	const log = [...branch, skillTag("e2")];
	const data = buildOverlayData(branch, log);
	expect(data.rows.map((row) => row.id)).toEqual(["e1", "e2"]);
	expect(data.rows[1].tags).toEqual(["SKILL"]);
	expect(data.applied).toEqual([{ tag: "SKILL", target: "e2", by: "auto" }]);
});

test("a tag whose record was orphaned by a replay still lands on the surviving row", () => {
	const branch = [message("e2", "replayed")];
	const log = [message("e1", "original"), skillTag("e1"), remapEntry({ e1: "e2" }), ...branch];
	const data = buildOverlayData(branch, log);
	expect(data.rows[0].tags).toEqual(["SKILL"]);
});
