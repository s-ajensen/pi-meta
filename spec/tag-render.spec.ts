import { test, expect } from "bun:test";
import { buildRows, hexToAnsi, renderTagLine, renderRow } from "../src/tag-render.ts";
import { foldTags, type TagEntry } from "../src/tags.ts";
import type { Palette } from "../src/palette.ts";
import { visibleWidth } from "@earendil-works/pi-tui";

const tagged: Palette = (color, text) => `[${color}]${text}`;
const ansiPalette: Palette = (_color, text) => `\x1b[36m${text}\x1b[0m`;

function message(id: string, role: string, text: string): TagEntry {
	return { id, type: "message", message: { role, content: [{ type: "text", text }] } } as TagEntry;
}

function skillTag(target: string): TagEntry {
	return { type: "custom", customType: "meta-tag", data: { op: "apply", tag: "SKILL", target, by: "auto" } };
}

test("buildRows keeps only message entries, in branch order", () => {
	const branch = [
		message("e1", "user", "hi"),
		{ type: "custom", customType: "meta-tag", data: {} } as TagEntry,
		message("e2", "assistant", "yo"),
	];
	const rows = buildRows(branch, foldTags(branch));
	expect(rows.map((row) => row.id)).toEqual(["e1", "e2"]);
});

test("buildRows attaches each target's applied tags to its row", () => {
	const branch = [message("e1", "user", "hi"), skillTag("e1")];
	const rows = buildRows(branch, foldTags(branch));
	expect(rows[0].tags).toEqual(["SKILL"]);
});

test("buildRows flattens content into a single-line preview", () => {
	const branch = [message("e1", "assistant", "line one\nline two")];
	expect(buildRows(branch, foldTags(branch))[0].text).toBe("line one line two");
});

test("hexToAnsi produces a 24-bit foreground escape from a hex color", () => {
	expect(hexToAnsi("#e05252")).toBe("\x1b[38;2;224;82;82m");
});

test("an empty tag line renders as an empty string", () => {
	expect(renderTagLine([], { REGRESSION: { color: "#e05252" } })).toBe("");
});

test("a tag line colors each tag name and carries a provenance mark for non-user tags", () => {
	const line = renderTagLine([{ tag: "SKILL", target: "e1", by: "auto" }], { SKILL: { color: "#7a7a7a" } });
	expect(line).toContain(hexToAnsi("#7a7a7a"));
	expect(line).toContain("SKILL");
	expect(line).toContain("·auto");
});

test("a user-applied tag carries no provenance mark", () => {
	const line = renderTagLine([{ tag: "CHECKPOINT", target: "e1", by: "user" }], { CHECKPOINT: { color: "#52a8e0" } });
	expect(line).not.toContain("·");
});

test("the cursor row is marked distinctly from the others", () => {
	const row = { id: "e1", role: "user", text: "hi", tags: [] };
	expect(renderRow(row, true).includes("›")).toBe(true);
	expect(renderRow(row, false).includes("›")).toBe(false);
});

test("a user row colors its role prefix with the accent token", () => {
	const row = { id: "e1", role: "user", text: "hi", tags: [] };
	expect(renderRow(row, false, tagged)).toContain("[accent]user:");
});

test("an assistant row colors its role prefix with the success token", () => {
	const row = { id: "e1", role: "assistant", text: "hi", tags: [] };
	expect(renderRow(row, false, tagged)).toContain("[success]assistant:");
});

test("a tool result row colors its role prefix with the muted token", () => {
	const row = { id: "e1", role: "toolResult", text: "hi", tags: [] };
	expect(renderRow(row, false, tagged)).toContain("[muted]toolResult:");
});

test("the cursor marker is colored with the accent token", () => {
	const row = { id: "e1", role: "user", text: "hi", tags: [] };
	expect(renderRow(row, true, tagged)).toContain("[accent]›");
});

test("the message body is left uncolored for readability", () => {
	const row = { id: "e1", role: "user", text: "plain body", tags: [] };
	expect(renderRow(row, false, tagged)).toContain("plain body");
	expect(renderRow(row, false, tagged)).not.toContain("[accent]plain body");
});



test("a row is a single line even when the message body has many lines", () => {
	const branch = [message("e1", "assistant", "a\nb\nc\nd")];
	const row = buildRows(branch, foldTags(branch))[0];
	expect(renderRow(row, false).includes("\n")).toBe(false);
});

test("a long row is truncated to the given width with an ellipsis", () => {
	const row = { id: "e1", role: "user", text: "x".repeat(500), tags: [] };
	const rendered = renderRow(row, false, undefined, 40);
	expect(visibleWidth(rendered)).toBeLessThanOrEqual(40);
	expect(rendered.endsWith("…")).toBe(true);
});

test("a row that fits the width is left intact", () => {
	const row = { id: "e1", role: "user", text: "short", tags: [] };
	const rendered = renderRow(row, false, undefined, 80);
	expect(rendered).toContain("short");
	expect(rendered.endsWith("…")).toBe(false);
});

test("a wider viewport truncates less than a narrow one", () => {
	const row = { id: "e1", role: "user", text: "y".repeat(300), tags: [] };
	expect(visibleWidth(renderRow(row, false, undefined, 100))).toBeGreaterThan(
		visibleWidth(renderRow(row, false, undefined, 50)),
	);
});

test("truncation counts visible columns, not color escape sequences", () => {
	const row = { id: "e1", role: "user", text: "z".repeat(300), tags: [] };
	expect(visibleWidth(renderRow(row, false, ansiPalette, 60))).toBeLessThanOrEqual(60);
});

test("a row narrower than its role prefix still renders without throwing", () => {
	const row = { id: "e1", role: "assistant", text: "body", tags: [] };
	expect(() => renderRow(row, false, undefined, 4)).not.toThrow();
	expect(visibleWidth(renderRow(row, false, undefined, 4))).toBeLessThanOrEqual(4);
});
