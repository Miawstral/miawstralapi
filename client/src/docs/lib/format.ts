/** French formatting of numbers, sizes and dates. */

const integer = new Intl.NumberFormat('fr-FR');
/** Geist has no narrow no-break space (U+202F): use a no-break space. */
const spaces = (text: string) => text.replace(/\u202f/g, '\u00a0');

export const formatNumber = (value: number) => spaces(integer.format(value));

export function formatBytes(bytes: number): string {
    if (bytes < 1000) return `${bytes} o`;
    if (bytes < 1_000_000) return `${spaces((bytes / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }))} Ko`;
    return `${spaces((bytes / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }))} Mo`;
}

export function formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} s`;
}

/** "samedi 3 octobre" from "2026-10-03". */
export function formatServiceDate(date: string, withYear = false): string {
    const parsed = new Date(`${date}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) });
}

/** "2 oct." from "2026-10-02". */
export function formatShortDate(date: string): string {
    const parsed = new Date(`${date}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** "il y a 12 s", "il y a 3 min"… */
export function formatAgo(iso: string | null | undefined, now: number): string | null {
    if (!iso) return null;
    const then = Date.parse(iso);
    if (Number.isNaN(then)) return null;
    const seconds = Math.max(0, Math.round((now - then) / 1000));
    if (seconds < 5) return 'à l’instant';
    if (seconds < 60) return `il y a ${seconds} s`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `il y a ${hours} h`;
    return `il y a ${Math.round(hours / 24)} j`;
}

export function formatUptime(seconds: number): string {
    if (seconds < 60) return `${seconds} s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours} h ${String(minutes % 60).padStart(2, '0')}`;
    return `${Math.floor(hours / 24)} j ${hours % 24} h`;
}

/** Status text of the HTTP codes shown by the console. */
export const STATUS_TEXT: Record<string, string> = {
    '200': 'OK',
    '202': 'Accepted',
    '204': 'No Content',
    '304': 'Not Modified',
    '400': 'Bad Request',
    '401': 'Unauthorized',
    '403': 'Forbidden',
    '404': 'Not Found',
    '409': 'Conflict',
    '429': 'Too Many Requests',
    '500': 'Internal Server Error',
    '502': 'Bad Gateway',
    '503': 'Service Unavailable',
};
