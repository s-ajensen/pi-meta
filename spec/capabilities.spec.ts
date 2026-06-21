import { test, expect } from "bun:test";
import { existsSync } from "node:fs";
import { renderMetaSkills, capabilities, type Capability } from "../src/capabilities.ts";

const elision: Capability = {
	name: "elision",
	description: "How to collapse spent stretches of the target into summaries.",
	skillPath: "/ext/pi-meta/src/skills/elision/SKILL.md",
};

test("renders each capability as a skill with name, description, and location", () => {
	const block = renderMetaSkills([elision]);
	expect(block).toContain("<name>elision</name>");
	expect(block).toContain("<description>How to collapse spent stretches of the target into summaries.</description>");
	expect(block).toContain("<location>/ext/pi-meta/src/skills/elision/SKILL.md</location>");
});

test("wraps capabilities in a meta_skills root distinct from pi's available_skills", () => {
	const block = renderMetaSkills([elision]);
	expect(block).toContain("<meta_skills>");
	expect(block).toContain("</meta_skills>");
	expect(block).not.toContain("available_skills");
});

test("notes that these skills were injected by the meta channel", () => {
	const block = renderMetaSkills([elision]);
	expect(block.toLowerCase()).toContain("inject");
});

test("renders multiple capabilities in order", () => {
	const second: Capability = { name: "mining", description: "Extract notable moments.", skillPath: "/x/mining.md" };
	const block = renderMetaSkills([elision, second]);
	expect(block.indexOf("elision")).toBeLessThan(block.indexOf("mining"));
});

test("renders nothing when there are no capabilities", () => {
	expect(renderMetaSkills([])).toBe("");
});

test("every registered capability points at a skill file that exists", () => {
	for (const capability of capabilities) {
		expect(existsSync(capability.skillPath)).toBe(true);
	}
});
