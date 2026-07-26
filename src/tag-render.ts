import { flattenContent } from "./render.ts";
import { resolveColor, type TagDefinitions } from "./definitions.ts";
import { tagsForTarget, type AppliedTag, type TagEntry } from "./tags.ts";
import type { SelectionRow } from "./selection.ts";
import { roleColor, IDENTITY_PALETTE, type Palette } from "./palette.ts";
import { visibleWidth } from "@earendil-works/pi-tui";

const RESET = "\x1b[0m";
const CURSOR_MARK = "›";
const DEFAULT_ROW_WIDTH = 120;
const MARKER_COLUMNS = 2;

export function hexToAnsi(hex: string): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return `\x1b[38;2;${r};${g};${b}m`;
}

export function buildRows(branch: TagEntry[], applied: AppliedTag[]): SelectionRow[] {
	return branch
		.filter((entry) => entry.type === "message" && entry.id !== undefined)
		.map((entry) => ({
			id: entry.id as string,
			role: entry.message?.role ?? "unknown",
			text: flattenContent(entry.message?.content).replace(/\s+/g, " ").trim(),
			tags: tagsForTarget(applied, entry.id as string).map((tag) => tag.tag),
		}));
}

function provenanceMark(by: AppliedTag["by"]): string {
	return by === "user" ? "" : `·${by}`;
}

function renderTag(tag: AppliedTag, definitions: TagDefinitions): string {
	return `${hexToAnsi(resolveColor(definitions, tag.tag))}${tag.tag}${provenanceMark(tag.by)}${RESET}`;
}

export function renderTagLine(tags: AppliedTag[], definitions: TagDefinitions): string {
	if (tags.length === 0) return "";
	return tags.map((tag) => renderTag(tag, definitions)).join(" ");
}

function truncateToWidth(text: string, width: number): string {
	if (width <= 0) return "";
	if (visibleWidth(text) <= width) return text;
	return `${text.slice(0, Math.max(0, width - 1))}…`;
}

export function renderRow(
	row: SelectionRow,
	isCursor: boolean,
	palette: Palette = IDENTITY_PALETTE,
	width: number = DEFAULT_ROW_WIDTH,
): string {
	const marker = isCursor ? palette("accent", CURSOR_MARK) : " ";
	const prefix = `${row.role}: `;
	const available = Math.max(0, width - MARKER_COLUMNS);
	const plain = truncateToWidth(`${prefix}${row.text}`, available);
	const shownPrefix = plain.slice(0, Math.min(prefix.length, plain.length));
	const shownBody = plain.slice(shownPrefix.length);
	return `${marker} ${palette(roleColor(row.role), shownPrefix)}${shownBody}`;
}
