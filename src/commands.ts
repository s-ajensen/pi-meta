import { resolveMetaTarget, findMetaChild, buildMetaSessionName, buildSeedPrompt } from "./meta-session.ts";

interface Notifier {
	notify?: (message: string, level: string) => void;
}

interface MetaCommandContext {
	cwd: string;
	sessionManager: { getSessionFile: () => string | undefined };
	ui?: Notifier;
	switchSession: (path: string) => Promise<unknown>;
	newSession: (options: {
		parentSession: string;
		setup: (sessionManager: { appendSessionInfo: (name: string) => void }) => Promise<void>;
		withSession: (metaContext: {
			sendUserMessage: (content: string, options?: { deliverAs?: string }) => Promise<void>;
		}) => Promise<void>;
	}) => Promise<unknown>;
}

interface BackCommandContext {
	sessionManager: { getHeader?: () => { parentSession?: string } | null };
	ui?: Notifier;
	switchSession: (path: string) => Promise<unknown>;
}

export async function runMetaCommand(_args: string, ctx: MetaCommandContext): Promise<void> {
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
			await metaContext.sendUserMessage(buildSeedPrompt(target), { deliverAs: "followUp" });
		},
	});
}

export async function runBackCommand(_args: string, ctx: BackCommandContext): Promise<void> {
	const target = resolveMetaTarget(ctx.sessionManager);
	if (!target) {
		ctx.ui?.notify?.("This is not a meta session (no target link found).", "warning");
		return;
	}
	await ctx.switchSession(target);
}
