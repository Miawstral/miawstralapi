import * as stopsService from '../stops/stops.service';
import * as linesService from '../lines/lines.service';
import { Stop, BusLine } from '../../interfaces/BusData';
import { RouteRequest, RouteOption, RouteStep, RouteResponse, BusStep, WalkStep, Location } from '../../interfaces/Route';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(__dirname, '../../data');

const WALKING_SPEED = 5;
const AVG_BUS_SPEED = 30;
const TRANSFER_PENALTY = 5;

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
async function findDirectLines(fromStopId: string, toStopId: string): Promise<{ line: BusLine; fromIndex: number; toIndex: number}[]>{
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('_horaires.json'));
    const directLines: { line: BusLine; fromIndex: number; toIndex: number }[] = [];

    for (const file of files){
        const filePath = path.join(dataDir, file);
        const line: BusLine = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        const fromIndex = line.stops.findIndex(s => s.stopPointId === fromStopId);
        const toIndex = line.stops.findIndex(s => s.stopPointId === toStopId);

        if (fromIndex !== -1 && toIndex !== -1 && fromIndex < toIndex) {
            directLines.push({ line, fromIndex, toIndex });
        }
    }
    return directLines;
}


/**
 * Creating a walkstep
 */

function createWalkStep(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    fromName?: string,
    toName?: string,
    toStopId?: string
): WalkStep {
    const distance = getDistance(fromLat, fromLon, toLat, toLon) * 1000;
    const duration = (distance / 1000) / WALKING_SPEED * 60;

    return {
        type: 'walk',
        from: { lat: fromLat, lon: fromLon, name: fromName },
        to: { lat: toLat, lon: toLon, name: toName },
        duration: Math.ceil(duration),
        distance: Math.round(distance)
    };
}

/**
 * Creating a busStep
 */

function createBusStep(line: BusLine, fromIndex: number, toIndex: number): BusStep {
    const fromStop = line.stops[fromIndex];
    const toStop = line.stops[toIndex];
    const stopsCount = toIndex - fromIndex;

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
        stopsCount
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
    for (const fromStop of fromStops.slice(0, 5)) {
        for (const toStop of toStops.slice(0, 5)) {
            const directLines = await findDirectLines(fromStop.stopPointId!, toStop.stopPointId!);

            for (const { line, fromIndex, toIndex } of directLines ){
                const steps: RouteStep[] = [];

                if (!from.stopId) {
                    steps.push(createWalkStep(
                        from.lat, from.lon,
                        parseFloat(fromStop.latitude!), parseFloat(fromStop.longitude!),
                        from.name, fromStop.name, fromStop.stopPointId!
                    ));
                }
                steps.push(createBusStep(line, fromIndex, toIndex));

                if (!to.stopId) {
                    steps.push(createWalkStep(
                        parseFloat(toStop.latitude!), parseFloat(toStop.longitude!),
                        to.lat, to.lon,
                        toStop.name, to.name
                    ));
                }
                const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0)
            }
        }
    }
}