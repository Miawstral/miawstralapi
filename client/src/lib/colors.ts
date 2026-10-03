export const FALLBACK_LINE_COLOR = '#64748b';

type Rgb = [number, number, number];

function parseHex(color: string): Rgb | null {
    const hex = color.replace(/^#/, '');
    if (!/^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
    const full = hex.length <= 4 ? [...hex.slice(0, 3)].map((c) => c + c).join('') : hex.slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
}

function parseHsl(color: string): Rgb | null {
    const match = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i.exec(color);
    if (!match) return null;
    const h = Number(match[1]) % 360;
    const s = Number(match[2]) / 100;
    const l = Number(match[3]) / 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)) as Rgb;
}

function toRgb(color: string): Rgb | null {
    return parseHex(color) ?? parseHsl(color);
}

/** Valid CSS color for a line, with a neutral fallback. */
export function lineColor(color: string | null | undefined): string {
    if (!color) return FALLBACK_LINE_COLOR;
    const trimmed = color.trim();
    if (/^[0-9a-f]{3,8}$/i.test(trimmed) && parseHex(trimmed)) return `#${trimmed}`;
    return toRgb(trimmed) ? trimmed : FALLBACK_LINE_COLOR;
}

function relativeLuminance([r, g, b]: Rgb): number {
    const channel = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * True when white text would not be readable enough on this background
 * (contrast < 3:1, the WCAG threshold for bold/large text), so dark text should be used.
 */
export function isLightColor(color: string): boolean {
    const rgb = toRgb(lineColor(color));
    if (!rgb) return false;
    return 1.05 / (relativeLuminance(rgb) + 0.05) < 3;
}

/** Readable text color to put on top of a line color. */
export function textColorOn(color: string): string {
    return isLightColor(color) ? '#111827' : '#ffffff';
}

function contrastRatio(a: Rgb, b: Rgb): number {
    const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
}

const toHex = (rgb: Rgb) => `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/**
 * Line color for thin strokes (map lines, timeline rails): very pale colors are
 * darkened on a light background, very dark ones lightened on a dark background,
 * so that they keep a minimal contrast. Badges keep the original color.
 */
export function strokeColor(color: string | null | undefined, dark: boolean): string {
    const base = lineColor(color);
    const rgb = toRgb(base);
    if (!rgb) return base;
    const background: Rgb = dark ? [24, 24, 27] : [255, 255, 255];
    const target: Rgb = dark ? [255, 255, 255] : [0, 0, 0];
    let mixed = rgb;
    for (let amount = 0.1; contrastRatio(mixed, background) < 2.2 && amount <= 0.7; amount += 0.1) {
        mixed = rgb.map((v, i) => v + (target[i] - v) * amount) as Rgb;
    }
    return mixed === rgb ? base : toHex(mixed);
}
