import { buildRemap, resolveTerminalId, type RemapEntry } from "./remap.ts";

export const TAG_TYPE = "meta-tag";

export type TagOp = "apply" | "retract";
export type TagActor = "user" | "meta" | "auto";

export interface TagData {
	op: TagOp;
	tag: string;
	target: string;
	by: TagActor;
}

export interface TagEntry {
	id?: string;
	type: string;
	customType?: string;
	data?: TagData;
	message?: { role: string; content: unknown };
}

export interface AppliedTag {
	tag: string;
	target: string;
	by: TagActor;
}

function isTagEntry(entry: TagEntry): entry is TagEntry & { data: TagData } {
	return entry.type === "custom" && entry.customType === TAG_TYPE && !!entry.data;
}

function tagKey(tag: string, target: string): string {
	return `${target}\u0000${tag}`;
}

export function foldTags(entries: TagEntry[]): AppliedTag[] {
	const remap = buildRemap(entries as unknown as RemapEntry[]);
	const applied = new Map<string, AppliedTag>();
	for (const entry of entries) {
		if (!isTagEntry(entry)) continue;
		const { op, tag, by } = entry.data;
		const target = resolveTerminalId(remap, entry.data.target);
		const key = tagKey(tag, target);
		if (op === "apply") applied.set(key, { tag, target, by });
		else applied.delete(key);
	}
	return [...applied.values()];
}

export function tagsForTarget(applied: AppliedTag[], target: string): AppliedTag[] {
	return applied.filter((entry) => entry.target === target);
}

export function resolveTag(entries: TagEntry[], tag: string): string[] {
	const targets = new Set(foldTags(entries).filter((entry) => entry.tag === tag).map((entry) => entry.target));
	return entries.filter((entry) => entry.type === "message" && entry.id !== undefined && targets.has(entry.id)).map((entry) => entry.id as string);
}
