export interface Window<T> {
	visible: T[];
	start: number;
	more: { above: number; below: number };
}

export function windowRows<T>(rows: T[], cursor: number, height: number): Window<T> {
	if (rows.length === 0 || height <= 0) {
		return { visible: [], start: 0, more: { above: 0, below: 0 } };
	}
	const span = Math.min(height, rows.length);
	const centered = cursor - Math.floor(span / 2);
	const start = Math.max(0, Math.min(centered, rows.length - span));
	return {
		visible: rows.slice(start, start + span),
		start,
		more: { above: start, below: rows.length - (start + span) },
	};
}
