import { test, expect } from "bun:test";
import { loadDefinitions, upsertDefinition, type DefinitionFileIO } from "../src/definition-store.ts";

function fakeIO(files: Record<string, string>): DefinitionFileIO & { files: Record<string, string> } {
	return {
		files,
		read: (path) => (path in files ? files[path] : undefined),
		write: (path, content) => {
			files[path] = content;
		},
	};
}

test("loading an absent file yields no definitions", () => {
	const io = fakeIO({});
	expect(loadDefinitions(io, "/ws/.pi/tags.json")).toBeUndefined();
});

test("loading malformed JSON yields no definitions rather than throwing", () => {
	const io = fakeIO({ "/ws/.pi/tags.json": "{ not json" });
	expect(loadDefinitions(io, "/ws/.pi/tags.json")).toBeUndefined();
});

test("loading a well-formed file parses its definitions", () => {
	const io = fakeIO({ "/ws/.pi/tags.json": JSON.stringify({ REGRESSION: { color: "#e05252" } }) });
	expect(loadDefinitions(io, "/ws/.pi/tags.json")).toEqual({ REGRESSION: { color: "#e05252" } });
});

test("upserting into an absent file creates it with the one definition", () => {
	const io = fakeIO({});
	upsertDefinition(io, "/ws/.pi/tags.json", "REGRESSION", "#e05252");
	expect(JSON.parse(io.files["/ws/.pi/tags.json"])).toEqual({ REGRESSION: { color: "#e05252" } });
});

test("upserting a new tag preserves the existing definitions", () => {
	const io = fakeIO({ "/ws/.pi/tags.json": JSON.stringify({ CHECKPOINT: { color: "#52a8e0" } }) });
	upsertDefinition(io, "/ws/.pi/tags.json", "REGRESSION", "#e05252");
	expect(JSON.parse(io.files["/ws/.pi/tags.json"])).toEqual({
		CHECKPOINT: { color: "#52a8e0" },
		REGRESSION: { color: "#e05252" },
	});
});

test("upserting an existing tag recolors it in place", () => {
	const io = fakeIO({ "/ws/.pi/tags.json": JSON.stringify({ REGRESSION: { color: "#111111" } }) });
	upsertDefinition(io, "/ws/.pi/tags.json", "REGRESSION", "#e05252");
	expect(JSON.parse(io.files["/ws/.pi/tags.json"])).toEqual({ REGRESSION: { color: "#e05252" } });
});
