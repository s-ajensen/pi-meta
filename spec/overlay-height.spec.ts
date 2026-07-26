import { test, expect } from "bun:test";
import { resolveWindowHeight, MIN_WINDOW_HEIGHT, FALLBACK_WINDOW_HEIGHT } from "../src/tag-overlay.ts";

test("an unknown terminal height falls back to a fixed window", () => {
	expect(resolveWindowHeight(undefined)).toBe(FALLBACK_WINDOW_HEIGHT);
});

test("an explicit height overrides everything", () => {
	expect(resolveWindowHeight(60, 5)).toBe(5);
});

test("a tiny terminal still yields a usable minimum window", () => {
	expect(resolveWindowHeight(6)).toBe(MIN_WINDOW_HEIGHT);
});

test("a normal terminal yields a window filling most of it", () => {
	const height = resolveWindowHeight(40);
	expect(height).toBeGreaterThan(20);
	expect(height).toBeLessThan(40);
});

test("a taller terminal yields a taller window", () => {
	expect(resolveWindowHeight(60)).toBeGreaterThan(resolveWindowHeight(30));
});

test("the window always leaves room for the panel's own chrome", () => {
	for (const terminal of [10, 20, 40, 80, 120]) {
		expect(resolveWindowHeight(terminal)).toBeLessThan(terminal);
	}
});
