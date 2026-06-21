import { test, expect } from "bun:test";
import { planElisions } from "../src/plan.ts";

function messages(...ids: string[]) {
	return ids.map((id) => ({ id, type: "message", message: { role: "user", content: id } }));
}

function toolCall(id: string, callId: string) {
	return { id, type: "message", message: { role: "assistant", content: [{ type: "toolCall", id: callId }] } };
}

function toolResult(id: string, callId: string) {
	return { id, type: "message", message: { role: "toolResult", toolCallId: callId, content: [] } };
}

test("a region that orphans a tool_result (its call is outside) is rejected", () => {
	const branch = [messages("m0")[0], toolCall("m1", "c1"), toolResult("m2", "c1"), messages("m3")[0]];
	expect(() => planElisions(branch, [{ fromId: "m2", toId: "m3", synopsis: "S" }])).toThrow(
		"tool",
	);
});

test("a region that orphans a tool_call (its result is outside) is rejected", () => {
	const branch = [messages("m0")[0], toolCall("m1", "c1"), toolResult("m2", "c1"), messages("m3")[0]];
	expect(() => planElisions(branch, [{ fromId: "m0", toId: "m1", synopsis: "S" }])).toThrow(
		"tool",
	);
});

test("a region that contains a whole tool call/result pair is allowed", () => {
	const branch = [messages("m0")[0], toolCall("m1", "c1"), toolResult("m2", "c1"), messages("m3")[0]];
	const plan = planElisions(branch, [{ fromId: "m1", toId: "m2", synopsis: "S" }]);
	expect(plan.branchPointId).toBe("m0");
	expect(plan.tail.filter((step) => step.kind === "elide")).toHaveLength(1);
});

test("eliding no regions is rejected", () => {
	const branch = messages("m0", "m1");
	expect(() => planElisions(branch, [])).toThrow("no regions");
});

test("a region with a blank synopsis is rejected", () => {
	const branch = messages("m0", "m1", "m2");
	expect(() => planElisions(branch, [{ fromId: "m1", toId: "m2", synopsis: "   " }])).toThrow(
		"synopsis",
	);
});

test("an unresolvable anchor rejects the whole plan", () => {
	const branch = messages("m0", "m1", "m2");
	expect(() => planElisions(branch, [{ fromId: "m1", toId: "ghost", synopsis: "S" }])).toThrow(
		"could not resolve elide region [m1..ghost]",
	);
});

test("a region whose toId precedes its fromId is rejected", () => {
	const branch = messages("m0", "m1", "m2", "m3");
	expect(() => planElisions(branch, [{ fromId: "m3", toId: "m1", synopsis: "S" }])).toThrow(
		"toId precedes fromId",
	);
});

test("overlapping regions are rejected", () => {
	const branch = messages("m0", "m1", "m2", "m3", "m4");
	expect(() =>
		planElisions(branch, [
			{ fromId: "m1", toId: "m3", synopsis: "A" },
			{ fromId: "m2", toId: "m4", synopsis: "B" },
		]),
	).toThrow("overlap");
});

test("a single region collapses into one elision anchored at the preceding message", () => {
	const branch = messages("m0", "m1", "m2", "m3", "m4");
	const plan = planElisions(branch, [{ fromId: "m1", toId: "m2", synopsis: "S" }]);

	expect(plan.branchPointId).toBe("m0");
	expect(plan.tail).toEqual([
		{ kind: "elide", synopsis: "S", elided: [branch[1], branch[2]] },
		{ kind: "keep", message: branch[3] },
		{ kind: "keep", message: branch[4] },
	]);
});

test("multiple regions collapse in one pass, keeping the messages between them", () => {
	const branch = messages("m0", "m1", "m2", "m3", "m4", "m5", "m6");
	const plan = planElisions(branch, [
		{ fromId: "m1", toId: "m2", synopsis: "A" },
		{ fromId: "m4", toId: "m5", synopsis: "B" },
	]);

	expect(plan.branchPointId).toBe("m0");
	expect(plan.tail).toEqual([
		{ kind: "elide", synopsis: "A", elided: [branch[1], branch[2]] },
		{ kind: "keep", message: branch[3] },
		{ kind: "elide", synopsis: "B", elided: [branch[4], branch[5]] },
		{ kind: "keep", message: branch[6] },
	]);
});

test("adjacent regions collapse into two separate elisions", () => {
	const branch = messages("m0", "m1", "m2", "m3", "m4");
	const plan = planElisions(branch, [
		{ fromId: "m1", toId: "m2", synopsis: "A" },
		{ fromId: "m3", toId: "m4", synopsis: "B" },
	]);

	expect(plan.branchPointId).toBe("m0");
	expect(plan.tail).toEqual([
		{ kind: "elide", synopsis: "A", elided: [branch[1], branch[2]] },
		{ kind: "elide", synopsis: "B", elided: [branch[3], branch[4]] },
	]);
});

test("regions given out of order are applied in branch order", () => {
	const branch = messages("m0", "m1", "m2", "m3", "m4", "m5");
	const plan = planElisions(branch, [
		{ fromId: "m4", toId: "m5", synopsis: "B" },
		{ fromId: "m1", toId: "m2", synopsis: "A" },
	]);

	expect(plan.branchPointId).toBe("m0");
	expect(plan.tail).toEqual([
		{ kind: "elide", synopsis: "A", elided: [branch[1], branch[2]] },
		{ kind: "keep", message: branch[3] },
		{ kind: "elide", synopsis: "B", elided: [branch[4], branch[5]] },
	]);
});
