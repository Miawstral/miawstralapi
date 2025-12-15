// src/api/stops/stops.service.ts
import fs from 'fs';
import path from 'path';
import { BusLine, StopDetails, Stop } from '../../interfaces/BusData';

let allStopsCache: Partial<Stop>[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL: number = 10 * 60 * 1000;
const dataDir = path.join(__dirname, '../../data');

/**
 * Creates a summary of all unique stops from all data files.
 */
export const getAllStops = async (): Promise<Partial<Stop>[]> => {
    const now = Date.now();

    if (allStopsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL){
        console.log('[CACHE] Returning all stops from cache.')
        return allStopsCache;
    }
    
    console.log('[FILESYS] - Reading all stops from files.');
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('_horaires.json'));
    const uniqueStops = new Map<string, Partial<Stop>>();

    for (const file of files) {
        const filePath = path.join(dataDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const line: BusLine = JSON.parse(fileContent);

        for (const stop of line.stops) {
            if (stop.stopPointId && !uniqueStops.has(stop.stopPointId)) {
                uniqueStops.set(stop.stopPointId, {
                    stopPointId: stop.stopPointId,
                    name: stop.name,
                    city: stop.city,
                    latitude: stop.latitude,
                    longitude: stop.longitude
                });
            }
        }
    }

    allStopsCache = Array.from(uniqueStops.values());
    cacheTimestamp = now;
    return allStopsCache;
};

/**
 * Invalidate cache manually to avoid having wrong data and force refreshing cache.
 */
export const invalidateCache = (): void => {
    allStopsCache = null;
    cacheTimestamp = null;
    console.log('[CACHE] Cache invalidated.')
}



/**
 * Finds a stop by its ID by searching through all line files
 * and aggregates all passing lines and their schedules for that stop.
 */
export const getStopById = async (stopId: string): Promise<StopDetails> => {
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('_horaires.json'));
    let stopInfo: StopDetails | null = null;

    for (const file of files) {
        const filePath = path.join(dataDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const line: BusLine = JSON.parse(fileContent);

        const stopInLine = line.stops.find(s => s.stopPointId === stopId);

        if (stopInLine) {
            if (!stopInfo) {
                stopInfo = {
                    stopPointId: stopInLine.stopPointId!,
                    name: stopInLine.name,
                    city: stopInLine.city,
                    latitude: stopInLine.latitude,
                    longitude: stopInLine.longitude,
                    accessible: stopInLine.accessible,
                    passingLines: [],
                };
            }


            stopInfo.passingLines.push({
                bus_id: line.bus_id,
                lineName: line.lineName,
                direction: line.direction,
                times: stopInLine.times,
            });
        }
    }

    if (!stopInfo) {
        throw new Error('Stop not found');
    }

    return stopInfo;
};

/**
 * Search for stops by name. 
 * @param {string} query
 * @returns {Promise<Partial<Stop>[]>} A list of matching stops 
 */

export const searchStopsByName = async (query: string): Promise<Partial<Stop>[]> => {
    const allStops = await getAllStops(); 
    const lowerCaseQuery = query.toLowerCase(); 

    return allStops.filter(stop => 
        stop.name?.toLowerCase().includes(lowerCaseQuery)
    );
}; 


/**
 * Finds stops within a given radius of a geographic point.
 * https://fr.wikipedia.org/wiki/Formule_de_haversine
 * @param {number} lat Latitude of the center point
 * @param {number} lon Longitude of the center point 
 * @param {number} radiusInMeters The radius in meters.
 * @returns {Promise<Partial<Stop>[]>} A list of nearby stops.
 */

export const findStopsNearby = async (lat:number, lon:number, radiusInMeters: number): Promise<Partial<Stop>[]> => {
    const allStops = await getAllStops(); 
    const radiusInKm = radiusInMeters / 1000

    return allStops.filter(stop => {
        if(!stop.latitude || !stop.longitude) {
            return false; 
        }
    const distance = getDistance(lat, lon, parseFloat(stop.latitude), parseFloat(stop.longitude));
    return distance <= radiusInKm;
  });
};

/**
 * Calculates the distance between two geo-coordinates in kilometers using the Haversine formula.
 */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}