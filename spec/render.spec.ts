import { test, expect } from "bun:test";
import { truncateArgs, renderBlockText, flattenContent, buildMarkerText } from "../src/render.ts";

test("the marker is singular for one message and has no arrow", () => {
	expect(buildMarkerText(1, false)).toBe("⌁ [1 message elided]");
});

test("the marker is plural with a down arrow when collapsed", () => {
	expect(buildMarkerText(3, false)).toBe("⌁ [3 messages elided ▼]");
});

test("the marker shows an up arrow when expanded", () => {
	expect(buildMarkerText(3, true)).toBe("⌁ [3 messages elided ▲]");
});

test("a zero count renders as the singular marker", () => {
	expect(buildMarkerText(0, false)).toBe("⌁ [1 message elided]");
});

test("short arguments serialize verbatim", () => {
	expect(truncateArgs({ a: 1 })).toBe('{"a":1}');
});

test("long arguments are truncated with an ellipsis", () => {
	const result = truncateArgs({ value: "x".repeat(200) });
	expect(result.length).toBe(78);
	expect(result.endsWith("…")).toBe(true);
});

test("unserializable arguments degrade to an ellipsis", () => {
	const circular: Record<string, unknown> = {};
	circular.self = circular;
	expect(truncateArgs(circular)).toBe("…");
});

test("a text block renders its text", () => {
	expect(renderBlockText({ type: "text", text: "hello" })).toBe("hello");
});

test("a tool-call block renders as an arrow with name and args", () => {
	expect(renderBlockText({ type: "toolCall", name: "bash", arguments: { cmd: "ls" } })).toBe(
		'→ bash({"cmd":"ls"})',
	);
});

test("a thinking block renders a placeholder", () => {
	expect(renderBlockText({ type: "thinking" })).toBe("(thinking)");
});

test("an unknown block type renders nothing", () => {
	expect(renderBlockText({ type: "mystery" })).toBeUndefined();
});

test("string content passes through unchanged", () => {
	expect(flattenContent("plain")).toBe("plain");
});

test("non-array, non-string content flattens to empty", () => {
	expect(flattenContent(undefined)).toBe("");
	expect(flattenContent(42)).toBe("");
});

test("array content joins renderable blocks and drops the rest", () => {
	const content = [
		{ type: "text", text: "first" },
		{ type: "mystery" },
		{ type: "text", text: "second" },
	];
	expect(flattenContent(content)).toBe("first\nsecond");
});
