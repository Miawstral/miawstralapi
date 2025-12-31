import { BusLine, Stop } from '../../interfaces/BusData';
import { RouteStep, BusStep, WalkStep } from '../../interfaces/Route';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(__dirname, '../../data');

/**
 * Parse time "HH:MM" to minutes since midnight
 */
export function parseTime(timeStr: string): number | null {
    if (!timeStr || !timeStr.includes(':')) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return hours * 60 + minutes;
}


/**
 * Connection represents a direct bus trip between two stops at a specific time
 */
export interface Connection {
    line: BusLine;
    fromStopId: string;
    toStopId: string;
    fromIndex: number;
    toIndex: number;
    departureTime: number; // minutes since midnight
    arrivalTime: number;
    duration: number;
}

/**
 * Build all possible connections from the schedule data
 * This is the core of Connection Scan Algorithm
 */
export function buildConnectionsDatabase(): Connection[] {
    const connections: Connection[] = [];
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('_horaires.json'));

    for (const file of files) {
        const filePath = path.join(dataDir, file);
        const line: BusLine = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // For each pair of consecutive stops
        for (let i = 0; i < line.stops.length - 1; i++) {
            const fromStop = line.stops[i];
            const toStop = line.stops[i + 1];

            if (!fromStop.stopPointId || !toStop.stopPointId) continue;
            if (!fromStop.times || !toStop.times) continue;

            // For each schedule time
            const maxSchedules = Math.min(fromStop.times.length, toStop.times.length);
            for (let scheduleIdx = 0; scheduleIdx < maxSchedules; scheduleIdx++) {
                const depTime = parseTime(fromStop.times[scheduleIdx]);
                const arrTime = parseTime(toStop.times[scheduleIdx]);

                if (depTime === null || arrTime === null) continue;

                let duration;
                if (arrTime >= depTime) {
                    duration = arrTime - depTime;
                } else {
                    // Crosses midnight
                    duration = (24 * 60 - depTime) + arrTime;
                }

                // Only keep reasonable durations (1-120 minutes between consecutive stops)
                if (duration < 1 || duration > 120) continue;

                connections.push({
                    line,
                    fromStopId: fromStop.stopPointId,
                    toStopId: toStop.stopPointId,
                    fromIndex: i,
                    toIndex: i + 1,
                    departureTime: depTime,
                    arrivalTime: arrTime,
                    duration
                });
            }
        }
    }

    // Sort by departure time - critical for CSA efficiency
    connections.sort((a, b) => a.departureTime - b.departureTime);

    console.log(`[ROUTING] Built ${connections.length} connections from schedules`);
    return connections;
}

/**
 * Find all direct connections between two stops (0 transfers)
 */
export function findDirectConnections(
    connections: Connection[],
    fromStopId: string,
    toStopId: string,
    departureAfter: number = 0
): Connection[] {
    const direct: Connection[] = [];
    const seenLines = new Set<string>();

    // Group connections by line to find multi-stop journeys
    const lineGroups = new Map<string, Connection[]>();

    for (const conn of connections) {
        if (conn.departureTime < departureAfter) continue;

        const key = `${conn.line.bus_id}`;
        if (!lineGroups.has(key)) {
            lineGroups.set(key, []);
        }
        lineGroups.get(key)!.push(conn);
    }

    // For each line, check if we can go from fromStop to toStop
    for (const [lineKey, lineConns] of lineGroups) {
        const line = lineConns[0].line;

        // Find indices in the line
        const fromIdx = line.stops.findIndex(s => s.stopPointId === fromStopId);
        const toIdx = line.stops.findIndex(s => s.stopPointId === toStopId);

        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) continue;

        // Check each schedule
        const fromStop = line.stops[fromIdx];
        const toStop = line.stops[toIdx];

        if (!fromStop.times || !toStop.times) continue;

        for (let i = 0; i < Math.min(fromStop.times.length, toStop.times.length); i++) {
            const depTime = parseTime(fromStop.times[i]);
            const arrTime = parseTime(toStop.times[i]);

            if (depTime === null || arrTime === null || depTime < departureAfter) continue;

            let duration;
            if (arrTime >= depTime) {
                duration = arrTime - depTime;
            } else {
                duration = (24 * 60 - depTime) + arrTime;
            }

            if (duration < 1 || duration > 180) continue;

            direct.push({
                line,
                fromStopId,
                toStopId,
                fromIndex: fromIdx,
                toIndex: toIdx,
                departureTime: depTime,
                arrivalTime: arrTime,
                duration
            });
        }
    }

    return direct.sort((a, b) => a.departureTime - b.departureTime);
}

/**
 * Connection Scan Algorithm - Simplified and Working Version
 * Scans all connections in chronological order
 */
