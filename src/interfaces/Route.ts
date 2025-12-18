export interface Location {
    lat?: number;
    lon?: number;
    stopId?: string;
}

export interface RouteRequest {
    from: Location;
    to: Location;
    maxWalkingDistance?: number;
    maxTransfers?: number;
    departureTime?: string;  // Format HH:MM
    arrivalTime?: string;    // Format HH:MM
    excludedLines?: string[];
}

export interface WalkStep {
    type: 'walk';
    from: { lat: number; lon: number; name?: string };
    to: { lat: number; lon: number; name?: string, stopId?: string };
    duration: number;
    distance: number;
    geometry?: [number, number][];
}

export interface BusStep {
    type: 'bus';
    line: string;
    lineName: string;
    color: string;
    from: { stopId: string; name: string; lat: number; lon: number };
    to: { stopId: string; name: string; lat: number; lon: number };
    departureTime?: string;
    arrivalTime?: string;
    stopsCount: number;
    duration: number;  
    distance: number;  
    geometry?: [number, number][];
}

export type RouteStep = WalkStep | BusStep;

export interface RouteOption {
    duration: number;
    transfers: number;
    walkingDistance: number;
    steps: RouteStep[];
    score: number;
}

export interface RouteResponse {
    from: { lat: number; lon: number; name?: string };
    to: { lat: number; lon: number; name?: string };
    routes: RouteOption[] | null;
    calculationTime: number;
}