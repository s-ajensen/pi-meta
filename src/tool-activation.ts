export function reconcileToolActivation(activeTools: string[], isMeta: boolean, tool: string): string[] {
	const next = activeTools.filter((name) => name !== tool);
	if (isMeta) next.push(tool);
	return next;
}
