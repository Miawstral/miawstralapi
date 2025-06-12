export interface Stop {
    name: string;
    city: string;
    latitude: string | null;
    longitude: string | null;
    stopPointId: string | null;
    accessible: boolean;
    times: string[];
}

export interface BusLine {
    bus_id: string;
    lineName: string;
    direction: string;
    lineId: string;
    stops: Stop[];
    notes: string[];
}

export interface StopDetails {

    stopPointId: string;
    name: string;
    city: string;
    latitude: string | null;
    longitude: string | null;
    accessible: boolean;
    passingLines: {
        bus_id: string;
        direction: string;
        lineName: string;
        times: string[];
    }[];
}