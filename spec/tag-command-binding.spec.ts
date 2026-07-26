import { test, expect } from "bun:test";
import { runTagCommandBound } from "../src/tag-command-binding.ts";
import type { TagData } from "../src/tags.ts";

interface Recorder {
	appended: TagData[];
	overlays: number;
	notices: string[];
}

function commandContext(recorder: Recorder) {
	return {
		cwd: "/ws",
		ui: {
			custom: async <T>(factory: (tui: unknown, theme: unknown, kb: unknown, done: (r: T) => void) => unknown) => {
				recorder.overlays++;
				factory({}, undefined, {}, () => {});
				return undefined as T;
			},
			input: async () => undefined,
			notify: (message: string) => void recorder.notices.push(message),
		},
		sessionManager: {
			getBranch: () => [],
			getEntries: () => [],
			getLeafId: () => null,
		},
	};
}

function recorder(): Recorder {
	return { appended: [], overlays: 0, notices: [] };
}

test("the overlay opens against a context that has no appendEntry of its own", async () => {
	const calls = recorder();
	const ctx = commandContext(calls);

	await runTagCommandBound("", ctx as never, (customType, data) => {
		calls.appended.push(data as TagData);
	});

	expect(calls.overlays).toBe(1);
});

test("appending is routed through the injected writer, not the command context", async () => {
	const calls = recorder();
	const ctx = commandContext(calls) as Record<string, unknown>;
	expect(ctx.appendEntry).toBeUndefined();

	let captured: ((record: TagData) => void) | undefined;
	const originalCustom = (ctx.ui as { custom: unknown }).custom;
	void originalCustom;
	(ctx.ui as { custom: unknown }).custom = async (
		factory: (tui: unknown, theme: unknown, kb: unknown, done: (r: unknown) => void) => unknown,
	) => {
		const component = factory({}, undefined, {}, () => {}) as { options?: { append?: (r: TagData) => void } };
		captured = component.options?.append;
		return undefined;
	};

	await runTagCommandBound("", ctx as never, (_customType, data) => {
		calls.appended.push(data as TagData);
	});

	captured?.({ op: "apply", tag: "CHECKPOINT", target: "e1", by: "user" });
	expect(calls.appended).toEqual([{ op: "apply", tag: "CHECKPOINT", target: "e1", by: "user" }]);
});
