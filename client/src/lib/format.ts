const kmFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const coordFormatter = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
});

/** "45 min", "1 h", "1 h 05". */
export function formatDuration(minutes: number): string {
    const total = Math.max(0, Math.round(minutes));
    if (total < 60) return `${total} min`;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** "850 m", "1,2 km". Short distances are rounded to 10 m. */
export function formatDistance(meters: number): string {
    const value = Math.max(0, meters);
    if (value < 1000) {
        const rounded = value < 100 ? Math.round(value) : Math.round(value / 10) * 10;
        return rounded >= 1000 ? '1 km' : `${rounded} m`;
    }
    return `${kmFormatter.format(value / 1000)} km`;
}

/** "8:05" → "08:05". Unknown formats are returned unchanged. */
export function formatTime(time: string): string {
    const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
    if (!match) return time;
    return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/** Minutes since midnight for "HH:MM", or null. */
export function timeToMinutes(time: string): number | null {
    const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

/** Minutes between two "HH:MM" times, handling the midnight wrap. */
export function minutesBetween(from: string, to: string): number | null {
    const a = timeToMinutes(from);
    const b = timeToMinutes(to);
    if (a === null || b === null) return null;
    const diff = b - a;
    return diff < -12 * 60 ? diff + 24 * 60 : diff;
}

/** Current local time as "HH:MM". */
export function currentTime(date: Date = new Date()): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function isValidTime(time: string): boolean {
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    return match !== null && Number(match[1]) < 24 && Number(match[2]) < 60;
}

/** "1 arrêt", "3 arrêts". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
    return `${count} ${count > 1 ? pluralForm : singular}`;
}

/** "Direct", "1 correspondance", "2 correspondances". */
export function formatTransfers(transfers: number): string {
    return transfers === 0 ? 'Direct' : plural(transfers, 'correspondance');
}

export function formatCoordinates(lat: number, lon: number): string {
    return `${coordFormatter.format(lat)}, ${coordFormatter.format(lon)}`;
}
