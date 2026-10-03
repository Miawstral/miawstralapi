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

/** Time of day in a time zone, with seconds. */
function zonedParts(timeZone: string, date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
    return {
        date: `${get('year')}-${get('month')}-${get('day')}`,
        seconds: Number(get('hour')) * 3600 + Number(get('minute')) * 60 + Number(get('second')),
    };
}

/** Service days end at 3:00: GTFS trips after midnight belong to the previous day (24:30 = 00:30). */
export const SERVICE_DAY_START_HOUR = 3;

/**
 * Current service date (YYYY-MM-DD) and time in minutes since its midnight
 * (fractional, up to 27:00), in the given time zone.
 */
export function serviceDateNow(timeZone: string, date: Date = new Date()): { date: string; minutes: number } {
    const today = zonedParts(timeZone, date);
    if (today.seconds >= SERVICE_DAY_START_HOUR * 3600) return { date: today.date, minutes: today.seconds / 60 };
    const yesterday = zonedParts(timeZone, new Date(date.getTime() - 86_400_000));
    return { date: yesterday.date, minutes: (today.seconds + 86_400) / 60 };
}

/** Unix time (seconds) of a time of a service day. */
export function serviceTimeToEpoch(serviceDate: string, seconds: number, timeZone: string): number {
    // Noon of the service day is never in a DST gap: get its offset, then go back.
    const noon = new Date(`${serviceDate}T12:00:00Z`);
    const local = zonedParts(timeZone, noon);
    const offset = local.seconds - 12 * 3600; // seconds ahead of UTC
    return Math.floor(noon.getTime() / 1000) - 12 * 3600 + seconds - offset;
}
