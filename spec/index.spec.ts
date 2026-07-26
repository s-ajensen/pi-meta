import { test, expect, beforeEach } from "bun:test";
import { loadPiMeta, type LoadedExtension } from "./helpers/load-extension.ts";

let extension: LoadedExtension;

beforeEach(async () => {
	extension = await loadPiMeta();
});

function sessionManager(name: string, parent?: string) {
	return { getSessionName: () => name, getHeader: () => (parent ? { parentSession: parent } : {}) };
}

test("registers the commands, the meta tools, and the renderer", () => {
	expect(extension.commandNames()).toEqual(["meta", "back", "tag"]);
	expect(extension.toolNames()).toEqual(["elide_regions", "apply_tags", "move_region"]);
	expect(extension.hasRenderer("meta-elided")).toBe(true);
});

test("session_start arms every meta tool in a meta session", async () => {
	await extension.eventHandler("session_start")({}, { sessionManager: sessionManager("meta: t.jsonl", "/t.jsonl") });
	for (const tool of ["elide_regions", "apply_tags", "move_region"]) expect(extension.activeTools).toContain(tool);
});

test("session_start strips carried-forward meta tools in a non-meta session", async () => {
	extension.activeTools = ["read", "elide_regions", "apply_tags", "move_region"];
	await extension.eventHandler("session_start")({}, { sessionManager: sessionManager("ordinary work") });
	expect(extension.activeTools).toEqual(["read"]);
});
