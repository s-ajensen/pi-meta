import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ELIDED_TYPE, runElideTool } from "./ops.ts";
import { runApplyTagsTool } from "./tag-ops.ts";
import { runMoveTool } from "./move-ops.ts";
import { reconcileSkillTags } from "./auto-tag.ts";
import { foldTags, TAG_TYPE, type TagEntry } from "./tags.ts";
import { makeElidedRenderer } from "./render.ts";
import { isMetaSession } from "./meta-session.ts";
import { reconcileToolActivation } from "./tool-activation.ts";
import { runMetaCommand, runBackCommand } from "./commands.ts";
import { runTagCommandBound } from "./tag-command-binding.ts";

const ELIDE_TOOL = "elide_regions";
const APPLY_TAGS_TOOL = "apply_tags";
const MOVE_TOOL = "move_region";
const META_TOOLS = [ELIDE_TOOL, APPLY_TAGS_TOOL, MOVE_TOOL];

const tagRecordSchema = Type.Object({
	op: Type.Union([Type.Literal("apply"), Type.Literal("retract")]),
	tag: Type.String({ description: "Tag definition name, uppercase by convention." }),
	target: Type.String({ description: "On-disk entry id of the message being tagged." }),
	by: Type.Literal("meta"),
});

function scopeToolsToMetaSessions(pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		const isMeta = isMetaSession(ctx.sessionManager);
		pi.setActiveTools(reconcileToolActivation(pi.getActiveTools(), isMeta, META_TOOLS));
	});
}

function armAutoTagger(pi: ExtensionAPI) {
	pi.on("turn_end", async (_event, ctx) => {
		const branch = ctx.sessionManager.getBranch(ctx.sessionManager.getLeafId() ?? undefined) as TagEntry[];
		for (const record of reconcileSkillTags(branch, foldTags(ctx.sessionManager.getEntries() as TagEntry[]))) {
			pi.appendEntry(TAG_TYPE, record);
		}
	});
}

function registerTools(pi: ExtensionAPI) {
	pi.registerTool({
		name: ELIDE_TOOL,
		label: "Elide regions",
		description:
			"Collapse one or more contiguous runs of messages in the target session into " +
			"synopsis entries (non-destructive). See the `elision` skill for how to do it well.",
		promptGuidelines: [
			"Resolve every fromId/toId from a single fresh read of the target, and pass all regions in ONE call; ids from a stale read will not resolve after the first elision. Regions must not overlap.",
		],
		parameters: Type.Object({
			regions: Type.Array(
				Type.Object({
					fromId: Type.String({ description: "Entry id of the first message to elide (inclusive)." }),
					toId: Type.String({ description: "Entry id of the last message to elide (inclusive)." }),
					synopsis: Type.String({ description: "One-paragraph summary shown in place of this run." }),
				}),
				{ description: "The runs to elide, each identified by first/last message id." },
			),
		}),
		execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => runElideTool(params, ctx),
	});

	pi.registerTool({
		name: APPLY_TAGS_TOOL,
		label: "Apply tags",
		description:
			"Append tag apply/retract records to the target session (non-destructive, invisible to the " +
			"target model). See the `tags` skill; back-filled judgment tags are proposals to confirm.",
		promptGuidelines: [
			"Resolve every target id from a single fresh read of the current target. Batch all records in ONE call.",
		],
		parameters: Type.Object({
			records: Type.Array(tagRecordSchema, { description: "Tag apply/retract records to append." }),
		}),
		execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => runApplyTagsTool(params, ctx),
	});

	pi.registerTool({
		name: MOVE_TOOL,
		label: "Move region",
		description:
			"Reposition a contiguous run of the target's messages after another message (non-destructive, " +
			"branch-replay). See the `move` skill for the turn-group unit and cache doctrine.",
		promptGuidelines: [
			"Resolve from/to/after from a single fresh read. The run must be a whole turn-group; a move that severs a tool call from its result is rejected.",
		],
		parameters: Type.Object({
			from: Type.String({ description: "Entry id of the first message in the run (inclusive)." }),
			to: Type.String({ description: "Entry id of the last message in the run (inclusive)." }),
			after: Type.String({ description: "Entry id the run should render after." }),
		}),
		execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => runMoveTool(params, ctx),
	});
}

export default function (pi: ExtensionAPI) {
	pi.registerMessageRenderer(ELIDED_TYPE, makeElidedRenderer() as never);
	scopeToolsToMetaSessions(pi);
	armAutoTagger(pi);
	registerTools(pi);
	pi.registerCommand("meta", {
		description: "Open/resume a linked meta session to discuss & elide this session",
		handler: runMetaCommand as never,
	});
	pi.registerCommand("back", {
		description: "From a meta session, switch back to its target session",
		handler: runBackCommand as never,
	});
	pi.registerCommand("tag", {
		description: "Tag messages in this session (open a selection overlay); /tag def TYPE #HEX to define",
		handler: ((args: string, ctx: never) =>
			runTagCommandBound(args, ctx, (customType, data) => pi.appendEntry(customType, data))) as never,
	});
}
