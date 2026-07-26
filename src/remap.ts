export const REMAP_TYPE = "meta-remap";

export interface RemapData {
	op: "remap";
	map: Record<string, string>;
}

export interface RemapEntry {
	type: string;
	customType?: string;
	data?: RemapData;
}

export type Remap = Map<string, string>;

function isRemapEntry(entry: RemapEntry): entry is RemapEntry & { data: RemapData } {
	return entry.type === "custom" && entry.customType === REMAP_TYPE && !!entry.data?.map;
}

export function buildRemap(entries: RemapEntry[]): Remap {
	const remap: Remap = new Map();
	for (const entry of entries) {
		if (!isRemapEntry(entry)) continue;
		for (const [oldId, newId] of Object.entries(entry.data.map)) {
			remap.set(oldId, newId);
		}
	}
	return remap;
}

export interface RemapRecorder {
	record(oldId: string, newId: string): void;
	flush(): void;
}

export function createRemapRecorder(session: { appendCustomEntry(customType: string, data?: unknown): string }): RemapRecorder {
	const map: Record<string, string> = {};
	return {
		record(oldId, newId) {
			if (oldId !== newId) map[oldId] = newId;
		},
		flush() {
			if (Object.keys(map).length > 0) session.appendCustomEntry(REMAP_TYPE, { op: "remap", map });
		},
	};
}

export function resolveTerminalId(remap: Remap, id: string): string {
	const seen = new Set<string>([id]);
	let current = id;
	while (true) {
		const next = remap.get(current);
		if (next === undefined || seen.has(next)) return current;
		seen.add(next);
		current = next;
	}
}
