import type { TagActor, TagData } from "./tags.ts";

export interface SelectionRow {
	id: string;
	role: string;
	text: string;
	tags: string[];
}

export interface SelectionState {
	rows: SelectionRow[];
	cursor: number;
}

export function createSelection(rows: SelectionRow[]): SelectionState {
	return { rows, cursor: rows.length - 1 };
}

export function moveCursor(state: SelectionState, delta: number): SelectionState {
	if (state.rows.length === 0) return state;
	const cursor = Math.min(state.rows.length - 1, Math.max(0, state.cursor + delta));
	return { ...state, cursor };
}

export function toggleAt(state: SelectionState, armedTag: string | undefined, by: TagActor = "user"): TagData | undefined {
	if (!armedTag) return undefined;
	const row = state.rows[state.cursor];
	if (!row) return undefined;
	const op = row.tags.includes(armedTag) ? "retract" : "apply";
	return { op, tag: armedTag, target: row.id, by };
}

function reflectToggle(row: SelectionRow, record: TagData): SelectionRow {
	const tags = record.op === "apply" ? [...row.tags, record.tag] : row.tags.filter((tag) => tag !== record.tag);
	return { ...row, tags };
}

export function applyToggle(
	state: SelectionState,
	armedTag: string | undefined,
	append: (record: TagData) => void,
): SelectionState {
	const record = toggleAt(state, armedTag);
	if (!record) return state;
	append(record);
	const rows = state.rows.map((row, index) => (index === state.cursor ? reflectToggle(row, record) : row));
	return { ...state, rows };
}
