// src/api/stops/stops.service.ts
import fs from 'fs';
import path from 'path';
import { BusLine, StopDetails, Stop } from '../../interfaces/BusData';

let allStopsCache: Partial<Stop>[] | null = null;
const dataDir = path.join(__dirname, '../../data');

/**
 * Creates a summary of all unique stops from all data files.
 */
export const getAllStops = async (): Promise<Partial<Stop>[]> => {
    if (allStopsCache) {
        console.log('[CACHE] Returning all stops from the cache.')
        return allStopsCache
    }
    
    console.log(`[FILESYS] Reading all stops from files for the first time.`)
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
                    longitude: stop.longitude,
                });
            }
        }
    }
    
    
    allStopsCache = Array.from(uniqueStops.values()); 
    return allStopsCache
    
};



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