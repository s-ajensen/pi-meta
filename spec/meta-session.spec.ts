import { test, expect } from "bun:test";
import {
	buildMetaSessionName,
	buildSeedPrompt,
	isMetaSession,
	resolveMetaTarget,
	selectMetaChild,
	type SessionCandidate,
} from "../src/meta-session.ts";

test("the seed prompt states the meta channel's purpose and names the target", () => {
	const prompt = buildSeedPrompt("/proj/abc/target.jsonl");
	expect(prompt).toContain("/proj/abc/target.jsonl");
	expect(prompt.toLowerCase()).toContain("reason about the target");
	expect(prompt.toLowerCase()).toContain("pollute");
});

test("the seed prompt lists example uses without privileging elision", () => {
	const prompt = buildSeedPrompt("/t.jsonl");
	expect(prompt.toLowerCase()).toContain("harness");
	expect(prompt.toLowerCase()).toContain("mine");
});

test("the seed prompt injects the meta_skills block", () => {
	const prompt = buildSeedPrompt("/t.jsonl");
	expect(prompt).toContain("<meta_skills>");
	expect(prompt).toContain("<name>elision</name>");
});

test("the seed prompt tells the human how to return", () => {
	expect(buildSeedPrompt("/t.jsonl")).toContain("/back");
});

test("a meta session name is the marker prefix plus the target's base name", () => {
	expect(buildMetaSessionName("/home/me/.pi/sessions/abc/sess.jsonl")).toBe("meta: sess.jsonl");
});

test("a marked session with a parent is a meta session", () => {
	expect(
		isMetaSession({
			getSessionName: () => "meta: sess.jsonl",
			getHeader: () => ({ parentSession: "/path/target.jsonl" }),
		}),
	).toBe(true);
});

test("a marked session without a parent is not a meta session", () => {
	expect(
		isMetaSession({ getSessionName: () => "meta: notes", getHeader: () => ({}) }),
	).toBe(false);
	expect(isMetaSession({ getSessionName: () => "meta: notes" })).toBe(false);
});

test("a parented session with an ordinary name is not a meta session", () => {
	expect(
		isMetaSession({ getSessionName: () => "some work", getHeader: () => ({ parentSession: "/p.jsonl" }) }),
	).toBe(false);
});

test("a session with no name is not a meta session", () => {
	expect(isMetaSession({ getSessionName: () => undefined })).toBe(false);
	expect(isMetaSession({})).toBe(false);
});

test("the meta target is the parent session recorded in the header", () => {
	expect(resolveMetaTarget({ getHeader: () => ({ parentSession: "/path/parent.jsonl" }) })).toBe(
		"/path/parent.jsonl",
	);
});

test("a session with no parent has no meta target", () => {
	expect(resolveMetaTarget({ getHeader: () => ({}) })).toBeUndefined();
	expect(resolveMetaTarget({ getHeader: () => null })).toBeUndefined();
	expect(resolveMetaTarget({})).toBeUndefined();
});

const TARGET = "/sessions/proj/target.jsonl";

function candidate(overrides: Partial<SessionCandidate>): SessionCandidate {
	return { path: "/sessions/proj/other.jsonl", parentSessionPath: undefined, name: undefined, ...overrides };
}

test("selectMetaChild picks the marked child whose parent is the target", () => {
	const candidates = [
		candidate({ path: "/sessions/proj/meta.jsonl", parentSessionPath: TARGET, name: "meta: target.jsonl" }),
	];
	expect(selectMetaChild(candidates, TARGET)).toBe("/sessions/proj/meta.jsonl");
});

test("selectMetaChild ignores a child of the target that is not marked as meta", () => {
	const candidates = [candidate({ path: "/sessions/proj/fork.jsonl", parentSessionPath: TARGET, name: "a fork" })];
	expect(selectMetaChild(candidates, TARGET)).toBeUndefined();
});

test("selectMetaChild ignores a meta-named session whose parent is a different target", () => {
	const candidates = [
		candidate({ path: "/sessions/proj/meta.jsonl", parentSessionPath: "/other.jsonl", name: "meta: other.jsonl" }),
	];
	expect(selectMetaChild(candidates, TARGET)).toBeUndefined();
});

test("selectMetaChild matches the target regardless of trailing slashes", () => {
	const candidates = [
		candidate({ path: "/sessions/proj/meta.jsonl", parentSessionPath: `${TARGET}/`, name: "meta: target.jsonl" }),
	];
	expect(selectMetaChild(candidates, TARGET)).toBe("/sessions/proj/meta.jsonl");
});

test("selectMetaChild returns the first match when several meta children exist", () => {
	const candidates = [
		candidate({ path: "/sessions/proj/meta-a.jsonl", parentSessionPath: TARGET, name: "meta: target.jsonl" }),
		candidate({ path: "/sessions/proj/meta-b.jsonl", parentSessionPath: TARGET, name: "meta: target.jsonl" }),
	];
	expect(selectMetaChild(candidates, TARGET)).toBe("/sessions/proj/meta-a.jsonl");
});

test("selectMetaChild returns undefined when there are no candidates", () => {
	expect(selectMetaChild([], TARGET)).toBeUndefined();
});
