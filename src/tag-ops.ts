import { SessionManager } from "@earendil-works/pi-coding-agent";
import { TAG_TYPE, type TagData } from "./tags.ts";
import { resolveMetaTarget } from "./meta-session.ts";
import { okResult, errorResult, type ToolResult } from "./tool-result.ts";

export interface TagSessionLike {
	appendCustomEntry(customType: string, data?: unknown): string;
}

export function appendTagRecords(session: TagSessionLike, records: TagData[]): void {
	for (const record of records) {
		session.appendCustomEntry(TAG_TYPE, record);
	}
}

export function applyTagsToTarget(targetPath: string, records: TagData[]): string {
	const target = SessionManager.open(targetPath) as unknown as TagSessionLike;
	appendTagRecords(target, records);
	const count = records.length;
	return `Applied ${count} tag ${count === 1 ? "record" : "records"} in target.`;
}

interface ApplyTagsContext {
	sessionManager: { getHeader?: () => { parentSession?: string } | null };
}

export function runApplyTagsTool(params: { records: TagData[] }, ctx: ApplyTagsContext): ToolResult {
	const target = resolveMetaTarget(ctx.sessionManager);
	if (!target) {
		return errorResult("apply_tags must be called from a meta session (no parent/target found).");
	}
	try {
		return okResult(applyTagsToTarget(target, params.records));
	} catch (err) {
		return errorResult(err instanceof Error ? err.message : String(err));
	}
}
