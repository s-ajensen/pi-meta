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
	{
		name: "tags",
		description:
			"How to read and apply tags on the target — the fold, resolving a tag to its messages, " +
			"slicing around each, and back-filling judgment tags. Read when indexing or querying the target by tag.",
		skillPath: resolveSkillPath("./skills/tags/SKILL.md"),
	},
	{
		name: "move",
		description:
			"How to reposition a run of the target's messages within the view (turn-group unit, branch-replay " +
			"model, cache doctrine). Read when the human wants scattered or spent context brought to the tail.",
		skillPath: resolveSkillPath("./skills/move/SKILL.md"),
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
