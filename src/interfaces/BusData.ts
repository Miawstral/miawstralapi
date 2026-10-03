/**
 * Stop, line and real-time shapes returned by the public API.
 */

export type Direction = 'OUTWARD' | 'INWARD';
export type TransitMode = 'bus' | 'boat' | 'cable' | 'tram' | 'rail';

export interface StopSummary {
    stopPointId: string;
    name: string;
    city: string | null;
    latitude: string;
    longitude: string;
    accessible: boolean;
    /** Lines serving this stop on the service day (line ids). */
    lines: string[];
    /** Only set by /api/stops/nearby, in meters. */
    distance?: number;
}

export interface StopDetails extends StopSummary {
    passingLines: {
        bus_id: string;
        lineName: string;
        color: string;
        textColor: string;
        mode: TransitMode;
        direction: Direction;
        headsign: string;
        /** Chronological passing times at this stop. */
        times: string[];
    }[];
}

export interface RealtimeInfo {
    /** Expected time, "HH:MM". */
    time: string;
    /** Seconds, positive when late. */
    delay: number;
}

export interface Departure {
    tripId: string;
    line: string;
    lineName: string;
    color: string;
    textColor: string;
    mode: TransitMode;
    direction: Direction;
    headsign: string;
    /** Scheduled time, "HH:MM". */
    time: string;
    /** Real-time prediction when the trip is tracked. */
    realtime: RealtimeInfo | null;
    cancelled: boolean;
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

export interface LineStop extends Omit<StopSummary, 'lines' | 'distance'> {
    /** Times at which a trip of this direction serves the stop, chronological. */
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
        /** [lat, lon] points of the itinerary. */
        coordinates: [number, number][];
        stops: { stopPointId: string; name: string; lat: number; lon: number }[];
    }[];
}

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
    /** Degrees, clockwise from north. */
    bearing: number | null;
    /** km/h */
    speed: number | null;
    /** Seconds, positive when late. */
    delay: number | null;
    status: 'INCOMING_AT' | 'STOPPED_AT' | 'IN_TRANSIT_TO' | null;
    nextStop: { stopPointId: string; name: string } | null;
    /** ISO date of the position. */
    updatedAt: string | null;
}

export interface ServiceAlert {
    id: string;
    title: string;
    description: string;
    url: string | null;
    cause: string | null;
    effect: string | null;
    /** ISO dates. */
    start: string | null;
    end: string | null;
    /** Currently in effect (otherwise upcoming). */
    active: boolean;
    lines: { id: string; color: string; textColor: string }[];
    stops: { stopPointId: string; name: string }[];
}
