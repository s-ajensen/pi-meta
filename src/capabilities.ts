export interface Capability {
	name: string;
	description: string;
	skillPath: string;
}

function resolveSkillPath(relativePath: string): string {
	return new URL(relativePath, import.meta.url).pathname;
}

export const capabilities: Capability[] = [
	{
		name: "elision",
		description:
			"How to collapse spent stretches of the target into summaries (the branch model, " +
			"synopsis formatting, worked examples). Read when the human wants to declutter the target.",
		skillPath: resolveSkillPath("./skills/elision/SKILL.md"),
	},
];

function renderCapability(capability: Capability): string {
	return [
		"  <skill>",
		`    <name>${capability.name}</name>`,
		`    <description>${capability.description}</description>`,
		`    <location>${capability.skillPath}</location>`,
		"  </skill>",
	].join("\n");
}

export function renderMetaSkills(entries: Capability[]): string {
	if (entries.length === 0) return "";
	return [
		"The meta channel has injected the following extra skills for this session.",
		"Use the read tool to load a skill's file when the task matches its description.",
		"",
		"<meta_skills>",
		...entries.map(renderCapability),
		"</meta_skills>",
	].join("\n");
}
