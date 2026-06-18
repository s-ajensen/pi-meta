/**
 * pi-meta — a conversational meta-channel for pi.
 *
 * Three surfaces, one auto-loaded extension:
 *
 *  1. `/meta [task]`  (run from a TARGET session)
 *       Opens — or resumes — a linked child "meta" session: a normal pi session
 *       whose job is to talk WITH you about the target session and decide what to
 *       elide from its view. Creates the link on first use, resumes it after.
 *
 *  2. `/back`  (run from a META session)
 *       Switches back to the target session this meta session belongs to.
 *
 *  3. context handler  (runs in EVERY session)
 *       In a target session, reads the sidecar and applies its `ops` to the
 *       in-flight message array (currently: `elide`). No sidecar / no ops -> the
 *       messages pass through untouched, so meta sessions and unrelated sessions
 *       are unaffected. The on-disk .jsonl is NEVER modified.
 *
 * State lives in two places, both inside the session ecosystem (no central
 * registry):
 *   - TARGET side: `<target>.jsonl.meta.json` sidecar -> { metaSession, ops }
 *   - META side:   a `meta-target` custom entry -> { targetSession } (reverse link)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readSidecar, patchSidecar, type MetaSidecar } from "./sidecar.ts";
import { applyOps } from "./ops.ts";

/** customType used for the reverse link entry stored in the meta session. */
const META_TARGET = "meta-target";

interface MetaTargetData {
	targetSession: string;
}

/** The seed prompt planted into a freshly-created meta session. Teaches the
 *  meta-agent its job, the sidecar contract, and the hard rule: never edit the
 *  target .jsonl. */
function seedPrompt(targetSession: string, sidecarPath: string, task: string): string {
	return [
		`You are the META thread for another pi session (the "target").`,
		``,
		`Target session log (read-only to you): ${targetSession}`,
		`Sidecar you will author:           ${sidecarPath}`,
		``,
		`Your job: help the human decide what to elide from the TARGET session's`,
		`VIEW — the messages its agent sees on each call. The on-disk log is the`,
		`durable record and must never be edited. Eliding is deprecation from view,`,
		`not deletion.`,
		``,
		`How to work:`,
		`1. Read the target .jsonl with your file tools. It is JSONL; each line is an`,
		`   entry { id, parentId, timestamp, type, message }. The messages that enter`,
		`   the LLM view are the type:"message" entries; each carries`,
		`   message.timestamp (epoch ms).`,
		`2. Discuss candidates with the human. Be specific about what stays and goes.`,
		`   Revise freely — this is a conversation.`,
		`3. When you agree, WRITE the sidecar as JSON of shape:`,
		`     { "ops": [ { "op": "elide", "from": <ms>, "to": <ms>,`,
		`                  "synopsis": "<one tight paragraph>" } ] }`,
		`   Use message.timestamp values for from/to (inclusive window). The window`,
		`   collapses to the synopsis in the target's view; everything in [from,to]`,
		`   is hidden there but preserved on disk.`,
		`   IMPORTANT: preserve the existing "metaSession" field if present — merge,`,
		`   do not clobber it. Only ever touch "ops". Never edit the target .jsonl.`,
		``,
		`The human's opening request: ${task || "(none given — ask what they want to elide.)"}`,
	].join("\n");
}

export default function (pi: ExtensionAPI) {
	// ---- 3. The view-rewrite (runs in every session) ---------------------------
	pi.on("context", async (event, ctx) => {
		const sessionFile = ctx.sessionManager.getSessionFile();
		if (!sessionFile) return undefined;
		const sidecar = readSidecar(sessionFile);
		if (!sidecar.ops || sidecar.ops.length === 0) return undefined; // no-op fast path
		const rewritten = applyOps(event.messages as never[], sidecar.ops);
		return { messages: rewritten as typeof event.messages };
	});

	// ---- 1. /meta : open or resume the linked meta session ---------------------
	pi.registerCommand("meta", {
		description: "Open/resume a linked meta session to discuss & elide this session's view",
		handler: async (args, ctx) => {
			const targetSession = ctx.sessionManager.getSessionFile();
			if (!targetSession) {
				ctx.ui?.notify?.("No session file for the current session.", "warning");
				return;
			}
			const sidecar: MetaSidecar = readSidecar(targetSession);
			const sidecarPath = `${targetSession}.meta.json`;

			// Resume path: a meta session already exists -> just switch to it.
			if (sidecar.metaSession) {
				await ctx.switchSession(sidecar.metaSession);
				return;
			}

			// Create path: spin up a child session linked back to this target.
			await ctx.newSession({
				parentSession: targetSession,
				// setup runs with a full SessionManager BEFORE the session goes live:
				// record the reverse link + persist the metaSession pointer on the target.
				setup: async (sm) => {
					sm.appendCustomEntry(META_TARGET, { targetSession } satisfies MetaTargetData);
					const metaSession = sm.getSessionFile();
					if (metaSession) patchSidecar(targetSession, { metaSession });
					sm.appendSessionInfo(`meta: ${baseName(targetSession)}`);
				},
				// withSession runs with the fresh command ctx AFTER replacement:
				// seed the meta-agent with its instructions and the human's task.
				withSession: async (mctx) => {
					await mctx.sendUserMessage(seedPrompt(targetSession, sidecarPath, args.trim()), {
						deliverAs: "followUp",
					});
				},
			});
		},
	});

	// ---- 2. /back : return from a meta session to its target -------------------
	pi.registerCommand("back", {
		description: "From a meta session, switch back to its target session",
		handler: async (_args, ctx) => {
			const branch = ctx.sessionManager.getBranch();
			const link = branch.find(
				(e) => e.type === "custom" && (e as { customType?: string }).customType === META_TARGET,
			) as { data?: MetaTargetData } | undefined;
			const targetSession = link?.data?.targetSession;
			if (!targetSession) {
				ctx.ui?.notify?.("This is not a meta session (no target link found).", "warning");
				return;
			}
			await ctx.switchSession(targetSession);
		},
	});
}

/** Trailing path segment, for a readable session name. */
function baseName(p: string): string {
	const parts = p.split("/");
	return parts[parts.length - 1] ?? p;
}
