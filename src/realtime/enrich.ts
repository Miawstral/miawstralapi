import type { ServiceAlert, Vehicle } from '../interfaces/BusData';
import { formatTime } from '../lib/time';
import type { NetworkLine, TransitNetwork, Trip } from '../network/network';
import { delaysAlongTrip, realtime, type RtAlert, type RtTripUpdate } from './realtime.service';

/** Waits for a real-time feed at most this long when computing a response. */
const REALTIME_BUDGET_MS = 1500;

async function within<T>(promise: Promise<T>, ms = REALTIME_BUDGET_MS): Promise<T | null> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<null>(resolve => {
        timer = setTimeout(() => resolve(null), ms);
    });
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

export async function tripUpdatesOrNull(): Promise<Map<string, RtTripUpdate> | null> {
    return (await within(realtime.tripUpdates()))?.value ?? null;
}

/** Delays (seconds) of a trip at each of its stops, when it is tracked. */
export function tripDelays(network: TransitNetwork, updates: Map<string, RtTripUpdate> | null, trip: Trip) {
    const update = updates?.get(trip.id);
    if (!update) return null;
    return {
        cancelled: update.cancelled,
        stops: delaysAlongTrip(update, trip.stops.map(s => network.stops[s].id)),
    };
}

/** "HH:MM" of a scheduled time (minutes) shifted by a delay (seconds). */
export const expectedTime = (minutes: number, delaySeconds: number) => formatTime(minutes + Math.round(delaySeconds / 60));

const lineRef = (line: NetworkLine) => ({ id: line.id, color: line.color, textColor: line.textColor });

function toServiceAlert(network: TransitNetwork, alert: RtAlert, now: number): ServiceAlert {
    const periods = alert.periods.length > 0 ? alert.periods : [{ start: null, end: null }];
    const current = periods.find(p => (p.start ?? 0) <= now && now <= (p.end ?? Infinity));
    const next = current ?? periods.filter(p => (p.start ?? 0) > now).sort((a, b) => (a.start ?? 0) - (b.start ?? 0))[0] ?? periods[0];
    const iso = (t: number | null) => (t ? new Date(t * 1000).toISOString() : null);
    return {
        id: alert.id,
        title: alert.header,
        description: alert.description,
        url: alert.url,
        cause: alert.cause,
        effect: alert.effect,
        start: iso(next.start),
        end: iso(next.end),
        active: Boolean(current),
        lines: alert.routeIds.flatMap(id => {
            const line = network.lineOfRoute(id) ?? network.getLine(id);
            return line ? [lineRef(line)] : [];
        }),
        stops: alert.stopIds.flatMap(id => {
            const stop = network.getStop(id);
            return stop ? [{ stopPointId: stop.id, name: stop.name }] : [];
        }),
    };
}

/** Current and upcoming alerts (finished ones are dropped). */
export async function serviceAlerts(network: TransitNetwork, wait = true): Promise<ServiceAlert[]> {
    const entry = wait ? await realtime.alerts() : await within(realtime.alerts());
    if (!entry) return [];
    const now = Date.now() / 1000;
    return entry.value
        .filter(a => a.periods.length === 0 || a.periods.some(p => (p.end ?? Infinity) >= now))
        .map(a => toServiceAlert(network, a, now))
        .sort((a, b) => Number(b.active) - Number(a.active) || (a.start ?? '').localeCompare(b.start ?? ''));
}

/** Live positions of the vehicles, with their line and next stop. */
export async function liveVehicles(network: TransitNetwork): Promise<{ updatedAt: string | null; vehicles: Vehicle[] }> {
    const [positions, updates] = await Promise.all([realtime.vehicles(), within(realtime.tripUpdates())]);
    if (!positions) return { updatedAt: null, vehicles: [] };
    const vehicles = positions.value.map((v): Vehicle => {
        const trip = v.tripId ? network.trips.get(v.tripId) : undefined;
        const line = (trip && network.lines.get(trip.line)) ?? (v.routeId ? network.lineOfRoute(v.routeId) : undefined);
        const stop = v.stopId ? network.getStop(v.stopId) : undefined;
        let delay: number | null = null;
        if (trip && updates?.value) {
            const delays = tripDelays(network, updates.value, trip);
            const position = stop ? trip.stops.indexOf(stop.index) : -1;
            delay = delays?.stops[Math.max(0, position)]?.delay ?? null;
        }
        return {
            id: v.id,
            label: v.label,
            tripId: v.tripId,
            line: line?.id ?? null,
            lineName: line?.name ?? null,
            color: line?.color ?? '#64748b',
            textColor: line?.textColor ?? '#ffffff',
            mode: line?.mode ?? 'bus',
            headsign: trip?.headsign ?? null,
            lat: v.lat,
            lon: v.lon,
            bearing: v.bearing,
            speed: v.speed === null ? null : Math.round(v.speed * 3.6),
            delay,
            status: v.status,
            nextStop: stop ? { stopPointId: stop.id, name: stop.name } : null,
            updatedAt: v.timestamp ? new Date(v.timestamp * 1000).toISOString() : null,
        };
    });
    return { updatedAt: positions.feedTimestamp ? new Date(positions.feedTimestamp * 1000).toISOString() : null, vehicles };
}
