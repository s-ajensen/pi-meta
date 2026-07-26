import { test, expect } from "bun:test";
import { runTagCommand, type TagCommandEffects } from "../src/tag-command.ts";

function effects(overrides: Partial<TagCommandEffects> = {}) {
	const calls = {
		defined: [] as { tag: string; color: string; global: boolean }[],
		opened: [] as { armedTag: string | undefined }[],
		listed: 0,
		notes: [] as string[],
		prompted: [] as string[],
	};
	const base: TagCommandEffects = {
		isDefined: () => true,
		defineTag: (tag, color, global) => void calls.defined.push({ tag, color, global }),
		openOverlay: (armedTag) => void calls.opened.push({ armedTag }),
		listDefinitions: () => void calls.listed++,
		promptForColor: async (tag) => (calls.prompted.push(tag), "#abcdef"),
		notify: (message) => void calls.notes.push(message),
	};
	return { calls, effects: { ...base, ...overrides } };
}

test("bare /tag lists definitions and opens the browse overlay with nothing armed", async () => {
	const { calls, effects: e } = effects();
	await runTagCommand("", e);
	expect(calls.listed).toBe(1);
	expect(calls.opened).toEqual([{ armedTag: undefined }]);
});

test("/tag def writes the parsed definition and opens no overlay", async () => {
	const { calls, effects: e } = effects();
	await runTagCommand("def REGRESSION #e05252", e);
	expect(calls.defined).toEqual([{ tag: "REGRESSION", color: "#e05252", global: false }]);
	expect(calls.opened).toEqual([]);
});

test("/tag def --global marks the definition global", async () => {
	const { calls, effects: e } = effects();
	await runTagCommand("def REGRESSION #e05252 --global", e);
	expect(calls.defined[0].global).toBe(true);
});

test("/tag def with a malformed color notifies and defines nothing", async () => {
	const { calls, effects: e } = effects();
	await runTagCommand("def REGRESSION #ff", e);
	expect(calls.defined).toEqual([]);
	expect(calls.notes[0]).toContain("hex");
});

test("/tag TYPE for a defined tag opens the overlay armed with that tag", async () => {
	const { calls, effects: e } = effects();
	await runTagCommand("CHECKPOINT", e);
	expect(calls.opened).toEqual([{ armedTag: "CHECKPOINT" }]);
});

test("/tag TYPE for an undefined tag prompts for a color, defines it, then arms it", async () => {
	const { calls, effects: e } = effects({ isDefined: () => false });
	await runTagCommand("REGRESSION", e);
	expect(calls.prompted).toEqual(["REGRESSION"]);
	expect(calls.defined).toEqual([{ tag: "REGRESSION", color: "#abcdef", global: false }]);
	expect(calls.opened).toEqual([{ armedTag: "REGRESSION" }]);
});

test("a definition write failure is reported and arms nothing, rather than propagating", async () => {
	const { calls, effects: e } = effects({
		isDefined: () => false,
		defineTag: () => {
			throw new Error("EACCES: permission denied");
		},
	});
	await runTagCommand("REGRESSION", e);
	expect(calls.opened).toEqual([]);
	expect(calls.notes[0]).toContain("EACCES");
});

test("a def-subcommand write failure is reported rather than propagating", async () => {
	const { calls, effects: e } = effects({
		defineTag: () => {
			throw new Error("EACCES: permission denied");
		},
	});
	await runTagCommand("def REGRESSION #e05252", e);
	expect(calls.notes[0]).toContain("EACCES");
});

test("/tag TYPE for an undefined tag whose color prompt is cancelled arms nothing", async () => {
	const { calls, effects: e } = effects({ isDefined: () => false, promptForColor: async () => undefined });
	await runTagCommand("REGRESSION", e);
	expect(calls.defined).toEqual([]);
	expect(calls.opened).toEqual([]);
});
