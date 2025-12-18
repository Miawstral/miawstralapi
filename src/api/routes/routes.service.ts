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
            directLines.push({ line, fromIndex, toIndex });
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
 * parse a time "HH:MM" in minutes since midnight (00:00)
 */

function parseTime(timeStr: string): number | null {
    if (!timeStr || !timeStr.includes(':')) return null;

    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;

    return hours * 60 + minutes;
}

async function createBusStep(line: BusLine, fromIndex: number, toIndex: number, requestedTime?: string): Promise<BusStep> {
    const isReverse = fromIndex > toIndex;
    const stopsCount = Math.abs(toIndex - fromIndex);
    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);

    const fromStop = line.stops[fromIndex];
    const toStop = line.stops[toIndex];

    const geometry: [number, number][] = [];
    let totalDistance = 0;
    let realDuration = 0;
    let selectedDepartureTime = '';
    let selectedArrivalTime = '';

    // Only try to find schedules for OUTWARD direction (fromIndex < toIndex)
    // For reverse direction, we would need INWARD data which we don't have
    if (!isReverse && fromStop.times && toStop.times && fromStop.times.length > 0 && toStop.times.length > 0) {
        const requestedMinutes = requestedTime ? parseTime(requestedTime) : null;
        let bestIndex = -1;
        let bestDuration = Infinity;
        
        // Try to find a schedule where the trip makes sense (departure before arrival)
        for (let i = 0; i < Math.min(fromStop.times.length, toStop.times.length); i++) {
            const depTime = parseTime(fromStop.times[i]);
            const arrTime = parseTime(toStop.times[i]);
            
            if (depTime === null || arrTime === null) continue;
            
            // Calculate duration (handle midnight crossing)
            let duration;
            if (arrTime >= depTime) {
                duration = arrTime - depTime;
            } else {
                // Crosses midnight
                duration = (24 * 60 - depTime) + arrTime;
            }
            
            // Only consider reasonable durations (1 min to 3 hours)
            if (duration < 1 || duration > 180) continue;
            
            // If requestedTime is specified, only consider departures after it
            if (requestedMinutes !== null && depTime < requestedMinutes) continue;
            
            // Take the first valid schedule (or earliest after requested time)
            if (bestIndex === -1) {
                bestIndex = i;
                bestDuration = duration;
                break;
            }
        }
        
        if (bestIndex !== -1) {
            selectedDepartureTime = fromStop.times[bestIndex];
            selectedArrivalTime = toStop.times[bestIndex];
            realDuration = bestDuration;
            console.log(`[BUS] ${line.bus_id}: ${fromStop.name} (${selectedDepartureTime}) -> ${toStop.name} (${selectedArrivalTime}) = ${realDuration}min.`);
        }
    }

    // Build geometry for the route
    for (let i = startIndex; i < endIndex; i++) {
        const current = line.stops[i];
        const next = line.stops[i + 1];

        const segment = await getRouteGeometry(
            parseFloat(current.latitude!),
            parseFloat(current.longitude!),
            parseFloat(next.latitude!),
            parseFloat(next.longitude!),
            'car'
        );
        
        // Add geometry in correct order based on direction
        if (isReverse) {
            geometry.unshift(...segment.geometry.reverse());
        } else {
            geometry.push(...segment.geometry);
        }
        totalDistance += segment.distance;
    }
    
    // If we don't have real duration from schedules, calculate average from stop-to-stop
    if (realDuration <= 0) {
        console.log(`[BUS] ${line.bus_id}: No valid schedule found, calculating average duration`);
        for (let i = startIndex; i < endIndex; i++) {
            const current = line.stops[i];
            const next = line.stops[i + 1];
            
            if (current.times && next.times && current.times.length > 0 && next.times.length > 0) {
                const durations: number[] = [];
                
                for (let j = 0; j < Math.min(current.times.length, next.times.length); j++) {
                    const currentTime = parseTime(current.times[j]);
                    const nextTime = parseTime(next.times[j]);
                    
                    if (currentTime !== null && nextTime !== null) {
                        let dur = nextTime >= currentTime 
                            ? nextTime - currentTime 
                            : (24 * 60 - currentTime) + nextTime;
                        
                        if (dur > 0 && dur < 120) {
                            durations.push(dur);
                        }
                    }
                }
                
                if (durations.length > 0) {
                    const avgDur = durations.reduce((sum, d) => sum + d, 0) / durations.length;
                    realDuration += Math.round(avgDur);
                } else {
                    realDuration += 5;
                }
            } else {
                realDuration += 5;
            }
        }
    }
    
    // Use original line stops for the from/to data (correct coordinates)
    const originalFromStop = line.stops[fromIndex];
    const originalToStop = line.stops[toIndex];
    
    return {
        type: 'bus',
        line: line.bus_id,
        lineName: line.lineName || line.bus_id,
        color: getLineColor(line.bus_id),
        from: {
            stopId: originalFromStop.stopPointId!,
            name: originalFromStop.name,
            lat: parseFloat(originalFromStop.latitude!),
            lon: parseFloat(originalFromStop.longitude!)
        },
        to: {
            stopId: originalToStop.stopPointId!,
            name: originalToStop.name,
            lat: parseFloat(originalToStop.latitude!),
            lon: parseFloat(originalToStop.longitude!)
        },
        departureTime: selectedDepartureTime || undefined,
        arrivalTime: selectedArrivalTime || undefined,
        stopsCount,
        duration: realDuration,
        distance: totalDistance,
        geometry
    };
}

