import { test, expect } from "bun:test";
import { readTerminalRows } from "../src/tag-command-binding.ts";

test("a missing tui yields no row count", () => {
	expect(readTerminalRows(undefined)).toBeUndefined();
});

test("a tui without a terminal yields no row count", () => {
	expect(readTerminalRows({})).toBeUndefined();
});

test("a non-numeric row count is rejected", () => {
	expect(readTerminalRows({ terminal: { rows: "40" } })).toBeUndefined();
});

test("a zero row count is rejected rather than collapsing the window", () => {
	expect(readTerminalRows({ terminal: { rows: 0 } })).toBeUndefined();
});

test("a real row count is read", () => {
	expect(readTerminalRows({ terminal: { rows: 48 } })).toBe(48);
});
