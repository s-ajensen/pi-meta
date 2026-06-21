import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ELIDED_TYPE, runElideTool } from "./ops.ts";
import { makeElidedRenderer } from "./render.ts";
import { isMetaSession } from "./meta-session.ts";
import { reconcileToolActivation } from "./tool-activation.ts";
import { runMetaCommand, runBackCommand } from "./commands.ts";

const ELIDE_TOOL = "elide_regions";

function scopeToolToMetaSessions(pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		const isMeta = isMetaSession(ctx.sessionManager);
		pi.setActiveTools(reconcileToolActivation(pi.getActiveTools(), isMeta, ELIDE_TOOL));
	});
}

function registerElideTool(pi: ExtensionAPI) {
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
}

export default function (pi: ExtensionAPI) {
	pi.registerMessageRenderer(ELIDED_TYPE, makeElidedRenderer() as never);
	scopeToolToMetaSessions(pi);
	registerElideTool(pi);
	pi.registerCommand("meta", {
		description: "Open/resume a linked meta session to discuss & elide this session",
		handler: runMetaCommand as never,
	});
	pi.registerCommand("back", {
		description: "From a meta session, switch back to its target session",
		handler: runBackCommand as never,
	});
}
