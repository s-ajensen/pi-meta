import { test, expect } from "bun:test";
import { runMetaCommand, runBackCommand } from "../src/commands.ts";

function recorder() {
	return {
		notifications: [] as { message: string; level: string }[],
		switchedTo: [] as string[],
		created: [] as { parentSession: string }[],
		seededNames: [] as string[],
		seededPrompts: [] as string[],
	};
}

function metaContext(calls: ReturnType<typeof recorder>, sessionManager: { getSessionFile: () => string | undefined }) {
	return {
		cwd: "/proj",
		sessionManager,
		ui: { notify: (message: string, level: string) => calls.notifications.push({ message, level }) },
		switchSession: async (path: string) => {
			calls.switchedTo.push(path);
		},
		newSession: async (options: {
			parentSession: string;
			setup: (sm: { appendSessionInfo: (n: string) => void }) => Promise<void>;
			withSession: (mc: { sendUserMessage: (c: string) => Promise<void> }) => Promise<void>;
		}) => {
			calls.created.push({ parentSession: options.parentSession });
			await options.setup({ appendSessionInfo: (name) => calls.seededNames.push(name) });
			await options.withSession({ sendUserMessage: async (content) => void calls.seededPrompts.push(content) });
		},
	};
}

test("/meta notifies and creates nothing when the current session has no file", async () => {
	const calls = recorder();
	await runMetaCommand("", metaContext(calls, { getSessionFile: () => undefined }));

	expect(calls.notifications[0]?.level).toBe("warning");
	expect(calls.created).toEqual([]);
	expect(calls.switchedTo).toEqual([]);
});

test("/meta creates a child meta session named for the target and seeds the prompt", async () => {
	const calls = recorder();
	await runMetaCommand("", metaContext(calls, { getSessionFile: () => "/proj/abc/target.jsonl" }));

	expect(calls.created).toEqual([{ parentSession: "/proj/abc/target.jsonl" }]);
	expect(calls.seededNames).toEqual(["meta: target.jsonl"]);
	expect(calls.seededPrompts[0]).toContain("/proj/abc/target.jsonl");
	expect(calls.switchedTo).toEqual([]);
});

test("/back switches to the target when called from a meta session", async () => {
	const calls = recorder();
	await runBackCommand("", {
		sessionManager: { getHeader: () => ({ parentSession: "/proj/target.jsonl" }) },
		ui: { notify: (message, level) => calls.notifications.push({ message, level }) },
		switchSession: async (path) => void calls.switchedTo.push(path),
	});

	expect(calls.switchedTo).toEqual(["/proj/target.jsonl"]);
});

test("/back notifies and does not switch when not in a meta session", async () => {
	const calls = recorder();
	await runBackCommand("", {
		sessionManager: { getHeader: () => ({}) },
		ui: { notify: (message, level) => calls.notifications.push({ message, level }) },
		switchSession: async (path) => void calls.switchedTo.push(path),
	});

	expect(calls.switchedTo).toEqual([]);
	expect(calls.notifications[0]?.level).toBe("warning");
});
