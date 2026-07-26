export const DEFAULT_TAG_COLOR = "#7a7a7a";

export interface TagDefinition {
	color: string;
}

export type TagDefinitions = Record<string, TagDefinition>;

export interface ParsedDefCommand {
	tag: string;
	color: string;
	global: boolean;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function mergeDefinitions(global: TagDefinitions | undefined, workspace: TagDefinitions | undefined): TagDefinitions {
	return { ...(global ?? {}), ...(workspace ?? {}) };
}

export function resolveColor(definitions: TagDefinitions, tag: string): string {
	return definitions[tag]?.color ?? DEFAULT_TAG_COLOR;
}

export function parseDefCommand(args: string): ParsedDefCommand {
	const tokens = args.trim().split(/\s+/).filter((token) => token.length > 0);
	const global = tokens.includes("--global");
	const rest = tokens.filter((token) => token !== "--global");
	if (rest.length < 2) {
		throw new Error("usage: /tag def TYPE #HEX [--global]");
	}
	const [tag, color] = rest;
	if (!HEX_COLOR.test(color)) {
		throw new Error(`invalid hex color "${color}" (expected #RRGGBB)`);
	}
	return { tag, color, global };
}
