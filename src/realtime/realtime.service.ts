import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { config } from '../config';
import { createLogger } from '../lib/logger';

const { transit_realtime: rt } = GtfsRealtimeBindings;
const log = createLogger('realtime');

/**
 * GTFS-RT feeds of the Réseau Mistral (vehicle positions, trip updates,
 * alerts). Fetched on demand and cached for a few seconds, so nothing is
 * downloaded while nobody uses the app.
 */

export interface RtVehicle {
    id: string;
    label: string | null;
    tripId: string | null;
    routeId: string | null;
    lat: number;
    lon: number;
    bearing: number | null;
    /** m/s */
    speed: number | null;
    stopId: string | null;
    status: 'INCOMING_AT' | 'STOPPED_AT' | 'IN_TRANSIT_TO' | null;
    /** Unix seconds. */
    timestamp: number | null;
}

export interface RtStopUpdate {
    stopId: string | null;
    stopSequence: number | null;
    /** Seconds (positive = late). */
    arrivalDelay: number | null;
    departureDelay: number | null;
    /** Unix seconds. */
    arrivalTime: number | null;
    departureTime: number | null;
    skipped: boolean;
}

export interface RtTripUpdate {
    tripId: string;
    cancelled: boolean;
    updates: RtStopUpdate[];
    timestamp: number | null;
}

export interface RtAlert {
    id: string;
    header: string;
    description: string;
    url: string | null;
    cause: string | null;
    effect: string | null;
    periods: { start: number | null; end: number | null }[];
    routeIds: string[];
    stopIds: string[];
}

interface CacheEntry<T> {
    value: T;
    fetchedAt: number;
    feedTimestamp: number | null;
}

const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

async function fetchFeed(url: string) {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return rt.FeedMessage.decode(new Uint8Array(await response.arrayBuffer()));
}

function translated(text: { translation?: { text?: string | null; language?: string | null }[] | null } | null | undefined): string {
    const list = text?.translation ?? [];
    return (list.find(t => t.language?.startsWith('fr')) ?? list[0])?.text?.trim() ?? '';
}

class Cached<T> {
    private entry: CacheEntry<T> | null = null;
    private pending: Promise<CacheEntry<T>> | null = null;
    lastError: string | null = null;

    constructor(
        private readonly name: string,
        private readonly ttlSeconds: () => number,
        private readonly load: () => Promise<{ value: T; feedTimestamp: number | null }>,
    ) {}

    async get(): Promise<CacheEntry<T> | null> {
        if (this.entry && Date.now() - this.entry.fetchedAt < this.ttlSeconds() * 1000) return this.entry;
        this.pending ??= this.load()
            .then(({ value, feedTimestamp }) => {
                this.lastError = null;
                this.entry = { value, fetchedAt: Date.now(), feedTimestamp };
                return this.entry;
            })
            .finally(() => {
                this.pending = null;
            });
        try {
            return await this.pending;
        } catch (error) {
            this.lastError = (error as Error).message;
            log.warn(`${this.name}: ${this.lastError}`);
            // Serve stale data rather than nothing (up to 5 minutes).
            return this.entry && Date.now() - this.entry.fetchedAt < 300_000 ? this.entry : null;
        }
    }

    status() {
        return {
            fetchedAt: this.entry ? new Date(this.entry.fetchedAt).toISOString() : null,
            feedTimestamp: this.entry?.feedTimestamp ? new Date(this.entry.feedTimestamp * 1000).toISOString() : null,
            error: this.lastError,
        };
    }
}

const vehicles = new Cached<RtVehicle[]>('vehicle positions', () => config.realtime.vehiclesTtlSeconds, async () => {
    const feed = await fetchFeed(config.realtime.vehiclePositionsUrl);
    const list: RtVehicle[] = [];
    for (const entity of feed.entity) {
        const v = entity.vehicle;
        if (!v?.position) continue;
        list.push({
            id: v.vehicle?.id ?? entity.id,
            label: v.vehicle?.label ?? null,
            tripId: v.trip?.tripId ?? null,
            routeId: v.trip?.routeId ?? null,
            lat: v.position.latitude,
            lon: v.position.longitude,
            bearing: num(v.position.bearing),
            speed: num(v.position.speed),
            stopId: v.stopId ?? null,
            status: v.currentStatus === null || v.currentStatus === undefined
                ? null
                : (rt.VehiclePosition.VehicleStopStatus[v.currentStatus] as RtVehicle['status']),
            timestamp: num(v.timestamp),
        });
    }
    return { value: list, feedTimestamp: num(feed.header.timestamp) };
});

