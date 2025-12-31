import * as stopsService from '../stops/stops.service';
import * as linesService from '../lines/lines.service';
import { Stop, BusLine } from '../../interfaces/BusData';
import { RouteRequest, RouteOption, RouteStep, RouteResponse, BusStep, WalkStep, Location } from '../../interfaces/Route';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import {
    buildTransportGraph,
    dijkstra,
    Edge,
    parseTime,
    formatTime,
    findNextDeparture
} from './pathfinding.service';

const dataDir = path.join(__dirname, '../../data');

const WALKING_SPEED = 5; // km/h
const URBAN_FACTOR = 1.4;
const USE_OSRM = true; // Force OSRM usage
const OSRM_URL = process.env.OSRM_URL || 'https://osrm.1sheol.xyz';

// Cache for the transport graph (Dijkstra)
let transportGraph: Map<string, any> | null = null;

function getTransportGraph() {
    if (!transportGraph) {
        console.log('[ROUTING] Building transport graph (Dijkstra)...');
        transportGraph = buildTransportGraph();
    }
    return transportGraph;
}

/**
 * Calculation of real distance from OSRM
 */
async function getRealWalkingDistance(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number
): Promise<{ distance: number; duration: number }> {
    if (USE_OSRM) {
        try {
            const url = `${OSRM_URL}/route/v1/foot/${fromLon},${fromLat};${toLon},${toLat}?overview=false`;
            const response = await axios.get(url, { timeout: 2000 });

            if (response.data.code === 'Ok') {
                const route = response.data.routes[0];
                const distance = Math.round(route.distance);
                const duration = Math.ceil(route.duration / 60);
                return { distance, duration };
            }
        } catch (error) {
            console.log('[ROUTING] OSRM Failed, using urban factor fallback');
        }
    }

    const straightDistance = getDistance(fromLat, fromLon, toLat, toLon) * 1000;
    const realDistance = straightDistance * URBAN_FACTOR;
    return {
        distance: Math.round(realDistance),
        duration: Math.ceil((realDistance / 1000) / WALKING_SPEED * 60),
    }
}

/**
 * Get real trace of a route (walk or bus)
 */
