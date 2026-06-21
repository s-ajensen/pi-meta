import { test, expect, beforeEach } from "bun:test";
import { loadPiMeta, type LoadedExtension } from "./helpers/load-extension.ts";

let extension: LoadedExtension;

beforeEach(async () => {
	extension = await loadPiMeta();
});

function sessionManager(name: string, parent?: string) {
	return { getSessionName: () => name, getHeader: () => (parent ? { parentSession: parent } : {}) };
}

test("registers the two commands, the elide tool, and the renderer", () => {
	expect(extension.commandNames()).toEqual(["meta", "back"]);
	expect(extension.toolNames()).toEqual(["elide_regions"]);
	expect(extension.hasRenderer("meta-elided")).toBe(true);
});

test("session_start arms the elide tool in a meta session", async () => {
	await extension.eventHandler("session_start")({}, { sessionManager: sessionManager("meta: t.jsonl", "/t.jsonl") });
	expect(extension.activeTools).toContain("elide_regions");
});

test("session_start strips a carried-forward elide tool in a non-meta session", async () => {
	extension.activeTools = ["read", "elide_regions"];
	await extension.eventHandler("session_start")({}, { sessionManager: sessionManager("ordinary work") });
	expect(extension.activeTools).toEqual(["read"]);
});
