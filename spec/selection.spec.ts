import { test, expect } from "bun:test";
import { createSelection, moveCursor, toggleAt, type SelectionRow } from "../src/selection.ts";

function rows(...ids: string[]): SelectionRow[] {
	return ids.map((id) => ({ id, role: "user", text: id, tags: [] }));
}

test("selection starts on the most recent row", () => {
	const state = createSelection(rows("e1", "e2", "e3"));
	expect(state.cursor).toBe(2);
});

test("an empty conversation yields a cursor of -1", () => {
	expect(createSelection([]).cursor).toBe(-1);
});

test("moving up decrements the cursor", () => {
	const state = moveCursor(createSelection(rows("e1", "e2", "e3")), -1);
	expect(state.cursor).toBe(1);
});

test("the cursor clamps at the top row", () => {
	let state = createSelection(rows("e1", "e2"));
	state = moveCursor(moveCursor(state, -1), -1);
	expect(state.cursor).toBe(0);
});

test("the cursor clamps at the bottom row", () => {
	const state = moveCursor(createSelection(rows("e1", "e2")), 1);
	expect(state.cursor).toBe(1);
});

test("toggling with no armed tag proposes nothing", () => {
	const state = createSelection(rows("e1", "e2"));
	expect(toggleAt(state, undefined)).toBeUndefined();
});

test("toggling an untagged row proposes an apply for its id", () => {
	const state = createSelection(rows("e1", "e2"));
	expect(toggleAt(state, "CHECKPOINT")).toEqual({ op: "apply", tag: "CHECKPOINT", target: "e2", by: "user" });
});

test("toggling a row already carrying the armed tag proposes a retract", () => {
	const state = createSelection([{ id: "e1", role: "user", text: "e1", tags: ["CHECKPOINT"] }]);
	expect(toggleAt(state, "CHECKPOINT")).toEqual({ op: "retract", tag: "CHECKPOINT", target: "e1", by: "user" });
});

test("toggling with no row under the cursor proposes nothing", () => {
	expect(toggleAt(createSelection([]), "CHECKPOINT")).toBeUndefined();
});
