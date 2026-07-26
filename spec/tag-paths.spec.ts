import { test, expect } from "bun:test";
import { workspaceTagsPath, globalTagsPath, definitionPath } from "../src/tag-paths.ts";

test("the workspace definitions live under the cwd's .pi directory", () => {
	expect(workspaceTagsPath("/proj")).toBe("/proj/.pi/tags.json");
});

test("the global definitions live under the agent home", () => {
	expect(globalTagsPath("/home/me")).toBe("/home/me/.pi/agent/tags.json");
});

test("a non-global definition writes to the workspace path", () => {
	expect(definitionPath("/proj", "/home/me", false)).toBe("/proj/.pi/tags.json");
});

test("a global definition writes to the agent home path", () => {
	expect(definitionPath("/proj", "/home/me", true)).toBe("/home/me/.pi/agent/tags.json");
});
