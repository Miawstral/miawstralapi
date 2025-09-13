"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findStopsNearby = exports.searchStopsByName = exports.getStopById = exports.getAllStops = void 0;
// src/api/stops/stops.service.ts
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let allStopsCache = null;
const dataDir = path_1.default.join(__dirname, '../../data');
/**
 * Creates a summary of all unique stops from all data files.
 */
const getAllStops = async () => {
    if (allStopsCache) {
        console.log('[CACHE] Returning all stops from the cache.');
        return allStopsCache;
    }
    console.log(`[FILESYS] Reading all stops from files for the first time.`);
    const files = fs_1.default.readdirSync(dataDir).filter(file => file.endsWith('_horaires.json'));
    const uniqueStops = new Map();
    for (const file of files) {
        const filePath = path_1.default.join(dataDir, file);
        const fileContent = fs_1.default.readFileSync(filePath, 'utf-8');
        const line = JSON.parse(fileContent);
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
    return allStopsCache;
};
exports.getAllStops = getAllStops;
/**
 * Finds a stop by its ID by searching through all line files
 * and aggregates all passing lines and their schedules for that stop.
 */
const getStopById = async (stopId) => {
    const files = fs_1.default.readdirSync(dataDir).filter(file => file.endsWith('_horaires.json'));
    let stopInfo = null;
    for (const file of files) {
        const filePath = path_1.default.join(dataDir, file);
        const fileContent = fs_1.default.readFileSync(filePath, 'utf-8');
        const line = JSON.parse(fileContent);
        const stopInLine = line.stops.find(s => s.stopPointId === stopId);
        if (stopInLine) {
            if (!stopInfo) {
                stopInfo = {
                    stopPointId: stopInLine.stopPointId,
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
exports.getStopById = getStopById;
/**
 * Search for stops by name.
 * @param {string} query
 * @returns {Promise<Partial<Stop>[]>} A list of matching stops
 */
const searchStopsByName = async (query) => {
    const allStops = await (0, exports.getAllStops)();
    const lowerCaseQuery = query.toLowerCase();
    return allStops.filter(stop => stop.name?.toLowerCase().includes(lowerCaseQuery));
};
exports.searchStopsByName = searchStopsByName;
/**
 * Finds stops within a given radius of a geographic point.
 * https://fr.wikipedia.org/wiki/Formule_de_haversine
 * @param {number} lat Latitude of the center point
 * @param {number} lon Longitude of the center point
 * @param {number} radiusInMeters The radius in meters.
 * @returns {Promise<Partial<Stop>[]>} A list of nearby stops.
 */
const findStopsNearby = async (lat, lon, radiusInMeters) => {
    const allStops = await (0, exports.getAllStops)();
    const radiusInKm = radiusInMeters / 1000;
    return allStops.filter(stop => {
        if (!stop.latitude || !stop.longitude) {
            return false;
        }
        const distance = getDistance(lat, lon, parseFloat(stop.latitude), parseFloat(stop.longitude));
        return distance <= radiusInKm;
    });
};
exports.findStopsNearby = findStopsNearby;
/**
 * Calculates the distance between two geo-coordinates in kilometers using the Haversine formula.
 */
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function deg2rad(deg) {
    return deg * (Math.PI / 180);
}
