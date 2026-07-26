import { parseDefCommand } from "./definitions.ts";

export interface TagCommandEffects {
	isDefined(tag: string): boolean;
	defineTag(tag: string, color: string, global: boolean): void;
	openOverlay(armedTag: string | undefined): void;
	listDefinitions(): void;
	promptForColor(tag: string): Promise<string | undefined>;
	notify(message: string): void;
}

async function runDefSubcommand(rest: string, effects: TagCommandEffects): Promise<void> {
	try {
		const { tag, color, global } = parseDefCommand(rest);
		effects.defineTag(tag, color, global);
	} catch (err) {
		effects.notify(err instanceof Error ? err.message : String(err));
	}
}

async function armTag(tag: string, effects: TagCommandEffects): Promise<void> {
	if (!effects.isDefined(tag)) {
		const color = await effects.promptForColor(tag);
		if (color === undefined) return;
		try {
			effects.defineTag(tag, color, false);
		} catch (err) {
			effects.notify(err instanceof Error ? err.message : String(err));
			return;
		}
	}
	effects.openOverlay(tag);
}

export async function runTagCommand(args: string, effects: TagCommandEffects): Promise<void> {
	const trimmed = args.trim();
	if (trimmed === "") {
		effects.listDefinitions();
		effects.openOverlay(undefined);
		return;
	}
	const [head, ...rest] = trimmed.split(/\s+/);
	if (head === "def") {
		await runDefSubcommand(rest.join(" "), effects);
		return;
	}
	await armTag(head, effects);
}
