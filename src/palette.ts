export type PaletteColor = "accent" | "success" | "muted" | "dim" | "border";

export type Palette = (color: PaletteColor, text: string) => string;

interface ThemeLike {
	fg?: (color: string, text: string) => string;
}

export const IDENTITY_PALETTE: Palette = (_color, text) => text;

const ROLE_COLORS: Record<string, PaletteColor> = {
	user: "accent",
	assistant: "success",
	toolResult: "muted",
};

export function roleColor(role: string): PaletteColor {
	return ROLE_COLORS[role] ?? "dim";
}

export function buildPalette(theme: unknown): Palette {
	const candidate = theme as ThemeLike | undefined;
	if (typeof candidate?.fg !== "function") return IDENTITY_PALETTE;
	return (color, text) => {
		try {
			return candidate.fg?.(color, text) ?? text;
		} catch {
			return text;
		}
	};
}
