import { test, expect } from "bun:test";
import { buildHeader, buildScrollNote, TagOverlayComponent, type TagOverlayOptions } from "../src/tag-overlay.ts";
import type { SelectionRow } from "../src/selection.ts";
import type { TagData } from "../src/tags.ts";
import { visibleWidth } from "@earendil-works/pi-tui";

const definitions = { CHECKPOINT: { color: "#52a8e0" } };

function rows(count: number): SelectionRow[] {
	return Array.from({ length: count }, (_, i) => ({ id: `e${i}`, role: "user", text: `m${i}`, tags: [] }));
}

function overlay(overrides: Partial<TagOverlayOptions> = {}) {
	const appended: TagData[] = [];
	let closed = false;
	const component = new TagOverlayComponent({
		rows: rows(30),
		applied: [],
		definitions,
		armedTag: "CHECKPOINT",
		append: (record: TagData) => void appended.push(record),
		done: () => {
			closed = true;
		},
		height: 5,
		...overrides,
	});
	return { component, appended, isClosed: () => closed };
}

test("the header names the armed tag when one is armed", () => {
	expect(buildHeader("CHECKPOINT", definitions)).toContain("CHECKPOINT");
});

test("the header says browsing when no tag is armed", () => {
	expect(buildHeader(undefined, definitions).toLowerCase()).toContain("brows");
});

test("no scroll note is shown when everything fits", () => {
	expect(buildScrollNote(0, 0)).toBe("");
});

test("the scroll note reports rows hidden above and below", () => {
	const note = buildScrollNote(3, 7);
	expect(note).toContain("3");
	expect(note).toContain("7");
});

test("escape closes the overlay", () => {
	const { component, isClosed } = overlay();
	component.handleInput("\x1b");
	expect(isClosed()).toBe(true);
});

test("ctrl+c closes the overlay rather than being swallowed", () => {
	const { component, isClosed } = overlay();
	component.handleInput("\x03");
	expect(isClosed()).toBe(true);
});

test("enter on the armed overlay appends a tag record", () => {
	const { component, appended } = overlay();
	component.handleInput("\r");
	expect(appended).toHaveLength(1);
	expect(appended[0].tag).toBe("CHECKPOINT");
});

test("enter with no tag armed appends nothing", () => {
	const { component, appended } = overlay({ armedTag: undefined });
	component.handleInput("\r");
	expect(appended).toEqual([]);
});

test("arrow keys move the selection without closing or appending", () => {
	const { component, appended, isClosed } = overlay();
	component.handleInput("\x1b[A");
	component.handleInput("\x1b[B");
	expect(appended).toEqual([]);
	expect(isClosed()).toBe(false);
});

test("an unhandled key neither closes nor appends", () => {
	const { component, appended, isClosed } = overlay();
	component.handleInput("z");
	expect(appended).toEqual([]);
	expect(isClosed()).toBe(false);
});

test("the rendered list is bounded by the window height, not the row count", () => {
	const { component } = overlay();
	const rendered = component.render(100);
	expect(rendered.length).toBeLessThan(20);
});

test("every rendered line fits the width, so no row wraps", () => {
	const wide = Array.from({ length: 8 }, (_, i) => ({
		id: `e${i}`,
		role: "assistant",
		text: "a very long message body ".repeat(20),
		tags: [],
	}));
	const { component } = overlay({ rows: wide });
	for (const line of component.render(60)) {
		expect(visibleWidth(line)).toBeLessThanOrEqual(60);
	}
});

test("the row count is unchanged by long content, proving rows do not wrap", () => {
	const short = overlay({ rows: rows(6), height: 6 }).component.render(60).length;
	const long = overlay({
		rows: Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, role: "user", text: "x".repeat(400), tags: [] })),
		height: 6,
	}).component.render(60).length;
	expect(long).toBe(short);
});

test("rows re-truncate when the panel is rendered at a different width", () => {
	const { component } = overlay({
		rows: [{ id: "e0", role: "user", text: "q".repeat(200), tags: [] }],
		height: 3,
	});
	const narrow = component.render(40).find((line) => line.includes("user:")) ?? "";
	const wide = component.render(100).find((line) => line.includes("user:")) ?? "";
	expect(visibleWidth(wide)).toBeGreaterThan(visibleWidth(narrow));
});

test("the panel is framed by a rule on its first and last line", () => {
	const { component } = overlay();
	const rendered = component.render(40);
	expect(rendered[0]).toContain("─");
	expect(rendered[rendered.length - 1]).toContain("─");
});

test("the frame spans the full width it is rendered at", () => {
	const { component } = overlay();
	const rendered = component.render(40);
	expect(rendered[0].replace(/\x1b\[[0-9;]*m/g, "").trim().length).toBe(40);
});

test("the frame uses the supplied palette rather than a global theme", () => {
	const { component } = overlay({ palette: (_color, text) => `<${text}>` });
	expect(component.render(20)[0].startsWith("<")).toBe(true);
});

test("a palette that throws degrades to plain output instead of crashing the render", () => {
	const { component } = overlay({
		palette: () => {
			throw new Error("theme exploded");
		},
	});
	expect(() => component.render(40)).not.toThrow();
	expect(component.render(40).length).toBeGreaterThan(0);
});
