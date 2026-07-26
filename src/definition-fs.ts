import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { DefinitionFileIO } from "./definition-store.ts";

export const definitionFileIO: DefinitionFileIO = {
	read(path) {
		try {
			return readFileSync(path, "utf8");
		} catch {
			return undefined;
		}
	},
	write(path, content) {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content, "utf8");
	},
};
