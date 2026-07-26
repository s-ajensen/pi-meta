import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { loadPiMeta, type LoadedExtension } from "./helpers/load-extension.ts";
import { foldTags, type TagEntry } from "../src/tags.ts";

let extension: LoadedExtension;
let workspace: string;

beforeEach(async () => {
	extension = await loadPiMeta();
	workspace = mkdtempSync(join(tmpdir(), "pi-meta-tag-"));
});

afterEach(() => {
	rmSync(workspace, { recursive: true, force: true });
});

function buildSession(count: number): SessionManager {
	const manager = SessionManager.inMemory();
	for (let i = 0; i < count; i++) {
		manager.appendMessage({ role: "user", content: [{ type: "text", text: `m${i}` }], timestamp: Date.now() });
	}
	extension.onAppendEntry((customType, data) => manager.appendCustomEntry(customType, data));
	return manager;
}

interface OverlayHarness {
	component: { handleInput(key: string): void } | undefined;
	notices: string[];
}

function commandContext(manager: SessionManager, harness: OverlayHarness) {
	return {
		cwd: workspace,
		ui: {
			custom: async (factory: (tui: unknown, theme: unknown, kb: unknown, done: () => void) => unknown) => {
				harness.component = factory({}, undefined, {}, () => {}) as never;
				return undefined;
			},
			input: async () => "#abcdef",
			notify: (message: string) => void harness.notices.push(message),
		},
		sessionManager: manager,
	};
}

test("the registered /tag handler opens an overlay without touching an absent ctx.appendEntry", async () => {
	const manager = buildSession(3);
	const harness: OverlayHarness = { component: undefined, notices: [] };

	await extension.commandHandler("tag")("", commandContext(manager, harness) as never);

	expect(harness.component).toBeDefined();
});

test("pressing enter through the real handler writes a tag into the session", async () => {
	const manager = buildSession(3);
	const harness: OverlayHarness = { component: undefined, notices: [] };
	await extension.commandHandler("tag")("CHECKPOINT", commandContext(manager, harness) as never);

	harness.component?.handleInput("\r");

	const applied = foldTags(manager.getEntries() as unknown as TagEntry[]);
	expect(applied).toHaveLength(1);
	expect(applied[0].tag).toBe("CHECKPOINT");
});

test("the tag written through the real handler lands on the selected message", async () => {
	const manager = buildSession(3);
	const messages = manager.getBranch(manager.getLeafId() ?? undefined).filter((entry) => entry.type === "message");
	const harness: OverlayHarness = { component: undefined, notices: [] };
	await extension.commandHandler("tag")("CHECKPOINT", commandContext(manager, harness) as never);

	harness.component?.handleInput("\r");

	expect(foldTags(manager.getEntries() as unknown as TagEntry[])[0].target).toBe(messages[2].id);
});

test("enter twice through the real handler toggles the tag back off", async () => {
	const manager = buildSession(3);
	const harness: OverlayHarness = { component: undefined, notices: [] };
	await extension.commandHandler("tag")("CHECKPOINT", commandContext(manager, harness) as never);

	harness.component?.handleInput("\r");
	harness.component?.handleInput("\r");

	expect(foldTags(manager.getEntries() as unknown as TagEntry[])).toEqual([]);
});

test("escape through the real handler closes without writing anything", async () => {
	const manager = buildSession(3);
	const harness: OverlayHarness = { component: undefined, notices: [] };
	await extension.commandHandler("tag")("CHECKPOINT", commandContext(manager, harness) as never);

	harness.component?.handleInput("\x1b");

	expect(manager.getEntries().some((entry) => entry.type === "custom")).toBe(false);
});
