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