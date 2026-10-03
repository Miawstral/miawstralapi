import type { Pattern, TransitNetwork, Trip } from '../network/network';

/**
 * RAPTOR (Round-bAsed Public Transit Optimized Router, Delling et al. 2012).
 *
 * Round k computes the earliest arrival at every stop using at most k
 * vehicles. Each round scans the patterns serving the stops improved in the
 * previous round, then relaxes the walking transfers. The result is the set
 * of Pareto-optimal journeys for (arrival time, number of vehicles).
 */

export interface StopAccess {
    stop: number;
    /** Walking minutes between the origin/destination and the stop. */
    duration: number;
    /** Meters. */
    distance: number;
}

export interface RaptorQuery {
    /** Minutes since midnight. */
    departure: number;
    /** Stops reachable on foot from the origin. */
    access: StopAccess[];
    /** Stops from which the destination is reachable on foot. */
    egress: StopAccess[];
    maxTransfers: number;
    excludedLines?: ReadonlySet<string>;
    /** Minutes needed to change vehicle at the same stop. */
    minTransferTime?: number;
    /** Board and alight only at stops accessible to wheelchairs. */
    accessibleOnly?: boolean;
}

export type JourneyLeg =
    | { type: 'access'; to: number; departure: number; arrival: number; distance: number }
    | { type: 'ride'; trip: Trip; boardPos: number; alightPos: number; departure: number; arrival: number }
    | { type: 'transfer'; from: number; to: number; departure: number; arrival: number; distance: number }
    | { type: 'egress'; from: number; departure: number; arrival: number; distance: number };

export interface Journey {
    legs: JourneyLeg[];
    /** Time to leave the origin (minutes). */
    departure: number;
    /** Time of arrival at the destination (minutes). */
    arrival: number;
    transfers: number;
}

type RideLabel = { type: 'ride'; trip: Trip; boardPos: number; alightPos: number };
type Label =
    | { type: 'access'; access: StopAccess }
    | RideLabel
    | { type: 'transfer'; from: number; duration: number; distance: number };

const DEFAULT_MIN_TRANSFER_TIME = 2;

/** Earliest trip of the pattern leaving `position` at or after `time`. */
function earliestTrip(pattern: Pattern, position: number, time: number): Trip | null {
    const trips = pattern.trips;
    if (pattern.fifo) {
        let lo = 0;
        let hi = trips.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (trips[mid].times[position] < time) lo = mid + 1;
            else hi = mid;
        }
        return lo < trips.length ? trips[lo] : null;
    }
    let best: Trip | null = null;
    for (const trip of trips) {
        const t = trip.times[position];
        if (t >= time && (!best || t < best.times[position])) best = trip;
    }
    return best;
}

/** Pareto-optimal journeys from the access stops to the egress stops. */
export function raptor(network: TransitNetwork, query: RaptorQuery): Journey[] {
    return search(network, query).journeys;
}

export interface Reach {
    /** Earliest arrival (minutes) at each stop, Infinity when unreachable. */
    arrival: Float64Array;
    /** Vehicles used to get there (0 = on foot). */
    rides: Int8Array;
}

/** Earliest arrival at every stop of the network (one-to-all), e.g. for isochrones. */
export function reachability(network: TransitNetwork, query: Omit<RaptorQuery, 'egress'>): Reach {
    const { best, rides } = search(network, { ...query, egress: [] });
    return { arrival: best, rides };
}

