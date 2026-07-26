import { test, expect } from "bun:test";
import { mergeDefinitions, resolveColor, parseDefCommand, DEFAULT_TAG_COLOR } from "../src/definitions.ts";

test("with no scopes defined, a tag resolves to the default color", () => {
	expect(resolveColor(mergeDefinitions(undefined, undefined), "REGRESSION")).toBe(DEFAULT_TAG_COLOR);
});

test("a tag with no definition still resolves (to the default), never invalid", () => {
	const merged = mergeDefinitions({ CHECKPOINT: { color: "#52a8e0" } }, undefined);
	expect(resolveColor(merged, "REGRESSION")).toBe(DEFAULT_TAG_COLOR);
});

test("a global definition resolves its color", () => {
	const merged = mergeDefinitions({ REGRESSION: { color: "#e05252" } }, undefined);
	expect(resolveColor(merged, "REGRESSION")).toBe("#e05252");
});

test("a workspace definition wins over a global one on name collision", () => {
	const merged = mergeDefinitions({ REGRESSION: { color: "#111111" } }, { REGRESSION: { color: "#e05252" } });
	expect(resolveColor(merged, "REGRESSION")).toBe("#e05252");
});

test("non-colliding global and workspace definitions both survive the merge", () => {
	const merged = mergeDefinitions({ GLOBALTAG: { color: "#aaaaaa" } }, { LOCALTAG: { color: "#bbbbbb" } });
	expect(resolveColor(merged, "GLOBALTAG")).toBe("#aaaaaa");
	expect(resolveColor(merged, "LOCALTAG")).toBe("#bbbbbb");
});

test("parseDefCommand rejects input missing a hex color", () => {
	expect(() => parseDefCommand("REGRESSION")).toThrow("usage");
});

test("parseDefCommand rejects a malformed hex color", () => {
	expect(() => parseDefCommand("REGRESSION #ff")).toThrow("hex");
});

test("parseDefCommand reads a name and hex into a workspace-scoped definition", () => {
	expect(parseDefCommand("REGRESSION #e05252")).toEqual({ tag: "REGRESSION", color: "#e05252", global: false });
});

test("parseDefCommand flags the global scope when --global is present", () => {
	expect(parseDefCommand("REGRESSION #e05252 --global")).toEqual({ tag: "REGRESSION", color: "#e05252", global: true });
});
