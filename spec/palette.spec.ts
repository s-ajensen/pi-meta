import { test, expect } from "bun:test";
import { buildPalette, roleColor, IDENTITY_PALETTE } from "../src/palette.ts";

class ThemeWithState {
	private fgColors = new Map([
		["accent", "<A>"],
		["success", "<S>"],
		["muted", "<M>"],
		["dim", "<D>"],
		["border", "<B>"],
	]);

	fg(color: string, text: string): string {
		const ansi = this.fgColors.get(color);
		if (!ansi) throw new Error(`Unknown theme color: ${color}`);
		return `${ansi}${text}`;
	}
}

function proxied(target: object): unknown {
	return new Proxy({}, { get: (_t, prop) => (target as Record<string | symbol, unknown>)[prop] });
}

test("a user message takes the accent color", () => {
	expect(roleColor("user")).toBe("accent");
});

test("an assistant message takes the success color", () => {
	expect(roleColor("assistant")).toBe("success");
});

test("a tool result takes the muted color", () => {
	expect(roleColor("toolResult")).toBe("muted");
});

test("an unrecognized role falls back to dim", () => {
	expect(roleColor("bashExecution")).toBe("dim");
	expect(roleColor("mystery")).toBe("dim");
});

test("a missing theme yields the identity palette", () => {
	expect(buildPalette(undefined)).toBe(IDENTITY_PALETTE);
});

test("a real theme colors by token", () => {
	const palette = buildPalette(new ThemeWithState());
	expect(palette("accent", "x")).toBe("<A>x");
	expect(palette("success", "x")).toBe("<S>x");
});

test("pi's proxied theme export keeps its receiver", () => {
	expect(buildPalette(proxied(new ThemeWithState()))("border", "─")).toBe("<B>─");
});

test("a theme that rejects a color degrades to plain text for that call", () => {
	const palette = buildPalette({
		fg(color: string, text: string): string {
			if (color === "success") throw new Error("Unknown theme color: success");
			return `<ok>${text}`;
		},
	});
	expect(palette("success", "x")).toBe("x");
	expect(palette("accent", "x")).toBe("<ok>x");
});
