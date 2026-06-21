import { createEventBus, discoverAndLoadExtensions } from "@earendil-works/pi-coding-agent";

const PACKAGE_DIR = new URL("../..", import.meta.url).pathname;

type CommandHandler = (args: string, ctx: unknown) => Promise<void>;
type ToolExecute = (
	toolCallId: string,
	params: unknown,
	signal: unknown,
	onUpdate: unknown,
	ctx: unknown,
) => Promise<{ content: { text: string }[]; isError: boolean }>;
type EventHandler = (event: unknown, ctx: unknown) => Promise<void>;

export interface LoadedExtension {
	commandHandler(name: string): CommandHandler;
	toolExecute(name: string): ToolExecute;
	eventHandler(event: string): EventHandler;
	hasRenderer(type: string): boolean;
	commandNames(): string[];
	toolNames(): string[];
	activeTools: string[];
}

export async function loadPiMeta(): Promise<LoadedExtension> {
	const result = await discoverAndLoadExtensions([PACKAGE_DIR], PACKAGE_DIR, PACKAGE_DIR, createEventBus());
	if (result.errors?.length) {
		throw new Error(`extension failed to load: ${JSON.stringify(result.errors)}`);
	}

	const extension = result.extensions.find((candidate) => candidate.tools.has("elide_regions"));
	if (!extension) throw new Error("pi-meta extension not found among loaded extensions");

	const state = { activeTools: [] as string[] };
	result.runtime.getActiveTools = () => state.activeTools;
	result.runtime.setActiveTools = (tools: string[]) => {
		state.activeTools = tools;
	};

	const firstHandler = (event: string): EventHandler => {
		const handlers = extension.handlers.get(event);
		if (!handlers?.length) throw new Error(`no handler for ${event}`);
		return handlers[0] as never;
	};

	return {
		commandHandler: (name) => {
			const command = extension.commands.get(name);
			if (!command) throw new Error(`command ${name} not registered`);
			return command.handler as never;
		},
		toolExecute: (name) => {
			const tool = extension.tools.get(name);
			if (!tool) throw new Error(`tool ${name} not registered`);
			return tool.definition.execute as never;
		},
		eventHandler: firstHandler,
		hasRenderer: (type) => extension.messageRenderers.has(type),
		commandNames: () => [...extension.commands.keys()],
		toolNames: () => [...extension.tools.keys()],
		get activeTools() {
			return state.activeTools;
		},
		set activeTools(tools: string[]) {
			state.activeTools = tools;
		},
	};
}
