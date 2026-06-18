/**
 * Renderer for `meta-elided` custom_message entries.
 *
 * Collapsed (default): hide the verbatim; show a bracket marker with the synopsis
 * on the following line:
 *   - region of 1:  ⌁ [1 message elided]
 *                   <synopsis>
 *   - region of N:  ⌁ [N messages elided ▼]
 *                   <synopsis>
 *
 * Expanded (global app.tools.expand toggle): show the synopsis banner, then each
 * elided message rendered DIMMED but readable, then a closing ▲ marker.
 *
 * Expand/collapse is global in pi (one toggle fans setExpanded across all
 * transcript components), so this reveals/hides every elided region at once.
 */

import { Container, Text, Spacer, Markdown } from "@earendil-works/pi-tui";
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import type { ElidedDetails, ElidedMessage } from "./ops.ts";

const GLYPH = "⌁";

/** Flatten a message's content to readable plain text for the greyed view. */
function contentToText(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		const parts: string[] = [];
		for (const block of content) {
			if (!block || typeof block !== "object") continue;
			const b = block as { type?: string; text?: string; name?: string; arguments?: unknown };
			if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
			else if (b.type === "toolCall") parts.push(`→ ${b.name ?? "tool"}(${safeArgs(b.arguments)})`);
			else if (b.type === "thinking") parts.push("(thinking)");
			else if (b.type === "image") parts.push("(image)");
		}
		return parts.join("\n");
	}
	return "";
}

function safeArgs(args: unknown): string {
	try {
		const s = JSON.stringify(args ?? {});
		return s.length > 80 ? `${s.slice(0, 77)}…` : s;
	} catch {
		return "…";
	}
}

function markerText(count: number, expanded: boolean): string {
	if (count <= 1) return `${GLYPH} [1 message elided]`;
	const arrow = expanded ? "▲" : "▼";
	return `${GLYPH} [${count} messages elided ${arrow}]`;
}

/**
 * Build the renderer. `theme` is pi's theme object (passed by the host at
 * registration time); we only use its `fg`/`dim` color helpers, guarding for
 * absence so the module stays testable without a full TUI.
 */
export function makeElidedRenderer() {
	// Signature matches pi's MessageRenderer: (message, { expanded }, theme) => Component
	return (
		message: { content?: unknown; details?: unknown },
		options: { expanded: boolean },
		theme: { fg?: (c: string, s: string) => string },
	) => {
		const details = (message.details ?? {}) as Partial<ElidedDetails>;
		const count = details.count ?? 1;
		const synopsis =
			typeof message.content === "string" ? message.content : contentToText(message.content);
		const dim = (s: string) => (theme.fg ? theme.fg("dim", s) : s);
		const accent = (s: string) => (theme.fg ? theme.fg("customMessageLabel", s) : s);

		const container = new Container();
		container.addChild(new Text(accent(markerText(count, options.expanded)), 0, 0));
		// Synopsis: render as Markdown (so structure shows) tinted purple like the
		// marker, matching the custom-message header the user expects.
		if (synopsis) {
			let mdTheme: unknown;
			try {
				mdTheme = getMarkdownTheme();
			} catch {
				mdTheme = undefined;
			}
			if (mdTheme) {
				container.addChild(new Markdown(synopsis, 0, 0, mdTheme as never, { color: (t: string) => accent(t) }));
			} else {
				container.addChild(new Text(accent(synopsis), 0, 0));
			}
		}

		if (options.expanded && details.verbatim && details.verbatim.length > 0) {
			container.addChild(new Spacer(1));
			for (const m of details.verbatim as ElidedMessage[]) {
				const label = `${m.role}:`;
				const body = contentToText(m.content);
				container.addChild(new Text(dim(`  ${label} ${body}`), 0, 0));
			}
			container.addChild(new Spacer(1));
			container.addChild(new Text(accent(`${GLYPH} [end of ${count} elided ▲]`), 0, 0));
		}

		return container;
	};
}
