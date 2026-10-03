import { unzipSync, strFromU8 } from 'fflate';
import { parseCsv } from './csv';

/** In-memory GTFS feed (only what Miawstral uses). */

export type TransitMode = 'bus' | 'boat' | 'cable' | 'tram' | 'rail';

export interface GtfsRoute {
    id: string;
    shortName: string;
    longName: string;
    mode: TransitMode;
    color: string;
    textColor: string;
    sortOrder: number;
}

export interface GtfsStop {
    id: string;
    name: string;
    lat: number;
    lon: number;
    wheelchair: boolean;
}

export interface GtfsTrip {
    id: string;
    routeId: string;
    serviceId: string;
    headsign: string;
    directionId: 0 | 1;
    shapeId: string | null;
    stopIds: string[];
    /** Seconds after midnight of the service day (may exceed 24 h). */
    departures: number[];
    arrivals: number[];
    /** shape_dist_traveled of each stop, when given. */
    distances: number[] | null;
}

export interface GtfsShape {
    points: [number, number][];
    /** Cumulative distance of each point (same unit as stop_times.shape_dist_traveled). */
    distances: number[];
}

export interface GtfsFeed {
    routes: Map<string, GtfsRoute>;
    stops: Map<string, GtfsStop>;
    trips: Map<string, GtfsTrip>;
    shapes: Map<string, GtfsShape>;
    /** service_id → weekday flags (Monday first) and validity (YYYYMMDD). */
    calendar: Map<string, { days: boolean[]; start: string; end: string }>;
    /** service_id → date (YYYYMMDD) → 1 added / 2 removed. */
    calendarDates: Map<string, Map<string, 1 | 2>>;
    feedInfo: { version: string | null; startDate: string | null; endDate: string | null; publisher: string | null };
}

const MODES: Record<string, TransitMode> = { '0': 'tram', '2': 'rail', '3': 'bus', '4': 'boat', '6': 'cable', '700': 'bus', '1200': 'boat' };

/** "25:10:00" → 90600. */
export function parseGtfsTime(value: string): number | null {
    const match = /^\s*(\d{1,3}):(\d{2}):(\d{2})\s*$/.exec(value);
    return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null;
}

function hexColor(value: string | undefined, fallback: string): string {
    return value && /^[0-9a-f]{6}$/i.test(value.trim()) ? `#${value.trim().toLowerCase()}` : fallback;
}

/** Parses a GTFS zip archive. */
export function parseGtfsZip(zip: Uint8Array): GtfsFeed {
    const files = unzipSync(zip, { filter: file => file.name.endsWith('.txt') });
    const read = (name: string, onRow: (row: Record<string, string>) => void) => {
        const entry = Object.keys(files).find(f => f === name || f.endsWith(`/${name}`));
        if (entry) parseCsv(strFromU8(files[entry]), onRow);
    };
    return parseGtfsFiles(read);
}

