export function reconcileToolActivation(activeTools: string[], isMeta: boolean, tools: string[]): string[] {
	const next = activeTools.filter((name) => !tools.includes(name));
	if (isMeta) next.push(...tools);
	return next;
}
