import { test, expect } from "bun:test";
import { windowRows } from "../src/viewport.ts";

const rows = Array.from({ length: 10 }, (_, i) => `r${i}`);

test("a list shorter than the window shows everything with no indicators", () => {
	expect(windowRows(["a", "b"], 0, 5)).toEqual({ visible: ["a", "b"], start: 0, more: { above: 0, below: 0 } });
});

test("an empty list windows to nothing", () => {
	expect(windowRows([], -1, 5)).toEqual({ visible: [], start: 0, more: { above: 0, below: 0 } });
});

test("a cursor at the top anchors the window at the start", () => {
	const result = windowRows(rows, 0, 4);
	expect(result.visible).toEqual(["r0", "r1", "r2", "r3"]);
	expect(result.more).toEqual({ above: 0, below: 6 });
});

test("a cursor at the bottom anchors the window at the end", () => {
	const result = windowRows(rows, 9, 4);
	expect(result.visible).toEqual(["r6", "r7", "r8", "r9"]);
	expect(result.more).toEqual({ above: 6, below: 0 });
});

test("a cursor in the middle centers the window around it", () => {
	const result = windowRows(rows, 5, 5);
	expect(result.visible).toContain("r5");
	expect(result.more.above).toBeGreaterThan(0);
	expect(result.more.below).toBeGreaterThan(0);
});

test("the window never exceeds the requested height", () => {
	expect(windowRows(rows, 5, 3).visible).toHaveLength(3);
});

test("a window height of zero yields nothing visible", () => {
	expect(windowRows(rows, 5, 0).visible).toEqual([]);
});

test("the reported start index matches the first visible row", () => {
	const result = windowRows(rows, 9, 4);
	expect(rows[result.start]).toBe(result.visible[0]);
});
