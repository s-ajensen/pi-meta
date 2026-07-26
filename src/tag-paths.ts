export function workspaceTagsPath(cwd: string): string {
	return `${cwd}/.pi/tags.json`;
}

export function globalTagsPath(home: string): string {
	return `${home}/.pi/agent/tags.json`;
}

export function definitionPath(cwd: string, home: string, global: boolean): string {
	return global ? globalTagsPath(home) : workspaceTagsPath(cwd);
}
