import { test, expect } from "bun:test";
import { reconcileToolActivation } from "../src/tool-activation.ts";

const TOOL = "elide_regions";

test("arms the tool in a meta session", () => {
	expect(reconcileToolActivation(["read", "bash"], true, TOOL)).toContain(TOOL);
});

test("strips the tool in a non-meta session", () => {
	expect(reconcileToolActivation(["read", "bash", TOOL], false, TOOL)).not.toContain(TOOL);
});

test("strips a tool carried forward from a prior meta session", () => {
	const carriedForward = ["read", "bash", TOOL];
	expect(reconcileToolActivation(carriedForward, false, TOOL)).toEqual(["read", "bash"]);
});

test("arming is idempotent when the tool is already active", () => {
	expect(reconcileToolActivation(["read", TOOL], true, TOOL)).toEqual(["read", TOOL]);
});

test("stripping is idempotent when the tool is already absent", () => {
	expect(reconcileToolActivation(["read"], false, TOOL)).toEqual(["read"]);
});

test("leaves unrelated tools untouched", () => {
	expect(reconcileToolActivation(["read", "bash", "write"], true, TOOL)).toEqual([
		"read",
		"bash",
		"write",
		TOOL,
	]);
});
