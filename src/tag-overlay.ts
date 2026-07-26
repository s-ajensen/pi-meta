import { Container, Text, TruncatedText, getKeybindings, type TUI } from "@earendil-works/pi-tui";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import type { TagDefinitions } from "./definitions.ts";
import type { TagData } from "./tags.ts";
import { createSelection, moveCursor, applyToggle, type SelectionRow, type SelectionState } from "./selection.ts";
import { hexToAnsi, renderTagLine, renderRow } from "./tag-render.ts";
import { tagsForTarget, type AppliedTag } from "./tags.ts";
import { windowRows } from "./viewport.ts";
import { IDENTITY_PALETTE, type Palette } from "./palette.ts";

const RESET = "\x1b[0m";

export interface TagOverlayOptions {
	rows: SelectionRow[];
	applied: AppliedTag[];
	definitions: TagDefinitions;
	armedTag: string | undefined;
	append: (record: TagData) => void;
	done: () => void;
	tui?: TUI;
	height?: number;
	terminalRows?: number;
	palette?: Palette;
}

export const MIN_WINDOW_HEIGHT = 4;
export const FALLBACK_WINDOW_HEIGHT = 20;
const PANEL_CHROME_ROWS = 6;
const ROW_PADDING_COLUMNS = 2;

export function resolveWindowHeight(terminalRows: number | undefined, explicit?: number): number {
	if (explicit !== undefined) return explicit;
	if (terminalRows === undefined) return FALLBACK_WINDOW_HEIGHT;
	return Math.max(MIN_WINDOW_HEIGHT, terminalRows - PANEL_CHROME_ROWS);
}
const DEFAULT_ROW_WIDTH = 80;

function requestRenderSafely(tui: TUI | undefined): void {
	const request = (tui as { requestRender?: () => void } | undefined)?.requestRender;
	if (typeof request !== "function") return;
	try {
		request.call(tui);
	} catch {
		return;
	}
}

function safePalette(palette: Palette | undefined): Palette {
	if (!palette) return IDENTITY_PALETTE;
	return (color, text) => {
		try {
			return palette(color, text);
		} catch {
			return text;
		}
	};
}

export function buildHeader(armedTag: string | undefined, definitions: TagDefinitions): string {
	const defined = Object.entries(definitions)
		.map(([tag, def]) => `${hexToAnsi(def.color)}${tag}${RESET}`)
		.join("  ");
	const mode = armedTag ? `tagging: ${armedTag}` : "browsing (no tag armed)";
	return defined ? `${mode}   ${defined}` : mode;
}

export function buildScrollNote(above: number, below: number): string {
	if (above === 0 && below === 0) return "";
	const parts: string[] = [];
	if (above > 0) parts.push(`▲ ${above} above`);
	if (below > 0) parts.push(`▼ ${below} below`);
	return parts.join("   ");
}

export class TagOverlayComponent extends Container {
	private state: SelectionState;
	readonly options: TagOverlayOptions;
	private readonly list = new Container();
	private readonly scrollNote = new Text("", 1, 0);
	private readonly palette: Palette;
	private readonly windowHeight: number;
	private lastWidth = DEFAULT_ROW_WIDTH;

	constructor(options: TagOverlayOptions) {
		super();
		this.options = options;
		this.state = createSelection(options.rows);
		this.palette = safePalette(options.palette);
		this.windowHeight = resolveWindowHeight(options.terminalRows, options.height);
		const border = (text: string) => this.palette("border", text);
		this.addChild(new DynamicBorder(border));
		this.addChild(new Text(buildHeader(options.armedTag, options.definitions), 1, 0));
		this.addChild(this.list);
		this.addChild(this.scrollNote);
		this.addChild(new Text(this.palette("dim", this.hintText()), 1, 0));
		this.addChild(new DynamicBorder(border));
		this.renderList();
	}

	private hintText(): string {
		const toggle = this.options.armedTag ? "enter toggle   " : "";
		return `↑↓ navigate   ${toggle}esc close`;
	}

	private appliedFor(target: string, tag: string): AppliedTag {
		return tagsForTarget(this.options.applied, target).find((entry) => entry.tag === tag) ?? { tag, target, by: "user" };
	}

	private renderList(width: number = this.lastWidth): void {
		this.lastWidth = width;
		this.list.clear();
		const rowWidth = Math.max(1, width - ROW_PADDING_COLUMNS);
		const { visible, start, more } = windowRows(this.state.rows, this.state.cursor, this.windowHeight);
		visible.forEach((row, offset) => {
			const tagLine = renderTagLine(
				row.tags.map((tag) => this.appliedFor(row.id, tag)),
				this.options.definitions,
			);
			if (tagLine) this.list.addChild(new TruncatedText(`   ${tagLine}`, 1, 0));
			const rendered = renderRow(row, start + offset === this.state.cursor, this.palette, rowWidth);
			this.list.addChild(new TruncatedText(rendered, 1, 0));
		});
		this.scrollNote.setText(this.palette("muted", buildScrollNote(more.above, more.below)));
	}

	render(width: number): string[] {
		if (width !== this.lastWidth) this.renderList(width);
		return super.render(width);
	}

	private refresh(): void {
		this.renderList();
		requestRenderSafely(this.options.tui);
	}

	handleInput(keyData: string): void {
		const keys = getKeybindings();
		if (keys.matches(keyData, "tui.select.cancel")) {
			this.options.done();
			return;
		}
		if (keys.matches(keyData, "tui.select.up")) {
			this.state = moveCursor(this.state, -1);
			this.refresh();
			return;
		}
		if (keys.matches(keyData, "tui.select.down")) {
			this.state = moveCursor(this.state, 1);
			this.refresh();
			return;
		}
		if (keys.matches(keyData, "tui.select.pageUp")) {
			this.state = moveCursor(this.state, -this.windowHeight);
			this.refresh();
			return;
		}
		if (keys.matches(keyData, "tui.select.pageDown")) {
			this.state = moveCursor(this.state, this.windowHeight);
			this.refresh();
			return;
		}
		if (keys.matches(keyData, "tui.select.confirm")) {
			this.state = applyToggle(this.state, this.options.armedTag, this.options.append);
			this.refresh();
		}
	}
}