function search(network: TransitNetwork, query: RaptorQuery): { journeys: Journey[]; best: Float64Array; rides: Int8Array } {
    const n = network.stops.length;
    const maxRides = query.maxTransfers + 1;
    const minTransfer = query.minTransferTime ?? DEFAULT_MIN_TRANSFER_TIME;
    const excluded = query.excludedLines ?? new Set<string>();

    const arrival: Float64Array[] = [];
    const labels: (Label | undefined)[][] = [];
    /**
     * Arrivals by vehicle, kept apart because a walking transfer may later
     * improve the same stop in the same round: transfers always start from these.
     */
    const rideLabels: (RideLabel | undefined)[][] = [];
    const best = new Float64Array(n).fill(Infinity);
    const rides = new Int8Array(n);
    const accessible = query.accessibleOnly ? network.stops.map(s => s.accessible) : null;
    for (let k = 0; k <= maxRides; k++) {
        arrival.push(new Float64Array(n).fill(Infinity));
        labels.push(new Array(n));
        rideLabels.push(new Array(n));
    }

    const egress = new Map<number, StopAccess>();
    for (const e of query.egress) {
        const known = egress.get(e.stop);
        if (!known || e.duration < known.duration) egress.set(e.stop, e);
    }
    let targetBound = Infinity;
    const improve = (k: number, stop: number, time: number, label: Label) => {
        arrival[k][stop] = time;
        best[stop] = time;
        rides[stop] = k;
        labels[k][stop] = label;
        // Only journeys using a vehicle bound the search: walking the whole way is the planner's business.
        const e = k > 0 ? egress.get(stop) : undefined;
        if (e && time + e.duration < targetBound) targetBound = time + e.duration;
    };

    /** Round in which the label of `stop`, as known in round `k`, was set. */
    const labelRound = (k: number, stop: number): number => {
        let r = k;
        while (r > 0 && labels[r][stop] === undefined) r--;
        return r;
    };

    let marked = new Set<number>();
    for (const a of query.access) {
        const time = query.departure + a.duration;
        if (time < arrival[0][a.stop]) {
            improve(0, a.stop, time, { type: 'access', access: a });
            marked.add(a.stop);
        }
    }

    const journeys: Journey[] = [];
    let bestAtTarget = Infinity;

    for (let k = 1; k <= maxRides && marked.size > 0; k++) {
        arrival[k].set(arrival[k - 1]);

        // Patterns to scan, from the first marked stop they serve.
        const queue = new Map<number, number>();
        for (const stop of marked) {
            for (const { pattern, position } of network.stopPatterns[stop]) {
                if (excluded.has(network.patterns[pattern].line)) continue;
                const start = queue.get(pattern);
                if (start === undefined || position < start) queue.set(pattern, position);
            }
        }

        const reachedByRide = new Set<number>();
        for (const [patternIndex, start] of queue) {
            const pattern = network.patterns[patternIndex];
            let trip: Trip | null = null;
            let boardPos = -1;

            for (let pos = start; pos < pattern.stops.length; pos++) {
                const stop = pattern.stops[pos];

                if (trip) {
                    const t = trip.times[pos];
                    if (t < best[stop] && t < targetBound && (!accessible || accessible[stop])) {
                        const label: RideLabel = { type: 'ride', trip, boardPos, alightPos: pos };
                        improve(k, stop, t, label);
                        rideLabels[k][stop] = label;
                        reachedByRide.add(stop);
                    }
                }

                const previous = arrival[k - 1][stop];
                if (previous === Infinity || (accessible && !accessible[stop])) continue;
                const previousLabel = labels[labelRound(k - 1, stop)][stop];
                const ready = previous + (previousLabel?.type === 'ride' ? minTransfer : 0);
                if (trip && ready > trip.times[pos]) continue;
                const candidate = earliestTrip(pattern, pos, ready);
                if (candidate && (!trip || candidate.times[pos] < trip.times[pos])) {
                    trip = candidate;
                    boardPos = pos;
                }
            }
        }

        // Walking transfers from the stops reached by a vehicle in this round.
        marked = new Set(reachedByRide);
        for (const stop of reachedByRide) {
            const ride = rideLabels[k][stop]!;
            const from = ride.trip.times[ride.alightPos];
            for (const fp of network.footpaths[stop]) {
                const t = from + fp.duration;
                if (t < best[fp.to] && t < targetBound) {
                    improve(k, fp.to, t, { type: 'transfer', from: stop, duration: fp.duration, distance: fp.distance });
                    marked.add(fp.to);
                }
            }
        }

        // New Pareto-optimal journey with k vehicles?
        let roundBest = Infinity;
        let roundStop = -1;
        for (const [stop, e] of egress) {
            const t = arrival[k][stop] + e.duration;
            if (t < roundBest) {
                roundBest = t;
                roundStop = stop;
            }
        }
        if (roundStop >= 0 && roundBest < bestAtTarget) {
            bestAtTarget = roundBest;
            const journey = reconstruct(k, roundStop);
            if (journey) journeys.push(journey);
        }
    }

    return { journeys, best, rides };

    function reconstruct(round: number, target: number): Journey | null {
        const legs: JourneyLeg[] = [];
        const e = egress.get(target)!;
        const lastArrival = arrival[round][target];
        legs.push({ type: 'egress', from: target, departure: lastArrival, arrival: lastArrival + e.duration, distance: e.distance });

        let stop = target;
        let k = round;
        let afterTransfer = false;
        for (let guard = 0; guard < 4 * (round + 2); guard++) {
            const r = afterTransfer ? k : labelRound(k, stop);
            const label = afterTransfer ? rideLabels[r][stop] : labels[r][stop];
            afterTransfer = false;
            if (!label) return null;

            if (label.type === 'access') {
                const firstRide = legs.find(l => l.type === 'ride');
                // Leave the origin just in time for the first vehicle.
                const arrivalAtStop = firstRide ? firstRide.departure : arrival[0][stop];
                legs.unshift({
                    type: 'access',
                    to: stop,
                    departure: arrivalAtStop - label.access.duration,
                    arrival: arrivalAtStop,
                    distance: label.access.distance,
                });
                const rides = legs.filter(l => l.type === 'ride').length;
                return {
                    legs,
                    departure: legs[0].departure,
                    arrival: legs[legs.length - 1].arrival,
                    transfers: Math.max(0, rides - 1),
                };
            }
            if (label.type === 'transfer') {
                const ride = rideLabels[r][label.from];
                if (!ride) return null;
                const departure = ride.trip.times[ride.alightPos];
                legs.unshift({
                    type: 'transfer',
                    from: label.from,
                    to: stop,
                    departure,
                    arrival: departure + label.duration,
                    distance: label.distance,
                });
                stop = label.from;
                k = r;
                afterTransfer = true;
                continue;
            }
            const { trip, boardPos, alightPos } = label;
            legs.unshift({
                type: 'ride',
                trip,
                boardPos,
                alightPos,
                departure: trip.times[boardPos],
                arrival: trip.times[alightPos],
            });
            stop = trip.stops[boardPos];
            k = r - 1;
        }
        return null;
    }
}
