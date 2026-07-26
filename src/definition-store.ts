import type { TagDefinitions } from "./definitions.ts";

export interface DefinitionFileIO {
	read(path: string): string | undefined;
	write(path: string, content: string): void;
}

export function loadDefinitions(io: DefinitionFileIO, path: string): TagDefinitions | undefined {
	const raw = io.read(path);
	if (raw === undefined) return undefined;
	try {
		return JSON.parse(raw) as TagDefinitions;
	} catch {
		return undefined;
	}
}

export function upsertDefinition(io: DefinitionFileIO, path: string, tag: string, color: string): void {
	const existing = loadDefinitions(io, path) ?? {};
	const next = { ...existing, [tag]: { color } };
	io.write(path, `${JSON.stringify(next, null, 2)}\n`);
}
