import { test, expect } from "bun:test";
import { buildRemap, resolveTerminalId, REMAP_TYPE, type RemapEntry } from "../src/remap.ts";

function remap(map: Record<string, string>): RemapEntry {
	return { type: "custom", customType: REMAP_TYPE, data: { op: "remap", map } };
}

test("an entry with no remap records resolves an id to itself", () => {
	expect(resolveTerminalId(buildRemap([]), "e1")).toBe("e1");
});

test("an unrelated custom entry contributes no mapping", () => {
	const entries = [{ type: "custom", customType: "meta-tag", data: {} } as unknown as RemapEntry];
	expect(resolveTerminalId(buildRemap(entries), "e1")).toBe("e1");
});

test("a single remap resolves an old id to its replayed id", () => {
	expect(resolveTerminalId(buildRemap([remap({ e1: "e2" })]), "e1")).toBe("e2");
});

test("an id absent from the map resolves to itself", () => {
	expect(resolveTerminalId(buildRemap([remap({ e1: "e2" })]), "zz")).toBe("zz");
});

test("a chain of remaps resolves transitively to the terminal id", () => {
	const entries = [remap({ e1: "e2" }), remap({ e2: "e3" }), remap({ e3: "e4" })];
	expect(resolveTerminalId(buildRemap(entries), "e1")).toBe("e4");
});

test("an intermediate id in a chain resolves to the same terminal id", () => {
	const entries = [remap({ e1: "e2" }), remap({ e2: "e3" })];
	expect(resolveTerminalId(buildRemap(entries), "e2")).toBe("e3");
});

test("a remap record carrying several pairs maps each of them", () => {
	const entries = [remap({ a1: "a2", b1: "b2" }), remap({ a2: "a3" })];
	const map = buildRemap(entries);
	expect(resolveTerminalId(map, "a1")).toBe("a3");
	expect(resolveTerminalId(map, "b1")).toBe("b2");
});

test("a cyclic remap terminates rather than looping forever", () => {
	const entries = [remap({ e1: "e2" }), remap({ e2: "e1" })];
	expect(() => resolveTerminalId(buildRemap(entries), "e1")).not.toThrow();
});
