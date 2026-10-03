import { timeToMinutes } from '@/lib/format';
import { normalizeText } from '@/lib/text';
import type { Direction, LineDetails, LineSummary, TransitMode, Vehicle } from '@/types';

// ---------------------------------------------------------------------------
// Grouping & naming
// ---------------------------------------------------------------------------

export type LineGroupId = TransitMode | 'school';

export interface LineGroup {
    id: LineGroupId;
    label: string;
    lines: LineSummary[];
}

const GROUP_ORDER: LineGroupId[] = ['bus', 'boat', 'cable', 'tram', 'rail', 'school'];
const GROUP_LABELS: Record<LineGroupId, string> = {
    bus: 'Bus',
    boat: 'Bateaux-bus',
    cable: 'Téléphérique',
    tram: 'Tramway',
    rail: 'Train',
    school: 'Lignes scolaires et navettes',
};

const lineCollator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

export const compareLines = (a: LineSummary, b: LineSummary) => lineCollator.compare(a.bus_id, b.bus_id);

/** School and special services (CA12, CR3, BN1…). */
export function isSchoolLine(line: LineSummary): boolean {
    return /^(CA|CR|BN)\d/i.test(line.bus_id) || /scolaire/i.test(line.lineName);
}

export function groupLines(lines: LineSummary[]): LineGroup[] {
    const groups = new Map<LineGroupId, LineSummary[]>();
    for (const line of lines) {
        const id: LineGroupId = isSchoolLine(line) ? 'school' : GROUP_LABELS[line.mode] ? line.mode : 'bus';
        groups.set(id, [...(groups.get(id) ?? []), line]);
    }
    return GROUP_ORDER.flatMap(id => {
        const list = groups.get(id);
        return list ? [{ id, label: GROUP_LABELS[id], lines: [...list].sort(compareLines) }] : [];
    });
}

/** The two ends of the line ("Seyne Centre", "Le Brusc"), from the headsigns; null for loops. */
export function lineTermini(line: Pick<LineSummary, 'directions'>): [string, string] | null {
    const outward = line.directions.find(d => d.direction === 'OUTWARD')?.headsign;
    const inward = line.directions.find(d => d.direction === 'INWARD')?.headsign;
    if (!outward || !inward || normalizeText(outward) === normalizeText(inward)) return null;
    // The outward trip leaves from the inward terminus.
    return [inward, outward];
}

/** Accent-insensitive search on the number, the name and the termini. Best matches first. */
export function searchLines(lines: LineSummary[], rawQuery: string): LineSummary[] {
    const query = normalizeText(rawQuery);
    if (!query) return lines;
    const scored: { line: LineSummary; score: number }[] = [];
    for (const line of lines) {
        const id = normalizeText(line.bus_id);
        const text = normalizeText([line.lineName, ...line.directions.map(d => d.headsign)].join(' '));
        let score: number | null = null;
        if (id === query) score = 0;
        else if (id.startsWith(query)) score = 1;
        else if (text.split(' ').some(word => word.startsWith(query))) score = 2;
        else if (text.includes(query)) score = 3;
        else if (query.split(' ').every(token => `${id} ${text}`.includes(token))) score = 4;
        if (score !== null) scored.push({ line, score });
    }
    return scored.sort((a, b) => a.score - b.score || compareLines(a.line, b.line)).map(s => s.line);
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export function countVehiclesByLine(vehicles: Vehicle[] | null): Map<string, number> {
    const counts = new Map<string, number>();
    for (const vehicle of vehicles ?? []) {
        if (vehicle.line) counts.set(vehicle.line, (counts.get(vehicle.line) ?? 0) + 1);
    }
    return counts;
}

type DirectionStops = Pick<LineDetails['directions'][number], 'direction' | 'headsign' | 'stops'>;

/**
 * Vehicles of a line running in a direction, indexed by the stop they are heading to.
 * The next stop decides (stop points are usually distinct per direction); the
 * headsign breaks ties at shared stops (termini).
 */
export function vehiclesByNextStop(
    vehicles: Vehicle[] | null,
    lineId: string,
    direction: DirectionStops,
    other: DirectionStops | undefined,
): Map<string, Vehicle[]> {
    const result = new Map<string, Vehicle[]>();
    if (!vehicles) return result;
    const own = new Set(direction.stops.map(s => s.stopPointId));
    const theirs = new Set(other?.stops.map(s => s.stopPointId) ?? []);
    const headsign = normalizeText(direction.headsign);

    for (const vehicle of vehicles) {
        const stopId = vehicle.nextStop?.stopPointId;
        if (vehicle.line !== lineId || !stopId || !own.has(stopId)) continue;
        // Stop served in both directions: trust the headsign.
        if (theirs.has(stopId) && normalizeText(vehicle.headsign ?? '') !== headsign) continue;
        result.set(stopId, [...(result.get(stopId) ?? []), vehicle]);
    }
    return result;
}

// ---------------------------------------------------------------------------
// Timetables
// ---------------------------------------------------------------------------

/**
 * Minutes since the start of the service day for each time. Times are listed in
 * service order and wrap after midnight ("23:30", "00:00", "00:30"): those get +24 h.
 */
export function serviceMinutes(times: string[]): number[] {
    let offset = 0;
    let previous = -Infinity;
    const result: number[] = [];
    for (const time of times) {
        const value = timeToMinutes(time);
        if (value === null) continue;
        if (value + offset < previous - 12 * 60) offset += 24 * 60;
        previous = value + offset;
        result.push(previous);
    }
    return result;
}

/** Index of the first passage at or after `minutes` (sorted input), or -1. */
export function nextPassageIndex(passages: number[], minutes: number): number {
    let low = 0;
    let high = passages.length;
    while (low < high) {
        const mid = (low + high) >> 1;
        if (passages[mid] < minutes) low = mid + 1;
        else high = mid;
    }
    return low < passages.length ? low : -1;
}

/** "HH:MM" of service minutes (wrapping after midnight). */
export function minutesToTime(minutes: number): string {
    const value = ((Math.floor(minutes) % 1440) + 1440) % 1440;
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

/** YYYY-MM-DD of a local date. */
export function localIsoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function directionOf<T extends { direction: Direction }>(directions: T[], wanted: Direction): T | undefined {
    return directions.find(d => d.direction === wanted) ?? directions[0];
}
