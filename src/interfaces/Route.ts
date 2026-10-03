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
    /** Format HH:MM: arrive before this time instead (latest departures first). */
    arrivalTime?: string;
    /** Only use stops accessible to wheelchairs. */
    wheelchair?: boolean;
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

export interface StopCall {
    stopId: string;
    name: string;
    lat: number;
    lon: number;
    time: string;
}

export interface BusStep {
    type: 'bus';
    line: string;
    lineName: string;
    color: string;
    /** Terminus of the trip. */
    headsign: string;
    from: { stopId: string; name: string; lat: number; lon: number };
    to: { stopId: string; name: string; lat: number; lon: number };
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
    /** True when the schedule of this direction was estimated (see LineDirectionSummary.estimated). */
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
    /** Set for arrive-by searches. */
    arrivalTime?: string;
    routes: RouteOption[];
    warnings: string[];
    /** Milliseconds. */
    calculationTime: number;
}
