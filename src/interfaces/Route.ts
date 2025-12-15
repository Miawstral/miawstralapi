export interface Location {
    lat?: number;
    lon?: number;
    stopId?: number;
}

export interface RouteRequest {
    from: Location;
    to: Location;
    maxWalkingDistance?: number;
    maxTransfers?: number;
    departureTime?: number;
}

export interface WalkStep {
    type: 'walk';
    from: { lat: number; lon: number; name?: string };
    to: { lat: number; lon: number; name?: string, stopId?: string };
    duration: number;
    distance: number;
}

export interface BusStep {
    type: 'bus';
    line: string;
    lineName: string;
    from: { stopId: string; name: string; lat: number; lon: number };
    to: { stopId: string; name: string; lat: number; lon: number };
    departureTime?: string;
    arrivalTime?: string;
    stopsCount: number;
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
    routes: RouteOption[];
    calculationTime: number;
}