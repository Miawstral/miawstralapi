import * as stopsService from '../stops/stops.service';
import * as linesService from '../lines/lines.service';
import { Stop, BusLine } from '../../interfaces/BusData';
import { RouteRequest, RouteOption, RouteStep, RouteResponse, BusStep, WalkStep, Location } from '../../interfaces/Route';
import fs from 'fs';
import path, { parse } from 'path';
import axios from 'axios';
import { buildTransportGraph, dijkstra } from './pathfinding.service';

const dataDir = path.join(__dirname, '../../data');

const WALKING_SPEED = 5;
const AVG_BUS_SPEED = 20;
const TRANSFER_PENALTY = 5;
const URBAN_FACTOR = 1.4;
const USE_OSRM = process.env.USE_OSRM || 'true'; 
const OSRM_URL = process.env.OSRM_URL || 'https://osrm.1sheol.xyz';




let transportGraph: Map<string, any> | null = null;

function getTransportGraph() {
    if (!transportGraph) {
        console.log('[ROUTING] Building transport graph...');
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

                console.log(`[OSRM] Real: ${distance}m (${duration}min) vs Straight: ${Math.round(getDistance(fromLat, fromLon, toLat, toLon))}`);

                return { distance, duration };
            }
        } catch (error) {
            console.log('[ROUTING] OSRM Failed, using urban factor fallback');
        }
    }

    const straightDistance = getDistance(fromLat, fromLon, toLat, toLon)  * 1000;
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
): Promise <{ distance: number; duration: number; geometry: [number, number][] }> {
    if (USE_OSRM) {
        try {
            const url = `${OSRM_URL}/route/v1/${profile}/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
            const response = await axios.get(url, { timeout: 5000 });

            if (response.data.code === 'Ok'){
                const route = response.data.routes[0];
                return {
                    distance: Math.round(route.distance),
                    duration: Math.ceil(route.duration / 60),
                    geometry: route.geometry.coordinates.map((c: number[]) => [c[1], c[0]])
                };
            }
        } catch (error) {
            const err = error as any;
            console.log(`[OSRM] Failed: ${err.message || 'Unknown error'}`);
        }
    }

    const straightDistance = getDistance(fromLat, fromLon, toLat, toLon) * 1000;
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

function deg2rad(deg: number){
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
async function resolveLocation(location: Location): Promise<{ lat: number; lon: number; stopId?: string; name?: string}> {
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
 * Check if 2 stops are on the same line.
 */
/**
 * Vérifier si 2 arrêts sont sur la même ligne (dans les 2 sens)
 */
async function findDirectLines(fromStopId: string, toStopId: string): Promise<{ line: BusLine; fromIndex: number; toIndex: number }[]> {
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('_horaires.json'));
    const directLines: { line: BusLine; fromIndex: number; toIndex: number }[] = [];

    for (const file of files) {
        const filePath = path.join(dataDir, file);
        const line: BusLine = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        const fromIndex = line.stops.findIndex(s => s.stopPointId === fromStopId);
        const toIndex = line.stops.findIndex(s => s.stopPointId === toStopId);

        if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
            // Sens normal (OUTWARD)
            if (fromIndex < toIndex) {
                directLines.push({ line, fromIndex, toIndex });
            }
            else if (fromIndex > toIndex) {
                // Créer une ligne inversée
                const reversedLine: BusLine = {
                    ...line,
                    bus_id: line.bus_id,
                    lineName: line.lineName,
                    direction: 'INWARD',
                    stops: [...line.stops].reverse() 
                };
                
                const reversedFromIndex = line.stops.length - 1 - fromIndex;
                const reversedToIndex = line.stops.length - 1 - toIndex;
                
                directLines.push({ 
                    line: reversedLine, 
                    fromIndex: reversedFromIndex, 
                    toIndex: reversedToIndex 
                });
            }
        }
    }

    return directLines;
}


/**
 * Creating a walkstep
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
        duration,
        distance,
        geometry
    };
}

/**
 * Creating a busStep
 */

async function createBusStep(line: BusLine, fromIndex: number, toIndex: number): Promise<BusStep> {
    const fromStop = line.stops[fromIndex];
    const toStop = line.stops[toIndex];
    const stopsCount = toIndex - fromIndex;

    const geometry: [number, number][] = [];
    let totalDuration = 0;
    let totalDistance = 0;

    for (let i = fromIndex; i < toIndex; i++) {
        const current = line.stops[i];
        const next = line.stops[i + 1];

        const segment = await getRouteGeometry(
            parseFloat(current.latitude!),
            parseFloat(current.longitude!),
            parseFloat(next.latitude!),
            parseFloat(next.longitude!),
            'car'
        );
        geometry.push(...segment.geometry);
        totalDuration += segment.duration;
        totalDistance += segment.distance;
    }
    return {
        type: 'bus',
        line: line.bus_id,
        lineName: line.lineName || line.bus_id,
        from: {
            stopId: fromStop.stopPointId!,
            name: fromStop.name,
            lat: parseFloat(fromStop.latitude!),
            lon: parseFloat(fromStop.longitude!)
        },
        to: {
            stopId: toStop.stopPointId!,
            name: toStop.name,
            lat: parseFloat(toStop.latitude!),
            lon: parseFloat(toStop.longitude!)
        },
        departureTime: fromStop.times[0],
        stopsCount,
        duration: totalDuration,
        distance: totalDistance,
        geometry
    };
}

/**
 * Calculate a score for the route
 */
function calculateScore(route: RouteOption): number {
    return route.duration + (route.transfers * TRANSFER_PENALTY) + (route.walkingDistance / 100);
}

/**
 * Calculate routes from A to B
 */
export async function calculateRoutes(request: RouteRequest): Promise<RouteResponse> {
    const startTime = Date.now();
    const maxWalking = request.maxWalkingDistance || 500;
    const maxTransfers = request.maxTransfers || 2;

    const from = await resolveLocation(request.from);
    const to = await resolveLocation(request.to);
    
    console.log(`[ROUTING] Calculating routes from (${from.lat}, ${from.lon}) to (${to.lat}, ${to.lon})`);

    const routes: RouteOption[] = [];
    const fromStops = await findNearbyStops(from.lat, from.lon, maxWalking);
    const toStops = await findNearbyStops(to.lat, to.lon, maxWalking);

    console.log(`[ROUTING] Found ${fromStops.length} departure stops and ${toStops.length} arrival stops`);

    const graph = getTransportGraph()
    for (const fromStop of fromStops.slice(0, 3)) {
        for (const toStop of toStops.slice(0, 3)) {
            const path = dijkstra(graph, fromStop.stopPointId!, toStop.stopPointId!, maxTransfers);

            if (!path || path.length === 0) continue;

            const steps: RouteStep[] = [];
            if(!from.stopId) {
                steps.push(await createWalkStep(
                    from.lat, from.lon,
                    parseFloat(fromStop.latitude!), parseFloat(fromStop.longitude!),
                    from.name, fromStop.name, fromStop.stopPointId!
                ));
            }

            for (const edge of path) {
                if (edge.type === 'bus' && edge.busLine) {
                    steps.push(await createBusStep(edge.busLine, edge.fromIndex!, edge.toIndex!));
                }
            }

            if (!to.stopId) {
                steps.push(await createWalkStep(
                    parseFloat(toStop.latitude!), parseFloat(toStop.longitude!),
                    to.lat, to.lon,
                    toStop.name, to.name
                ));
            }

            const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);
            const walkingDistance = steps.filter((s): s is WalkStep => s.type === 'walk').reduce((sum, s) => sum + s.distance, 0);

            let transfers = 0;
            for (let i = 1; i < steps.length; i++) {
                if (steps[i].type === 'bus' && steps[i - 1].type === 'bus'){
                    const prev = steps[i - 1] as BusStep;
                    const curr = steps[i] as BusStep;
                    if (prev.line !== curr.line) transfers++;
                }
            }
            const route: RouteOption = {
                duration: Math.ceil(totalDuration),
                transfers,
                walkingDistance,
                steps,
                score: 0
            };
            route.score = calculateScore(route);
            routes.push(route);
        };

        routes.sort((a, b) => a.score - b.score);
        const calculationTime = Date.now() - startTime;

        console.log(`[ROUTING] Found ${routes.length} routes in ${calculationTime}ms`);
        return {
            from,
            to,
            routes: routes.slice(0, 5),
            calculationTime
        }
    }
}