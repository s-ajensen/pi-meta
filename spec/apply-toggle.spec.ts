import { test, expect } from "bun:test";
import { applyToggle } from "../src/selection.ts";
import { createSelection } from "../src/selection.ts";
import type { TagData } from "../src/tags.ts";

function recorder() {
	const records: TagData[] = [];
	return { records, append: (record: TagData) => void records.push(record) };
}

test("toggling with no armed tag appends nothing and leaves state unchanged", () => {
	const rec = recorder();
	const state = createSelection([{ id: "e1", role: "user", text: "hi", tags: [] }]);
	const next = applyToggle(state, undefined, rec.append);
	expect(rec.records).toEqual([]);
	expect(next).toBe(state);
});

test("toggling an untagged row appends an apply and reflects the tag on the row", () => {
	const rec = recorder();
	const state = createSelection([{ id: "e1", role: "user", text: "hi", tags: [] }]);
	const next = applyToggle(state, "CHECKPOINT", rec.append);
	expect(rec.records).toEqual([{ op: "apply", tag: "CHECKPOINT", target: "e1", by: "user" }]);
	expect(next.rows[0].tags).toEqual(["CHECKPOINT"]);
});

test("toggling a tagged row appends a retract and drops the tag from the row", () => {
	const rec = recorder();
	const state = createSelection([{ id: "e1", role: "user", text: "hi", tags: ["CHECKPOINT"] }]);
	const next = applyToggle(state, "CHECKPOINT", rec.append);
	expect(rec.records).toEqual([{ op: "retract", tag: "CHECKPOINT", target: "e1", by: "user" }]);
	expect(next.rows[0].tags).toEqual([]);
});

test("the cursor is preserved across a toggle", () => {
	const rec = recorder();
	const state = createSelection([
		{ id: "e1", role: "user", text: "a", tags: [] },
		{ id: "e2", role: "user", text: "b", tags: [] },
	]);
	expect(applyToggle(state, "CHECKPOINT", rec.append).cursor).toBe(1);
});
