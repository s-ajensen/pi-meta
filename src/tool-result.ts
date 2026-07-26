export interface ToolResult {
	content: { type: "text"; text: string }[];
	isError: boolean;
	details: undefined;
}

export function okResult(text: string): ToolResult {
	return { content: [{ type: "text", text }], isError: false, details: undefined };
}

export function errorResult(text: string): ToolResult {
	return { content: [{ type: "text", text: `pi-meta: ${text}` }], isError: true, details: undefined };
}