const tripUpdates = new Cached<Map<string, RtTripUpdate>>('trip updates', () => config.realtime.tripUpdatesTtlSeconds, async () => {
    const feed = await fetchFeed(config.realtime.tripUpdatesUrl);
    const byTrip = new Map<string, RtTripUpdate>();
    const CANCELED = rt.TripDescriptor.ScheduleRelationship.CANCELED;
    const SKIPPED = rt.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED;
    for (const entity of feed.entity) {
        const tu = entity.tripUpdate;
        const tripId = tu?.trip?.tripId;
        if (!tu || !tripId) continue;
        byTrip.set(tripId, {
            tripId,
            cancelled: tu.trip.scheduleRelationship === CANCELED,
            timestamp: num(tu.timestamp),
            updates: (tu.stopTimeUpdate ?? []).map(u => ({
                stopId: u.stopId ?? null,
                stopSequence: num(u.stopSequence),
                arrivalDelay: num(u.arrival?.delay),
                departureDelay: num(u.departure?.delay),
                arrivalTime: num(u.arrival?.time),
                departureTime: num(u.departure?.time),
                skipped: u.scheduleRelationship === SKIPPED,
            })),
        });
    }
    return { value: byTrip, feedTimestamp: num(feed.header.timestamp) };
});

const alerts = new Cached<RtAlert[]>('alerts', () => config.realtime.alertsTtlSeconds, async () => {
    const feed = await fetchFeed(config.realtime.alertsUrl);
    const list: RtAlert[] = [];
    for (const entity of feed.entity) {
        const a = entity.alert;
        if (!a) continue;
        list.push({
            id: entity.id,
            header: translated(a.headerText),
            description: translated(a.descriptionText),
            url: translated(a.url) || null,
            cause: a.cause === null || a.cause === undefined ? null : (rt.Alert.Cause[a.cause] ?? null),
            effect: a.effect === null || a.effect === undefined ? null : (rt.Alert.Effect[a.effect] ?? null),
            periods: (a.activePeriod ?? []).map(p => ({ start: num(p.start), end: num(p.end) })),
            routeIds: [...new Set((a.informedEntity ?? []).map(e => e.routeId).filter((id): id is string => Boolean(id)))],
            stopIds: [...new Set((a.informedEntity ?? []).map(e => e.stopId).filter((id): id is string => Boolean(id)))],
        });
    }
    return { value: list, feedTimestamp: num(feed.header.timestamp) };
});

export const realtime = {
    async vehicles() {
        return config.realtime.enabled ? vehicles.get() : null;
    },
    async tripUpdates() {
        return config.realtime.enabled ? tripUpdates.get() : null;
    },
    async alerts() {
        return config.realtime.enabled ? alerts.get() : null;
    },
    status() {
        return {
            enabled: config.realtime.enabled,
            vehicles: vehicles.status(),
            tripUpdates: tripUpdates.status(),
            alerts: alerts.status(),
        };
    },
};

/**
 * Delay (seconds) of a trip at each of its stops: the update of a stop, or the
 * last update before it (GTFS-RT propagation rule). `null` before the first
 * update, when nothing is known.
 */
export function delaysAlongTrip(update: RtTripUpdate, stopIds: string[]): { delay: number | null; skipped: boolean }[] {
    const result: { delay: number | null; skipped: boolean }[] = stopIds.map(() => ({ delay: null, skipped: false }));
    // Match updates to positions in order (a stop may appear twice on a loop).
    let cursor = 0;
    const matched: { position: number; update: RtStopUpdate }[] = [];
    for (const u of update.updates) {
        let position = -1;
        if (u.stopSequence !== null && u.stopSequence >= 1 && u.stopSequence <= stopIds.length && !u.stopId) {
            position = u.stopSequence - 1;
        } else if (u.stopId) {
            position = stopIds.indexOf(u.stopId, cursor);
        }
        if (position < 0) continue;
        matched.push({ position, update: u });
        cursor = position + 1;
    }
    let current: number | null = null;
    let next = 0;
    for (let i = 0; i < stopIds.length; i++) {
        while (next < matched.length && matched[next].position === i) {
            const u = matched[next].update;
            result[i].skipped = u.skipped;
            current = u.departureDelay ?? u.arrivalDelay ?? current;
            next++;
        }
        result[i].delay = current;
    }
    return result;
}
