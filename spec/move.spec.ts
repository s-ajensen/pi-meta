import { test, expect } from "bun:test";
import { planMove } from "../src/move.ts";

function messages(...ids: string[]) {
	return ids.map((id) => ({ id, type: "message", message: { role: "user", content: id } }));
}

function toolCall(id: string, callId: string) {
	return { id, type: "message", message: { role: "assistant", content: [{ type: "toolCall", id: callId }] } };
}

function toolResult(id: string, callId: string) {
	return { id, type: "message", message: { role: "toolResult", toolCallId: callId, content: [] } };
}

function tailIds(plan: { tail: { message: { id: string } }[] }) {
	return plan.tail.map((step) => step.message.id);
}

test("an unresolvable run anchor rejects the move", () => {
	const branch = messages("m0", "m1", "m2");
	expect(() => planMove(branch, { from: "m1", to: "ghost", after: "m2" })).toThrow("could not resolve");
});

test("an unresolvable destination anchor rejects the move", () => {
	const branch = messages("m0", "m1", "m2");
	expect(() => planMove(branch, { from: "m1", to: "m1", after: "ghost" })).toThrow("could not resolve");
});

test("a run whose toId precedes its fromId is rejected", () => {
	const branch = messages("m0", "m1", "m2", "m3");
	expect(() => planMove(branch, { from: "m3", to: "m1", after: "m0" })).toThrow("precedes");
});

test("a destination inside the moved run is rejected", () => {
	const branch = messages("m0", "m1", "m2", "m3");
	expect(() => planMove(branch, { from: "m1", to: "m3", after: "m2" })).toThrow("inside the moved run");
});

test("a destination immediately before the run is a no-op and rejected", () => {
	const branch = messages("m0", "m1", "m2", "m3");
	expect(() => planMove(branch, { from: "m2", to: "m3", after: "m1" })).toThrow("no-op");
});

test("a move that severs a tool call from its result is rejected", () => {
	const branch = [messages("m0")[0], toolCall("m1", "c1"), toolResult("m2", "c1"), messages("m3")[0]];
	expect(() => planMove(branch, { from: "m1", to: "m1", after: "m3" })).toThrow("severs");
});

test("moving a run later reorders the tail and anchors the branch at the run's start", () => {
	const branch = messages("m0", "m1", "m2", "m3", "m4");
	const plan = planMove(branch, { from: "m1", to: "m1", after: "m3" });
	expect(plan.branchPointId).toBe("m0");
	expect(tailIds(plan)).toEqual(["m2", "m3", "m1", "m4"]);
});

test("moving a run earlier reorders the tail and anchors the branch after the destination", () => {
	const branch = messages("m0", "m1", "m2", "m3", "m4");
	const plan = planMove(branch, { from: "m3", to: "m4", after: "m0" });
	expect(plan.branchPointId).toBe("m0");
	expect(tailIds(plan)).toEqual(["m3", "m4", "m1", "m2"]);
});

test("moving a multi-message run to the tail preserves its internal order", () => {
	const branch = messages("m0", "m1", "m2", "m3", "m4");
	const plan = planMove(branch, { from: "m1", to: "m2", after: "m4" });
	expect(plan.branchPointId).toBe("m0");
	expect(tailIds(plan)).toEqual(["m3", "m4", "m1", "m2"]);
});

test("moving a whole tool-call/result pair together is allowed", () => {
	const branch = [messages("m0")[0], toolCall("m1", "c1"), toolResult("m2", "c1"), messages("m3")[0]];
	const plan = planMove(branch, { from: "m1", to: "m2", after: "m3" });
	expect(tailIds(plan)).toEqual(["m3", "m1", "m2"]);
});
