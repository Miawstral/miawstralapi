/**
 * API types, mirrored from the backend (`src/interfaces/Route.ts` and
 * `src/interfaces/BusData.ts`). Keep them in sync when the contract changes.
 */

// ---------------------------------------------------------------------------
// Stops & lines
// ---------------------------------------------------------------------------

export type Direction = 'OUTWARD' | 'INWARD';
export type TransitMode = 'bus' | 'boat' | 'cable' | 'tram' | 'rail';

export interface StopSummary {
    stopPointId: string;
    name: string;
    city: string | null;
    latitude: string;
    longitude: string;
    accessible: boolean;
    /** Lines serving this stop (line ids). */
    lines: string[];
    /** Only set by /api/stops/nearby, in meters. */
    distance?: number;
}

export interface RealtimeInfo {
    /** Expected time "HH:MM". */
    time: string;
    /** Seconds, positive when late. */
    delay: number;
}

export interface Departure {
    tripId: string;
    stopPointId: string;
    line: string;
    lineName: string;
    color: string;
    textColor: string;
    mode: TransitMode;
    direction: Direction;
    headsign: string;
    /** Scheduled time "HH:MM". */
    time: string;
    realtime: RealtimeInfo | null;
    cancelled: boolean;
}

export interface DeparturesResponse {
    stop: StopSummary;
    serviceDate: string;
    time: string;
    /** Real-time data was available. */
    realtime: boolean;
    departures: Departure[];
}

export interface LineDirectionSummary {
    direction: Direction;
    /** Name of the terminus. */
    headsign: string;
    trips: number;
}

export interface LineSummary {
    bus_id: string;
    lineName: string;
    lineId: string;
    color: string;
    textColor: string;
    mode: TransitMode;
    directions: LineDirectionSummary[];
}

export interface LineStop {
    stopPointId: string;
    name: string;
    city: string | null;
    latitude: string;
    longitude: string;
    accessible: boolean;
    times: string[];
}

export interface LineDetails extends Omit<LineSummary, 'directions'> {
    serviceDate: string;
    directions: (LineDirectionSummary & { stops: LineStop[] })[];
}

export interface LineShape {
    bus_id: string;
    color: string;
    directions: {
        direction: Direction;
        headsign: string;
        coordinates: [number, number][];
        stops: { stopPointId: string; name: string; lat: number; lon: number }[];
    }[];
}

// ---------------------------------------------------------------------------
// Real time
// ---------------------------------------------------------------------------

export interface Vehicle {
    id: string;
    label: string | null;
    tripId: string | null;
    line: string | null;
    lineName: string | null;
    color: string;
    textColor: string;
    mode: TransitMode;
    headsign: string | null;
    lat: number;
    lon: number;
    bearing: number | null;
    /** km/h */
    speed: number | null;
    /** Seconds, positive when late. */
    delay: number | null;
    status: 'INCOMING_AT' | 'STOPPED_AT' | 'IN_TRANSIT_TO' | null;
    nextStop: { stopPointId: string; name: string } | null;
    updatedAt: string | null;
}

export interface VehiclesResponse {
    updatedAt: string | null;
    count: number;
    vehicles: Vehicle[];
}

export interface ServiceAlert {
    id: string;
    title: string;
    description: string;
    url: string | null;
    cause: string | null;
    effect: string | null;
    start: string | null;
    end: string | null;
    active: boolean;
    lines: { id: string; color: string; textColor: string }[];
    stops: { stopPointId: string; name: string }[];
}

// ---------------------------------------------------------------------------
// Explorer
// ---------------------------------------------------------------------------

export interface IsochroneStop {
    stopPointId: string;
    name: string;
    lat: number;
    lon: number;
    /** Minutes from the origin. */
    duration: number;
    transfers: number;
}

export interface IsochroneResponse {
    origin: Place;
    serviceDate: string;
    departureTime: string;
    maxDuration: number;
    calculationTime: number;
    stops: IsochroneStop[];
}

export interface DataStatus {
    source: {
        name: string;
        version: string | null;
        downloadedAt: string | null;
        validity: { from: string | null; to: string | null };
    };
    serviceDate: string;
    lines: number;
    stops: number;
    trips: number;
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
    /** Service day YYYY-MM-DD (default: today). */
    date?: string;
    /** HH:MM. */
    departureTime?: string;
    /** HH:MM: arrive before this time instead. */
    arrivalTime?: string;
    wheelchair?: boolean;
    maxWalkingDistance?: number;
    maxTransfers?: number;
    excludedLines?: string[];
    maxResults?: number;
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
    tripId: string;
    line: string;
    lineName: string;
    color: string;
    textColor: string;
    mode: TransitMode;
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
    realtime: { departureTime: string; arrivalTime: string; departureDelay: number; arrivalDelay: number } | null;
    cancelled: boolean;
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
    steps: RouteStep[];
    /** Ids of the alerts concerning the lines used. */
    alerts: string[];
    score: number;
}

export interface RouteResponse {
    from: Place;
    to: Place;
    serviceDate: string;
    departureTime: string;
    arrivalTime?: string;
    routes: RouteOption[];
    alerts: ServiceAlert[];
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