async function getRouteGeometry(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    profile: 'foot' | 'car' = 'foot'
): Promise<{ distance: number; duration: number; geometry: [number, number][] }> {
    if (USE_OSRM) {
        try {
            const url = `${OSRM_URL}/route/v1/${profile}/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
            const response = await axios.get(url, { timeout: 5000 });

            if (response.data.code === 'Ok') {
                const route = response.data.routes[0];
                const geometry = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
                console.log(`[OSRM] ${profile} route: ${geometry.length} points, ${Math.round(route.distance)}m`);
                return {
                    distance: Math.round(route.distance),
                    duration: Math.ceil(route.duration / 60),
                    geometry
                };
            } else {
                console.log(`[OSRM] Response code: ${response.data.code}`);
            }
        } catch (error) {
            const err = error as any;
            console.log(`[OSRM] Failed: ${err.message || 'Unknown error'}`);
        }
    } else {
        console.log('[OSRM] Disabled, using fallback');
    }

    const straightDistance = getDistance(fromLat, fromLon, toLat, toLon) * 1000;
    console.log(`[FALLBACK] Using straight line: ${Math.round(straightDistance)}m`);
    return {
        distance: Math.round(straightDistance * URBAN_FACTOR),
        duration: Math.ceil((straightDistance * URBAN_FACTOR / 1000) / WALKING_SPEED * 60),
        geometry: [[fromLat, fromLon], [toLat, toLon]]
    };
}

/**
 * Calculate distance between 2 points (Haversine algorithm)
 */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}

/**
 * Find stops nearby a point.
 */
async function findNearbyStops(lat: number, lon: number, maxDistance: number): Promise<Stop[]> {
    const allStops = await stopsService.getAllStops();
    const nearby: Stop[] = [];

    for (const stop of allStops) {
        if (!stop.latitude || !stop.longitude) continue;

        const distance = getDistance(lat, lon, parseFloat(stop.latitude), parseFloat(stop.longitude));
        if (distance * 1000 <= maxDistance) {
            nearby.push(stop as Stop)
        }
    }

    return nearby.sort((a, b) => {
        const distA = getDistance(lat, lon, parseFloat(a.latitude!), parseFloat(a.longitude!));
        const distB = getDistance(lat, lon, parseFloat(b.latitude!), parseFloat(b.longitude!));
        return distA - distB;
    });
}

/**
 * Resolve a location (based on coords or stopId)
 */
async function resolveLocation(location: Location): Promise<{ lat: number; lon: number; stopId?: string; name?: string }> {
    if (location.stopId) {
        const stop = await stopsService.getStopById(location.stopId);
        return {
            lat: parseFloat(stop.latitude!),
            lon: parseFloat(stop.longitude!),
            stopId: stop.stopPointId,
            name: stop.name,
        }
    }

    if (location.lat && location.lon) {
        return { lat: location.lat, lon: location.lon };
    }
    throw new Error('Location must have either lat/lon or stopId')
}

/**
 * Create a walk step
 */
async function createWalkStep(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    fromName?: string,
    toName?: string,
    toStopId?: string
): Promise<WalkStep> {
    const { distance, duration, geometry } = await getRouteGeometry(fromLat, fromLon, toLat, toLon, 'foot');

    return {
        type: 'walk',
        from: { lat: fromLat, lon: fromLon, name: fromName },
        to: { lat: toLat, lon: toLon, name: toName },
        duration, // minutes
        distance, // meters
        geometry
    };
}

/**
 * Create a bus step from a Dijkstra Edge with real schedule times
 */
async function createDijkstraBusStep(edge: any, departureAfter: number): Promise<{ step: BusStep; arrivalTime: number }> {
    const line = edge.busLine;
    
    console.log(`[DIJKSTRA] Creating bus step for line ${line.bus_id}: fromIndex=${edge.fromIndex}, toIndex=${edge.toIndex}, stopsCount=${edge.stopsCount}`);
    
    // Calculate total distance and geometry
    let totalDistance = 0;
    const geometry: [number, number][] = [];

    // Build geometry from fromIndex to toIndex
    const startIdx = Math.min(edge.fromIndex, edge.toIndex);
    const endIdx = Math.max(edge.fromIndex, edge.toIndex);
    
    console.log(`[DIJKSTRA] Building geometry from stop ${startIdx} to ${endIdx} (${endIdx - startIdx} segments)`);
    
    for (let i = startIdx; i < endIdx; i++) {
        const fromStop = line.stops[i];
        const toStop = line.stops[i + 1];

        const segment = await getRouteGeometry(
            parseFloat(fromStop.latitude!),
            parseFloat(fromStop.longitude!),
            parseFloat(toStop.latitude!),
            parseFloat(toStop.longitude!),
            'car'
        );

        // Add geometry, avoiding duplicates at connection points
        if (geometry.length === 0) {
            geometry.push(...segment.geometry);
        } else {
            // Skip first point of segment if it's same as last point of previous segment
            geometry.push(...segment.geometry.slice(1));
        }
        totalDistance += segment.distance;
    }
    
    console.log(`[DIJKSTRA] Built geometry with ${geometry.length} points, total distance: ${totalDistance}m`);

    // Get stop details
    const fromStop = line.stops[edge.fromIndex];
    const toStop = line.stops[edge.toIndex];

    // Find next available departure from the starting stop
    const departureTime = findNextDeparture(fromStop, departureAfter) || departureAfter;
    
    // Calculate arrival time based on schedule
    // Find the corresponding arrival time in the schedule
    let arrivalTime = departureTime + edge.duration;
    
    // Try to find exact schedule match
    if (fromStop.times && toStop.times) {
        const depIdx = fromStop.times.findIndex((t: string) => {
            const time = parseTime(t);
            return time !== null && time >= departureAfter;
        });
        
        if (depIdx !== -1 && depIdx < toStop.times.length) {
            const exactArrival = parseTime(toStop.times[depIdx]);
            if (exactArrival !== null) {
                arrivalTime = exactArrival;
            }
        }
    }

    return {
        step: {
            type: 'bus',
            line: line.bus_id,
            lineName: line.lineName || line.bus_id,
            color: getLineColor(line.bus_id),
            from: {
                stopId: edge.from,
                name: fromStop.name,
                lat: parseFloat(fromStop.latitude!),
                lon: parseFloat(fromStop.longitude!)
            },
            to: {
                stopId: edge.to,
                name: toStop.name,
                lat: parseFloat(toStop.latitude!),
                lon: parseFloat(toStop.longitude!)
            },
            departureTime: formatTime(departureTime),
            arrivalTime: formatTime(arrivalTime),
            stopsCount: edge.stopsCount,
            duration: arrivalTime - departureTime,
            distance: totalDistance,
            geometry
        },
        arrivalTime
    };
}

/**
 * Create a bus step from a CSA Connection sequence
 */


/**
 * Generate consistent color for each bus line
 */
function getLineColor(lineId: string): string {
    const colorMap: Record<string, string> = {
        '1': "#303f9f",
        '2': "#4db6ac",
        '3': "#f44336",
        '6': '#03a9f4',
        '9': '#9ccc65',
        '10': "#546e7a",
        '11': '#ab47bc',
        '12': '#d32f2f',
        '15': '#212121',
        '16': '#ba68c8',
        '17': '#f44336',
        '18': '#e1bee7',
        '20': '#ffa000',
        '23': '#6F304E',
        '28': '#8bc34a',
        '29': '#00e676',
        '31': '#ff9800',
        '33': '#ffeb3b',
        '36': '#7e57c2',
        '39': '#388e3c',
        '40': '#3f51b5',
        '55': '#7cb342',
        '63': '#90caf9',
        '65': '#29b6f6',
        '67': '#ffeb3b',
        '68': '#915A42',
        '70': '#00acc1',
        '72': '#cddc39',
        '81': '#ef5350',
        '82': '#f9a825',
        '83': '#fdd835',
        '84': '#f06292',
        '87': '#90caf9',
        '91': '#f06292',
        '92': '#ffa000',
        '98': '#fdd835',
        '101': '#29b6f6',
        '102': '#f06292',
        '103': '#546e7a',
        '111': '#fdd835',
        '112': '#f06292',
        '120': '#fdd835',
        '129': '#29b6f6',
        '191': '#d32f2f',
        'U': '#f07f06ff'
    }

    if (colorMap[lineId]) {
        return colorMap[lineId];
    }

    let hash = 0;
    for (let i = 0; i < lineId.length; i++) {
        hash = lineId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 65%, 50%)`;
}

/**
 * Calculate routes from A to B using Dijkstra algorithm
 */
export async function calculateRoutes(request: RouteRequest): Promise<RouteResponse> {
    const startTime = Date.now();
    const maxWalking = request.maxWalkingDistance || 800; // Increased default walking distance
    const maxTransfers = request.maxTransfers || 2;
    const requestedTimeStr = request.departureTime || formatTime(new Date().getHours() * 60 + new Date().getMinutes());
    const requestedTime = parseTime(requestedTimeStr) || (new Date().getHours() * 60 + new Date().getMinutes());

    const from = await resolveLocation(request.from);
    const to = await resolveLocation(request.to);

    console.log(`[ROUTING] Dijkstra Calculating from ${from.name || from.lat} to ${to.name || to.lat} @ ${requestedTimeStr}`);

    // 1. Find nearby bus stops for start and end
    const fromStops = await findNearbyStops(from.lat, from.lon, maxWalking);
    const toStops = await findNearbyStops(to.lat, to.lon, maxWalking);

    console.log(`[DIJKSTRA] From stops: ${fromStops.length}, To stops: ${toStops.length}`);

    if (fromStops.length === 0 || toStops.length === 0) {
        return {
            from, to, routes: [], calculationTime: Date.now() - startTime
        };
    }

    // 2. Run Dijkstra for each combination of start/end stops
    const graph = getTransportGraph();
    const routes: RouteOption[] = [];

    for (const startStop of fromStops.slice(0, 3)) { // Limit to 3 closest starting stops
        for (const endStop of toStops.slice(0, 3)) { // Limit to 3 closest ending stops
            const path = dijkstra(
                graph,
                startStop.stopPointId!,
                endStop.stopPointId!,
                maxTransfers,
                []
            );

            if (path && path.length > 0) {
                // Convert path to route steps
                const steps: RouteStep[] = [];
                let currentTime = requestedTime;

                // Walk to first stop
                if (!from.stopId || from.stopId !== startStop.stopPointId) {
                    const walkStep = await createWalkStep(
                        from.lat, from.lon,
                        parseFloat(startStop.latitude!), parseFloat(startStop.longitude!),
                        from.name, startStop.name, startStop.stopPointId || undefined
                    );
                    steps.push(walkStep);
                    currentTime += walkStep.duration;
                }

                // Bus segments with actual schedules
                let firstBusDepartureTime: number | null = null;
                let lastBusArrivalTime: number | null = null;
                
                for (const edge of path) {
                    const { step, arrivalTime } = await createDijkstraBusStep(edge, currentTime);
                    steps.push(step);
                    currentTime = arrivalTime;
                    
                    // Track first departure and last arrival times
                    if (step.type === 'bus') {
                        const busStep = step as BusStep;
                        if (firstBusDepartureTime === null) {
                            firstBusDepartureTime = parseTime(busStep.departureTime)!;
                        }
                        lastBusArrivalTime = parseTime(busStep.arrivalTime)!;
                    }
                }

                // Walk to destination
                if (!to.stopId || to.stopId !== endStop.stopPointId) {
                    const walkStep = await createWalkStep(
                        parseFloat(endStop.latitude!), parseFloat(endStop.longitude!),
                        to.lat, to.lon,
                        endStop.name, to.name
                    );
                    steps.push(walkStep);
                    currentTime += walkStep.duration;
                }

                // Calculate totals - use actual travel time from first bus to last arrival
                let totalDuration: number;
                if (firstBusDepartureTime !== null && lastBusArrivalTime !== null) {
                    // Calculate duration from first bus departure to last bus arrival
                    totalDuration = lastBusArrivalTime - firstBusDepartureTime;
                    
                    // Add all walking times
                    const walkingTime = steps
                        .filter(s => s.type === 'walk')
                        .reduce((sum, s) => sum + (s as WalkStep).duration, 0);
                    totalDuration += walkingTime;
                } else {
                    // Fallback if no bus steps (walking only)
                    totalDuration = currentTime - requestedTime;
                }
                
                const walkingDistance = steps.filter(s => s.type === 'walk').reduce((sum, s) => sum + (s as WalkStep).distance, 0);
                const transfers = path.filter((edge, idx) => idx > 0 && edge.line !== path[idx - 1].line).length;

                routes.push({
                    steps,
                    duration: totalDuration,
                    transfers,
                    walkingDistance,
                    score: totalDuration + (transfers * 10) // Add penalty for transfers
                });
            }
        }
    }

    // Sort by score and remove duplicates
    routes.sort((a, b) => a.score - b.score);

    const calculationTime = Date.now() - startTime;
    console.log(`[ROUTING] Dijkstra Found ${routes.length} routes in ${calculationTime}ms`);

    return {
        from,
        to,
        routes: routes.slice(0, 5), // Return top 5 routes
        calculationTime
    };
}