/** Builds the feed from a file reader (`read(name, onRow)`), shared with tests. */
export function parseGtfsFiles(read: (name: string, onRow: (row: Record<string, string>) => void) => void): GtfsFeed {
    const feed: GtfsFeed = {
        routes: new Map(),
        stops: new Map(),
        trips: new Map(),
        shapes: new Map(),
        calendar: new Map(),
        calendarDates: new Map(),
        feedInfo: { version: null, startDate: null, endDate: null, publisher: null },
    };

    read('routes.txt', r => {
        feed.routes.set(r.route_id, {
            id: r.route_id,
            shortName: r.route_short_name || r.route_id,
            longName: r.route_long_name ?? '',
            mode: MODES[r.route_type] ?? 'bus',
            color: hexColor(r.route_color, '#64748b'),
            textColor: hexColor(r.route_text_color, '#ffffff'),
            sortOrder: Number(r.route_sort_order) || 0,
        });
    });

    read('stops.txt', r => {
        if (r.location_type && r.location_type !== '0') return;
        const lat = Number(r.stop_lat);
        const lon = Number(r.stop_lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        feed.stops.set(r.stop_id, { id: r.stop_id, name: r.stop_name.trim(), lat, lon, wheelchair: r.wheelchair_boarding === '1' });
    });

    read('trips.txt', r => {
        feed.trips.set(r.trip_id, {
            id: r.trip_id,
            routeId: r.route_id,
            serviceId: r.service_id,
            headsign: (r.trip_headsign ?? '').replace(/^Direction_/, '').replace(/_/g, ' ').trim(),
            directionId: r.direction_id === '1' ? 1 : 0,
            shapeId: r.shape_id || null,
            stopIds: [],
            departures: [],
            arrivals: [],
            distances: [],
        });
    });

    // stop_times may come unordered: collect then sort by stop_sequence.
    const rows = new Map<string, { seq: number; stop: string; arr: number; dep: number; dist: number }[]>();
    read('stop_times.txt', r => {
        const dep = parseGtfsTime(r.departure_time || r.arrival_time);
        const arr = parseGtfsTime(r.arrival_time || r.departure_time);
        if (dep === null || arr === null || !feed.trips.has(r.trip_id)) return;
        let list = rows.get(r.trip_id);
        if (!list) rows.set(r.trip_id, (list = []));
        list.push({ seq: Number(r.stop_sequence), stop: r.stop_id, arr, dep, dist: r.shape_dist_traveled === '' ? NaN : Number(r.shape_dist_traveled) });
    });
    for (const [tripId, list] of rows) {
        const trip = feed.trips.get(tripId)!;
        list.sort((a, b) => a.seq - b.seq);
        trip.stopIds = list.map(s => s.stop);
        trip.departures = list.map(s => s.dep);
        trip.arrivals = list.map(s => s.arr);
        trip.distances = list.every(s => Number.isFinite(s.dist)) ? list.map(s => s.dist) : null;
    }
    for (const [id, trip] of feed.trips) if (trip.stopIds.length < 2) feed.trips.delete(id);

    const shapePoints = new Map<string, { seq: number; lat: number; lon: number; dist: number }[]>();
    read('shapes.txt', r => {
        let list = shapePoints.get(r.shape_id);
        if (!list) shapePoints.set(r.shape_id, (list = []));
        list.push({ seq: Number(r.shape_pt_sequence), lat: Number(r.shape_pt_lat), lon: Number(r.shape_pt_lon), dist: Number(r.shape_dist_traveled) });
    });
    for (const [id, list] of shapePoints) {
        list.sort((a, b) => a.seq - b.seq);
        feed.shapes.set(id, { points: list.map(p => [p.lat, p.lon]), distances: list.map(p => p.dist) });
    }

    read('calendar.txt', r => {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(d => r[d] === '1');
        feed.calendar.set(r.service_id, { days, start: r.start_date, end: r.end_date });
    });
    read('calendar_dates.txt', r => {
        let dates = feed.calendarDates.get(r.service_id);
        if (!dates) feed.calendarDates.set(r.service_id, (dates = new Map()));
        dates.set(r.date, r.exception_type === '2' ? 2 : 1);
    });
    read('feed_info.txt', r => {
        feed.feedInfo = {
            version: r.feed_version || null,
            startDate: r.feed_start_date || null,
            endDate: r.feed_end_date || null,
            publisher: r.feed_publisher_name || null,
        };
    });
    return feed;
}

/** "2026-10-03" → "20261003". */
export const compactDate = (date: string) => date.replaceAll('-', '');

/** Services running on a date (YYYY-MM-DD). */
export function activeServices(feed: GtfsFeed, date: string): Set<string> {
    const day = compactDate(date);
    const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
    const active = new Set<string>();
    for (const [id, cal] of feed.calendar) {
        if (cal.days[weekday] && cal.start <= day && day <= cal.end) active.add(id);
    }
    for (const [id, dates] of feed.calendarDates) {
        const exception = dates.get(day);
        if (exception === 1) active.add(id);
        else if (exception === 2) active.delete(id);
    }
    return active;
}
