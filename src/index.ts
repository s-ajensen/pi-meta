import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ELIDED_TYPE, openAndElide } from "./ops.ts";
import { makeElidedRenderer } from "./render.ts";
import { isMetaSession, resolveMetaTarget, findMetaChild, buildMetaSessionName, buildSeedPrompt } from "./meta-session.ts";

const ELIDE_TOOL = "elide_region";

type ToolResult = { content: { type: "text"; text: string }[]; isError: boolean };

function buildOkResult(text: string): ToolResult {
	return { content: [{ type: "text", text }], isError: false };
}

function buildErrorResult(text: string): ToolResult {
	return { content: [{ type: "text", text: `pi-meta: ${text}` }], isError: true };
}

function scopeToolToMetaSessions(pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		const active = new Set(pi.getActiveTools());
		if (isMetaSession(ctx.sessionManager)) {
			active.add(ELIDE_TOOL);
		} else {
			active.delete(ELIDE_TOOL);
		}
		pi.setActiveTools([...active]);
	});
}

function registerElideTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: ELIDE_TOOL,
		label: "Elide region",
		description:
			"Elide a contiguous run of messages in the TARGET session into a single " +
			"collapsed synopsis entry. Non-destructive (branches the append-only tree; " +
			"verbatim is preserved). Identify the run by the first and last message " +
			"entry `id` from the target's .jsonl.",
		promptGuidelines: [
			"Read the target session file to find message entry ids; confirm the region with the human before eliding.",
		],
		parameters: Type.Object({
			fromId: Type.String({ description: "Entry id of the first message to elide (inclusive)." }),
			toId: Type.String({ description: "Entry id of the last message to elide (inclusive)." }),
			synopsis: Type.String({ description: "One-paragraph summary shown in place of the elided run." }),
		}),
		execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
			const target = resolveMetaTarget(ctx.sessionManager);
			if (!target) return buildErrorResult("elide_region must be called from a meta session (no parent/target found).");

			const synopsis = params.synopsis?.trim();
			if (!synopsis) return buildErrorResult("synopsis must be a non-empty string.");

			try {
				return buildOkResult(openAndElide(target, { fromId: params.fromId, toId: params.toId, synopsis }));
			} catch (err) {
				return buildErrorResult(err instanceof Error ? err.message : String(err));
			}
		},
	});
}

function registerMetaCommand(pi: ExtensionAPI) {
	pi.registerCommand("meta", {
		description: "Open/resume a linked meta session to discuss & elide this session",
		handler: async (args, ctx) => {
			const target = ctx.sessionManager.getSessionFile();
			if (!target) {
				ctx.ui?.notify?.("No session file for the current session.", "warning");
				return;
			}

			const existing = await findMetaChild(ctx.cwd, target);
			if (existing) {
				await ctx.switchSession(existing);
				return;
			}

			await ctx.newSession({
				parentSession: target,
				setup: async (sessionManager) => {
					sessionManager.appendSessionInfo(buildMetaSessionName(target));
				},
				withSession: async (metaContext) => {
					await metaContext.sendUserMessage(buildSeedPrompt(target, args.trim()), { deliverAs: "followUp" });
				},
			});
		},
	});
}

function registerBackCommand(pi: ExtensionAPI) {
	pi.registerCommand("back", {
		description: "From a meta session, switch back to its target session",
		handler: async (_args, ctx) => {
			const target = resolveMetaTarget(ctx.sessionManager);
			if (!target) {
				ctx.ui?.notify?.("This is not a meta session (no target link found).", "warning");
				return;
			}
			await ctx.switchSession(target);
		},
	});
}

export default function (pi: ExtensionAPI) {
	pi.registerMessageRenderer(ELIDED_TYPE, makeElidedRenderer() as never);
	scopeToolToMetaSessions(pi);
	registerElideTool(pi);
	registerMetaCommand(pi);
	registerBackCommand(pi);
}
