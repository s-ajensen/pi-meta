import type { AppliedTag, TagData } from "./tags.ts";

const SKILL_TAG = "SKILL";
const SKILL_PATH_SUFFIX = "/SKILL.md";

interface ContentBlock {
	type?: string;
	id?: string;
	name?: string;
	arguments?: { path?: unknown };
}

export interface ReconcileEntry {
	id?: string;
	type: string;
	message?: { role: string; content: unknown; toolCallId?: string };
}

function readsSkillFile(block: ContentBlock): boolean {
	if (block.type !== "toolCall" || block.name !== "read") return false;
	const path = block.arguments?.path;
	return typeof path === "string" && path.endsWith(SKILL_PATH_SUFFIX);
}

function skillCallIds(branch: ReconcileEntry[]): Set<string> {
	const ids = new Set<string>();
	for (const entry of branch) {
		const content = entry.message?.content;
		if (!Array.isArray(content)) continue;
		for (const block of content as ContentBlock[]) {
			if (readsSkillFile(block) && typeof block.id === "string") ids.add(block.id);
		}
	}
	return ids;
}

function alreadyTagged(applied: AppliedTag[]): Set<string> {
	return new Set(applied.filter((tag) => tag.tag === SKILL_TAG).map((tag) => tag.target));
}

export function reconcileSkillTags(branch: ReconcileEntry[], applied: AppliedTag[]): TagData[] {
	const skillCalls = skillCallIds(branch);
	const tagged = alreadyTagged(applied);
	const records: TagData[] = [];
	for (const entry of branch) {
		const answeredCallId = entry.message?.toolCallId;
		if (!answeredCallId || !skillCalls.has(answeredCallId)) continue;
		if (entry.id === undefined || tagged.has(entry.id)) continue;
		records.push({ op: "apply", tag: SKILL_TAG, target: entry.id, by: "auto" });
	}
	return records;
}
