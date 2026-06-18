/**
 * pi-meta — a conversational meta-channel for pi.
 *
 * Two commands, one meta-scoped tool, one renderer, one scoping guard:
 *
 *  /meta [task]   (target session) → open/resume a linked child "meta" session
 *                  to discuss what to elide. Link is native (parentSession).
 *  /back          (meta session)   → PURE NAVIGATION back to the target. Elisions
 *                  were already applied at tool-call time; nothing to consume.
 *  elide_region   (tool, meta only) → opens the target file via the SDK
 *                  SessionManager, validates the region, and applies a branch-
 *                  elision directly to disk. No payload travels between sessions.
 *  meta-elided    (renderer)        → collapsed synopsis banner / expanded greyed
 *                  verbatim.
 *  session_start  (guard)           → activates elide_region ONLY in meta
 *                  sessions; strips it everywhere else, authoritatively, on every
 *                  session start (defeats active-tool carry-forward).
 *
 * Eliding is append-only branching: the record is never overwritten. The LLM
 * sees the synopsis (entry content); the verbatim lives in details (never sent).
 * No sidecar — all links are pi-native.
 */

import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ELIDED_TYPE, openAndElide } from "./ops.ts";
import { makeElidedRenderer } from "./render.ts";
import {
	isMetaSession,
	targetOfMeta,
	findMetaChild,
	metaSessionName,
	seedPrompt,
} from "./meta-session.ts";

const ELIDE_TOOL = "elide_region";

export default function (pi: ExtensionAPI) {
	// ---- Renderer (registered globally; only fires for meta-elided entries) ----
	pi.registerMessageRenderer(ELIDED_TYPE, makeElidedRenderer() as never);

	// ---- Tool-scoping guard: recompute active tools on EVERY session start -----
	pi.on("session_start", async (_event, ctx) => {
		const active = new Set(ctx.getActiveTools());
		if (isMetaSession(ctx.sessionManager)) {
			active.add(ELIDE_TOOL);
		} else {
			active.delete(ELIDE_TOOL); // authoritative strip — defeats carry-forward
		}
		ctx.setActiveTools([...active]);
	});

	// ---- The meta-scoped elision tool ------------------------------------------
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
			const target = targetOfMeta(ctx.sessionManager);
			if (!target) {
				return errorResult("elide_region must be called from a meta session (no parent/target found).");
			}
			const synopsis = params.synopsis?.trim();
			if (!synopsis) {
				return errorResult("synopsis must be a non-empty string.");
			}
			try {
				const msg = openAndElide(target, { fromId: params.fromId, toId: params.toId, synopsis });
				return okResult(msg);
			} catch (err) {
				return errorResult(err instanceof Error ? err.message : String(err));
			}
		},
	});

	// ---- /meta : open or resume the linked meta session ------------------------
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
				setup: async (sm) => {
					sm.appendSessionInfo(metaSessionName(target));
				},
				withSession: async (mctx) => {
					await mctx.sendUserMessage(seedPrompt(target, args.trim()), { deliverAs: "followUp" });
				},
			});
		},
	});

	// ---- /back : pure navigation back to the target ----------------------------
	pi.registerCommand("back", {
		description: "From a meta session, switch back to its target session",
		handler: async (_args, ctx) => {
			const target = targetOfMeta(ctx.sessionManager);
			if (!target) {
				ctx.ui?.notify?.("This is not a meta session (no target link found).", "warning");
				return;
			}
			await ctx.switchSession(target);
		},
	});
}

function okResult(text: string) {
	return { content: [{ type: "text" as const, text }], isError: false };
}
function errorResult(text: string) {
	return { content: [{ type: "text" as const, text: `pi-meta: ${text}` }], isError: true };
}
