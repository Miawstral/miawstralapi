/**
 * API types, mirrored from the backend (`src/interfaces/Route.ts` and
 * `src/interfaces/BusData.ts`). Keep them in sync when the contract changes.
 */

// ---------------------------------------------------------------------------
// Stops & lines
// ---------------------------------------------------------------------------

export type Direction = 'OUTWARD' | 'INWARD';

export interface StopSummary {
    stopPointId: string;
    name: string;
    city: string | null;
    latitude: string;
    longitude: string;
    accessible: boolean;
    /** Lines serving this stop (bus_id). */
    lines: string[];
    /** Only set by /api/stops/nearby, in meters. */
    distance?: number;
}

/** GET /api/stops/:id (not used by the UI yet). */
export interface StopDetails extends StopSummary {
    passingLines: {
        bus_id: string;
        direction: string;
        lineName: string;
        headsign: string;
        color: string;
        estimated: boolean;
        times: string[];
    }[];
}

export interface Departure {
    line: string;
    lineName: string;
    color: string;
    direction: Direction;
    headsign: string;
    time: string;
    estimated: boolean;
}

export interface DeparturesResponse {
    stop: StopSummary;
    time: string;
    departures: Departure[];
}

export interface LineDirectionSummary {
    direction: Direction;
    /** Name of the terminus. */
    headsign: string;
    /** True when no timetable was scraped for this direction and it was mirrored from the other one. */
    estimated: boolean;
    trips: number;
}

export interface LineSummary {
    bus_id: string;
    lineName: string;
    lineId: string | null;
    color: string;
    directions: LineDirectionSummary[];
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export interface Location {
    lat?: number;
    lon?: number;
    stopId?: string;
    name?: string;
}

export interface RouteRequest {
    from: Location;
    to: Location;
    /** Maximum walking distance to reach / leave the network, in meters (default 800). */
    maxWalkingDistance?: number;
    /** Maximum number of transfers (default 2, max 4). */
    maxTransfers?: number;
    /** Format HH:MM, defaults to the current time (Europe/Paris). */
    departureTime?: string;
    /** Lines (bus_id) that must not be used. */
    excludedLines?: string[];
    /** Number of itineraries to return (default 5, max 10). */
    maxResults?: number;
    /** Fetch street-level geometries from OSRM (default true). */
    includeGeometry?: boolean;
}

export interface Place {
    lat: number;
    lon: number;
    name?: string;
    stopId?: string;
}

export interface StopRef {
    stopId: string;
    name: string;
    lat: number;
    lon: number;
}

export interface WalkStep {
    type: 'walk';
    from: Place;
    to: Place;
    departureTime: string;
    arrivalTime: string;
    /** Minutes. */
    duration: number;
    /** Meters. */
    distance: number;
    geometry?: [number, number][];
}

export interface StopCall extends StopRef {
    time: string;
}

export interface BusStep {
    type: 'bus';
    line: string;
    lineName: string;
    color: string;
    /** Terminus of the trip. */
    headsign: string;
    from: StopRef;
    to: StopRef;
    departureTime: string;
    arrivalTime: string;
    /** Number of hops between boarding and alighting. */
    stopsCount: number;
    /** Stops served between boarding and alighting (excluded). */
    intermediateStops: StopCall[];
    /** Minutes. */
    duration: number;
    /** Meters. */
    distance: number;
    /** True when the schedule of this direction was estimated (mirrored from the opposite direction). */
    estimated: boolean;
    geometry?: [number, number][];
}

export type RouteStep = WalkStep | BusStep;

export interface RouteOption {
    departureTime: string;
    arrivalTime: string;
    /** Minutes, from leaving the origin to reaching the destination. */
    duration: number;
    transfers: number;
    /** Meters. */
    walkingDistance: number;
    estimated: boolean;
    steps: RouteStep[];
    /** Lower is better: duration plus a penalty per transfer. */
    score: number;
}

export interface RouteResponse {
    from: Place;
    to: Place;
    departureTime: string;
    routes: RouteOption[];
    warnings: string[];
    /** Milliseconds. */
    calculationTime: number;
}

// ---------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------

export interface ApiSuccess<T> {
    success: true;
    data: T;
}

export interface ApiErrorBody {
    success: false;
    message: string;
    details?: unknown;
}