/**
 * Calculate a score for the route (lower is better)
 * Priority: 1) Direct lines (no transfers), 2) Fewer transfers, 3) Shorter duration
 */
function calculateScore(route: RouteOption): number {
    // Transfers are EXTREMELY penalizing (30 min per transfer = 1800 points)
    const transferScore = route.transfers * 1800;
    // Duration is secondary (1 point per minute)
    const durationScore = route.duration;
    // Walking is least important (1 point per 100m)
    const walkingScore = route.walkingDistance / 100;
    
    return transferScore + durationScore + walkingScore;
}

/**
 * Generate consistent color for each bus line
 */
function getLineColor(lineId: string): string {
    const colorMap: Record<string, string> = {
        '1' : "#303f9f",
        '2': "#4db6ac",
        '3' : "#f44336",
        '6' : '#03a9f4',
        '9' : '#9ccc65',
        '10' : "#546e7a",
        '11' : '#ab47bc',
        '12' : '#d32f2f',
        '15' : '#212121',
        '16' : '#ba68c8',
        '17' : '#f44336',
        '18' : '#e1bee7',
        '20' : '#ffa000',
        '23' : '#6F304E',
        '28' : '#8bc34a',
        '29' : '#00e676',
        '31' : '#ff9800',
        '33' : '#ffeb3b',
        '36' : '#7e57c2',
        '39' : '#388e3c',
        '40' : '#3f51b5',
        '55' : '#7cb342',
        '63' : '#90caf9',
        '65' : '#29b6f6',
        '67' : '#ffeb3b',
        '68' : '#915A42',
        '70' : '#00acc1',
        '72' : '#cddc39',
        '81' : '#ef5350',
        '82' : '#f9a825',
        '83' : '#fdd835',
        '84' : '#f06292',
        '87' : '#90caf9',
        '91' : '#f06292',
        '92' : '#ffa000',
        '98' : '#fdd835',
        '101' : '#29b6f6',
        '102' : '#f06292',
        '103' : '#546e7a',
        '111' : '#fdd835',
        '112' : '#f06292',
        '120' : '#fdd835',
        '129' : '#29b6f6',
        '191' : '#d32f2f',
    }

    if (colorMap[lineId]){
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
 * Calculate routes from A to B using Dijkstra pathfinding
 */
export async function calculateRoutes(request: RouteRequest): Promise<RouteResponse> {
    const startTime = Date.now();
    const maxWalking = request.maxWalkingDistance || 500;
    const maxTransfers = request.maxTransfers || 2;
    const excludedLines = request.excludedLines || [];
    const requestedTime = request.departureTime || request.arrivalTime;

    const from = await resolveLocation(request.from);
    const to = await resolveLocation(request.to);
    
    console.log(`[ROUTING] Calculating routes from (${from.lat}, ${from.lon}) to (${to.lat}, ${to.lon})`);

    const routes: RouteOption[] = [];
    const fromStops = await findNearbyStops(from.lat, from.lon, maxWalking);
    const toStops = await findNearbyStops(to.lat, to.lon, maxWalking);

    console.log(`[ROUTING] Found ${fromStops.length} departure stops and ${toStops.length} arrival stops`);

    const graph = getTransportGraph();
    
    for (const fromStop of fromStops.slice(0, 3)) {
        for (const toStop of toStops.slice(0, 3)) {
            const path = dijkstra(graph, fromStop.stopPointId!, toStop.stopPointId!, maxTransfers, excludedLines);

            if (!path || path.length === 0) continue;

            const steps: RouteStep[] = [];
            if (!from.stopId) {
                steps.push(await createWalkStep(
                    from.lat, from.lon,
                    parseFloat(fromStop.latitude!), parseFloat(fromStop.longitude!),
                    from.name, fromStop.name, fromStop.stopPointId!
                ));
            }

            for (const edge of path) {
                if (edge.type === 'bus' && edge.busLine) {
                    steps.push(await createBusStep(edge.busLine, edge.fromIndex!, edge.toIndex!, requestedTime));
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
                if (steps[i].type === 'bus' && steps[i - 1].type === 'bus') {
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
        }
    }

    routes.sort((a, b) => a.score - b.score);
    const calculationTime = Date.now() - startTime;

    console.log(`[ROUTING] Found ${routes.length} routes in ${calculationTime}ms`);
    return {
        from,
        to,
        routes: routes.slice(0, 5),
        calculationTime
    };
}