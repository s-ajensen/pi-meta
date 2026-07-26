import { test, expect } from "bun:test";
import { reconcileToolActivation } from "../src/tool-activation.ts";

const TOOLS = ["elide_regions", "apply_tags", "move_region"];

test("arms every meta tool in a meta session", () => {
	const result = reconcileToolActivation(["read", "bash"], true, TOOLS);
	for (const tool of TOOLS) expect(result).toContain(tool);
});

test("strips every meta tool in a non-meta session", () => {
	const carriedForward = ["read", "bash", ...TOOLS];
	const result = reconcileToolActivation(carriedForward, false, TOOLS);
	for (const tool of TOOLS) expect(result).not.toContain(tool);
});

test("stripping in a non-meta session leaves only the unrelated tools", () => {
	expect(reconcileToolActivation(["read", "bash", ...TOOLS], false, TOOLS)).toEqual(["read", "bash"]);
});

test("arming is idempotent when the tools are already active", () => {
	expect(reconcileToolActivation(["read", ...TOOLS], true, TOOLS)).toEqual(["read", ...TOOLS]);
});

test("stripping is idempotent when the tools are already absent", () => {
	expect(reconcileToolActivation(["read"], false, TOOLS)).toEqual(["read"]);
});

test("leaves unrelated tools untouched while arming", () => {
	expect(reconcileToolActivation(["read", "bash", "write"], true, TOOLS)).toEqual([
		"read",
		"bash",
		"write",
		...TOOLS,
	]);
});