export function findBestJourneysCSA(
    allConnections: Connection[],
    fromStopIds: string[],
    toStopIds: string[],
    departureAfter: number = 0,
    maxTransfers: number = 2
): Journey[] {
    console.log(`[CSA] Starting with ${allConnections.length} total connections`);
    console.log(`[CSA] From stops: ${fromStopIds.length}, To stops: ${toStopIds.length}`);
    console.log(`[CSA] Departure after: ${departureAfter} (${Math.floor(departureAfter / 60)}:${String(departureAfter % 60).padStart(2, '0')})`);

    // Filter connections that depart after requested time
    const validConnections = allConnections.filter(c => c.departureTime >= departureAfter);
    console.log(`[CSA] Valid connections after time filter: ${validConnections.length}`);

    // Track earliest arrival time at each stop
    const earliestArrival = new Map<string, number>();

    // Track how we got to each stop (parent connection)
    const reachedBy = new Map<string, Connection | null>();

    // Track the number of transfers to reach each stop
    const transfersTo = new Map<string, number>();

    // Initialize starting positions
    for (const stopId of fromStopIds) {
        earliestArrival.set(stopId, departureAfter);
        reachedBy.set(stopId, null);
        transfersTo.set(stopId, 0);
    }

    // Scan all connections in order
    for (const conn of validConnections) {
        const arrivalAtFromStop = earliestArrival.get(conn.fromStopId);

        // Can we catch this connection?
        if (arrivalAtFromStop === undefined) continue;
        if (arrivalAtFromStop > conn.departureTime) continue;

        // Calculate transfers: if we came from a different connection, it's a transfer
        const previousConn = reachedBy.get(conn.fromStopId);
        const currentTransfers = transfersTo.get(conn.fromStopId) || 0;

        // If previous connection exists and is on a different line, it's a transfer
        let newTransfers = currentTransfers;
        if (previousConn !== null && previousConn !== undefined) {
            if (previousConn.line.bus_id !== conn.line.bus_id) {
                newTransfers = currentTransfers + 1;
            }
        }

        // Would this require too many transfers?
        if (newTransfers > maxTransfers) continue;

        // Can we improve the arrival time at the destination?
        const currentBestArrival = earliestArrival.get(conn.toStopId);

        if (currentBestArrival === undefined || conn.arrivalTime < currentBestArrival) {
            earliestArrival.set(conn.toStopId, conn.arrivalTime);
            reachedBy.set(conn.toStopId, conn);
            transfersTo.set(conn.toStopId, newTransfers);
        }
    }

    // Reconstruct journeys to all reachable destinations
    const journeys: Journey[] = [];

    for (const toStopId of toStopIds) {
        if (!earliestArrival.has(toStopId)) continue;

        // Reconstruct path backwards
        const path: Connection[] = [];
        let currentStopId: string | null = toStopId;

        while (currentStopId) {
            const connToThisStop = reachedBy.get(currentStopId);
            if (!connToThisStop) break;
            path.unshift(connToThisStop);
            currentStopId = connToThisStop.fromStopId;
        }

        if (path.length === 0) continue;

        // Verify the path starts from one of our start stops
        if (!fromStopIds.includes(path[0].fromStopId)) continue;

        journeys.push({
            connections: path,
            totalDuration: earliestArrival.get(toStopId)! - departureAfter,
            transfers: transfersTo.get(toStopId)!,
            departureTime: path[0].departureTime,
            arrivalTime: earliestArrival.get(toStopId)!
        });
    }

    console.log(`[CSA] Found ${journeys.length} journeys`);

    // Sort by: 1) fewer transfers, 2) earlier arrival
    journeys.sort((a, b) => {
        if (a.transfers !== b.transfers) return a.transfers - b.transfers;
        return a.arrivalTime - b.arrivalTime;
    });

    return journeys.slice(0, 5);
}


export interface Journey {
    connections: Connection[];
    totalDuration: number;
    transfers: number;
    departureTime: number;
    arrivalTime: number;
}

/**
 * Convert journey to RouteSteps format
 * Merges consecutive connections on the same line
 */
export function journeyToSteps(journey: Journey): Connection[] {
    // Merge consecutive connections on the same line
    const merged: Connection[] = [];
    let current = journey.connections[0];

    for (let i = 1; i < journey.connections.length; i++) {
        const next = journey.connections[i];

        // Same line and consecutive in time?
        if (current.line.bus_id === next.line.bus_id &&
            current.toStopId === next.fromStopId &&
            current.arrivalTime <= next.departureTime) {
            // Merge
            current = {
                ...current,
                toStopId: next.toStopId,
                toIndex: next.toIndex,
                arrivalTime: next.arrivalTime,
                duration: current.duration + next.duration
            };
        } else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);

    return merged;
}
