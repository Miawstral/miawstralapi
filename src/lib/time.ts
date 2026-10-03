export const MINUTES_PER_DAY = 24 * 60;

/**
 * Parses "H:MM" / "HH:MM" into minutes since midnight.
 * Hours above 23 are accepted (GTFS style, for trips running after midnight).
 */
export function parseTime(value: string | null | undefined): number | null {
    if (!value) return null;
    const match = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(value);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (minutes > 59) return null;
    return hours * 60 + minutes;
}

/** Formats minutes since midnight as "HH:MM" (wrapping past midnight). */
export function formatTime(minutes: number): string {
    const normalized = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Current time of day, in minutes, in the given IANA time zone. */
export function nowInTimezone(timeZone: string, date: Date = new Date()): number {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
    return get('hour') * 60 + get('minute');
}
