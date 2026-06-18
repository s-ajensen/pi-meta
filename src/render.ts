import { Container, Text, Spacer, Markdown } from "@earendil-works/pi-tui";
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import type { ElidedDetails, ElidedMessage } from "./ops.ts";

const GLYPH = "⌁";

type ContentBlock = { type?: string; text?: string; name?: string; arguments?: unknown };

function truncateArgs(args: unknown): string {
	try {
		const serialized = JSON.stringify(args ?? {});
		return serialized.length > 80 ? `${serialized.slice(0, 77)}…` : serialized;
	} catch {
		return "…";
	}
}

function renderBlockText(block: ContentBlock): string | undefined {
	if (block.type === "text" && typeof block.text === "string") return block.text;
	if (block.type === "toolCall") return `→ ${block.name ?? "tool"}(${truncateArgs(block.arguments)})`;
	if (block.type === "thinking") return "(thinking)";
	if (block.type === "image") return "(image)";
	return undefined;
}

function flattenContent(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((block): block is ContentBlock => !!block && typeof block === "object")
		.map(renderBlockText)
		.filter((text): text is string => text !== undefined)
		.join("\n");
}

function buildMarkerText(count: number, expanded: boolean): string {
	if (count <= 1) return `${GLYPH} [1 message elided]`;
	return `${GLYPH} [${count} messages elided ${expanded ? "▲" : "▼"}]`;
}

type Tint = (s: string) => string;

function loadMarkdownTheme(): unknown {
	try {
		return getMarkdownTheme();
	} catch {
		return undefined;
	}
}

function buildSynopsisComponent(synopsis: string, accent: Tint) {
	const theme = loadMarkdownTheme();
	return theme
		? new Markdown(synopsis, 0, 0, theme as never, { color: accent })
		: new Text(accent(synopsis), 0, 0);
}

function appendExpandedVerbatim(container: Container, count: number, verbatim: ElidedMessage[], accent: Tint, dim: Tint) {
	container.addChild(new Spacer(1));
	for (const message of verbatim) {
		container.addChild(new Text(dim(`  ${message.role}: ${flattenContent(message.content)}`), 0, 0));
	}
	container.addChild(new Spacer(1));
	container.addChild(new Text(accent(`${GLYPH} [end of ${count} elided ▲]`), 0, 0));
}

export function makeElidedRenderer() {
	return (
		message: { content?: unknown; details?: unknown },
		options: { expanded: boolean },
		theme: { fg?: (c: string, s: string) => string },
	) => {
		const details = (message.details ?? {}) as Partial<ElidedDetails>;
		const count = details.count ?? 1;
		const synopsis = flattenContent(message.content);
		const accent: Tint = (text) => (theme.fg ? theme.fg("customMessageLabel", text) : text);
		const dim: Tint = (text) => (theme.fg ? theme.fg("dim", text) : text);

		const container = new Container();
		container.addChild(new Text(accent(buildMarkerText(count, options.expanded)), 0, 0));
		if (synopsis) container.addChild(buildSynopsisComponent(synopsis, accent));

		if (options.expanded && details.verbatim?.length) {
			appendExpandedVerbatim(container, count, details.verbatim, accent, dim);
		}
		return container;
	};
}
