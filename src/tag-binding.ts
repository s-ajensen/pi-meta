import { mergeDefinitions, type TagDefinitions } from "./definitions.ts";
import { loadDefinitions, type DefinitionFileIO } from "./definition-store.ts";
import { workspaceTagsPath, globalTagsPath } from "./tag-paths.ts";
import { foldTags, type AppliedTag, type TagEntry } from "./tags.ts";
import { buildRows } from "./tag-render.ts";
import type { SelectionRow } from "./selection.ts";

export function resolveDefinitions(io: DefinitionFileIO, cwd: string, home: string): TagDefinitions {
	const global = loadDefinitions(io, globalTagsPath(home));
	const workspace = loadDefinitions(io, workspaceTagsPath(cwd));
	return mergeDefinitions(global, workspace);
}

export function isTagDefined(io: DefinitionFileIO, cwd: string, home: string, tag: string): boolean {
	return tag in resolveDefinitions(io, cwd, home);
}

export interface OverlayData {
	rows: SelectionRow[];
	applied: AppliedTag[];
}

export function buildOverlayData(branch: TagEntry[], log: TagEntry[]): OverlayData {
	const applied = foldTags(log);
	return { rows: buildRows(branch, applied), applied };
}
