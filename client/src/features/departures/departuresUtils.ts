import { minutesFromNow } from '@/lib/realtime';
import { normalizeText } from '@/lib/text';
import type { Departure, TransitMode } from '@/types';

export interface TimedDeparture {
    departure: Departure;
    /** Expected time: real time when known, else the timetable. */
    time: string;
    /** Minutes from now to `time`. */
    minutes: number | null;
}

export interface DepartureGroup {
    key: string;
    line: string;
    lineName: string;
    color: string;
    textColor: string;
    mode: TransitMode;
    headsign: string;
    departures: TimedDeparture[];
}

/** A departure is dropped from the board a minute after its expected time. */
const GONE_AFTER_MINUTES = -1;

/**
 * Departures grouped by line and headsign, groups sorted by their next
 * departure, each with at most `perGroup` departures.
 */
export function groupDepartures(departures: Departure[], now: Date, perGroup = 3): DepartureGroup[] {
    const groups = new Map<string, DepartureGroup>();
    for (const departure of departures) {
        const time = departure.realtime?.time ?? departure.time;
        const minutes = minutesFromNow(time, now);
        if (minutes !== null && minutes < GONE_AFTER_MINUTES) continue;
        const key = `${departure.line}|${normalizeText(departure.headsign)}`;
        let group = groups.get(key);
        if (!group) {
            group = {
                key,
                line: departure.line,
                lineName: departure.lineName,
                color: departure.color,
                textColor: departure.textColor,
                mode: departure.mode,
                headsign: departure.headsign,
                departures: [],
            };
            groups.set(key, group);
        }
        group.departures.push({ departure, time, minutes });
    }

    const order = (d: TimedDeparture) => d.minutes ?? Infinity;
    const result = [...groups.values()];
    for (const group of result) {
        group.departures.sort((a, b) => order(a) - order(b));
        group.departures = group.departures.slice(0, perGroup);
    }
    // A group whose next departure is cancelled is sorted by its first running one.
    const nextRunning = (group: DepartureGroup) => {
        const running = group.departures.find(d => !d.departure.cancelled) ?? group.departures[0];
        return running ? order(running) : Infinity;
    };
    return result.sort((a, b) => nextRunning(a) - nextRunning(b));
}
