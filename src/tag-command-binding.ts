import { homedir } from "node:os";
import { runTagCommand, type TagCommandEffects } from "./tag-command.ts";
import { resolveDefinitions, isTagDefined, buildOverlayData } from "./tag-binding.ts";
import { upsertDefinition } from "./definition-store.ts";
import { definitionFileIO } from "./definition-fs.ts";
import { definitionPath } from "./tag-paths.ts";
import { TagOverlayComponent } from "./tag-overlay.ts";
import { buildPalette } from "./palette.ts";
import { TAG_TYPE, type TagData, type TagEntry } from "./tags.ts";

export function readTerminalRows(tui: unknown): number | undefined {
	const rows = (tui as { terminal?: { rows?: unknown } } | undefined)?.terminal?.rows;
	return typeof rows === "number" && rows > 0 ? rows : undefined;
}

interface TagCommandContext {
	cwd: string;
	ui: {
		custom<T>(factory: (tui: unknown, theme: unknown, keybindings: unknown, done: (result: T) => void) => unknown, options?: unknown): Promise<T>;
		input(title: string, placeholder?: string): Promise<string | undefined>;
		notify(message: string, type?: string): void;
	};
	sessionManager: {
		getBranch: (fromId?: string) => TagEntry[];
		getEntries: () => TagEntry[];
		getLeafId: () => string | null;
	};
}

export type AppendEntry = (customType: string, data?: unknown) => void;

function bindEffects(ctx: TagCommandContext, home: string, appendEntry: AppendEntry): TagCommandEffects {
	return {
		isDefined: (tag) => isTagDefined(definitionFileIO, ctx.cwd, home, tag),
		defineTag: (tag, color, global) => upsertDefinition(definitionFileIO, definitionPath(ctx.cwd, home, global), tag, color),
		listDefinitions: () => {},
		notify: (message) => ctx.ui.notify(message, "warning"),
		promptForColor: (tag) => ctx.ui.input(`Color for ${tag} (#RRGGBB)`, "#7a7a7a"),
		openOverlay: (armedTag) => void openOverlay(ctx, home, armedTag, appendEntry),
	};
}

async function openOverlay(
	ctx: TagCommandContext,
	home: string,
	armedTag: string | undefined,
	appendEntry: AppendEntry,
): Promise<void> {
	const branch = ctx.sessionManager.getBranch(ctx.sessionManager.getLeafId() ?? undefined);
	const { rows, applied } = buildOverlayData(branch, ctx.sessionManager.getEntries());
	const definitions = resolveDefinitions(definitionFileIO, ctx.cwd, home);
	const append = (record: TagData) => appendEntry(TAG_TYPE, record);
	await ctx.ui.custom<void>(
		(tui, theme, _keybindings, done) =>
			new TagOverlayComponent({
				rows,
				applied,
				definitions,
				armedTag,
				append,
				done,
				tui: tui as never,
				terminalRows: readTerminalRows(tui),
				palette: buildPalette(theme),
			}) as never,
		{ overlay: true, overlayOptions: { width: "100%", maxHeight: "95%", anchor: "center", margin: 0 } },
	);
}

export async function runTagCommandBound(
	args: string,
	ctx: TagCommandContext,
	appendEntry: AppendEntry,
): Promise<void> {
	await runTagCommand(args, bindEffects(ctx, homedir(), appendEntry));
}
