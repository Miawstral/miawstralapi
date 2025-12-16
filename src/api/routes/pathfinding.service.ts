import * as stopsSerivce from '../stops/stops.service';
import { Stop, BusLine } from '../../interfaces/BusData';
import fs from 'fs';
import path from 'path';


const dataDir = path.join(__dirname, '../../data');

interface Node {
    stopId: string;
    name: string;
    lat: number;
    lon: number;
}

interface Edge {
    from: string;
    to: string;
    line: string;
    lineName: string;
    duration: number;
    distance: number;
    stopsCount: number;
    type: 'bus' | 'walk';
    fromIndex?: number;
    toIndex?: number;
    busLine?: BusLine;
}

interface PathNode {
    stopId: string;
    distance: number;
    previous: string | null;
    edge: Edge | null;
}

export function buildTransportGraph(): Map<string, Edge[]> {
    const graph = new Map<string, Edge[]>();
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('_horaires.json'));

    for (const file of files) {
        const filePath = path.join(dataDir, file);
        const line: BusLine = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        for (let i = 0; i < line.stops.length - 1; i++) {
            const from = line.stops[i];
            const to = line.stops[i + 1];

            if (!from.stopPointId || !to.stopPointId) continue;

            const distance = haversine(
                parseFloat(from.latitude!),
                parseFloat(from.longitude!),
                parseFloat(to.latitude!),
                parseFloat(to.longitude!)
            ) * 1000;

            const duration = (distance / 1000) / 20 * 60;

            const edgeOutward: Edge = {
                from: from.stopPointId,
                to: to.stopPointId,
                line: line.bus_id,
                lineName: line.lineName || line.bus_id,
                duration,
                distance,
                stopsCount: 1,
                type: 'bus',
                fromIndex: i,
                toIndex: i + 1,
                busLine: line
            };

            const edgeInward: Edge = {
                from: to.stopPointId,
                to: from.stopPointId,
                line: line.bus_id,
                lineName: line.lineName || line.bus_id,
                duration,
                distance,
                stopsCount: 1,
                type: 'bus',
                fromIndex: i,
                toIndex: i + 1,
                busLine: line   
            };

            if (!graph.has(from.stopPointId)) graph.set(from.stopPointId, []);
            if (!graph.has(to.stopPointId)) graph.set(to.stopPointId, []);

            graph.get(from.stopPointId)!.push(edgeOutward);
            graph.get(to.stopPointId)!.push(edgeInward);
        }
    }

    console.log(`[GRAPH] Built transport graph with ${graph.size} stops.`);
    return graph;
}

/**
 * Merge consecutive segments on the same line.
 */

function mergeConsecutiveEdges(edges: Edge[]): Edge[] {
    if (edges.length === 0) return [];

    const merged: Edge[] = [];
    let current = edges[0];

    for (let i = 1; i < edges.length; i++) {
        const next = edges[i];

        if (current.line === next.line && current.type === 'bus') {
            // Fusionner
            current = {
                ...current,
                to: next.to,
                duration: current.duration + next.duration,
                distance: current.distance + next.distance,
                stopsCount: current.stopsCount! + next.stopsCount!,
                toIndex: next.toIndex
            };
        } else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);

    return merged;
}


/** 
 * Djikstra algorith adapted for common transport
 */
export function dijkstra(
    graph: Map<string, Edge[]>,
    startStopId: string,
    endStopId: string,
    maxTransfers: number = 2
): Edge[] | null {
    const distances = new Map<string, number>();
    const previous = new Map<string, { stopId: string; edge: Edge } | null>();
    const queue: string[] = [];

    for (const stopId of graph.keys()) {
        distances.set(stopId, Infinity);
        previous.set(stopId, null);
    }
    distances.set(startStopId, 0);
    queue.push(startStopId);

    while (queue.length > 0) {
        queue.sort((a, b) => distances.get(a)! - distances.get(b)!);
        const current = queue.shift()!;

        if (current === endStopId) break;

        const currentDistance = distances.get(current)!;
        if (currentDistance === Infinity) continue;

        const edges = graph.get(current) || [];
        
        for(const edge of edges) {
            const neighbor = edge.to;
            const newDistance = currentDistance + edge.duration;

            let penalty = 0;
            const prevEdge = previous.get(current)?.edge;
            if(prevEdge && prevEdge.line !== edge.line) {
                penalty = 5;
            }  

            const totalDistance = newDistance + penalty;

            if (totalDistance < distances.get(neighbor)!) {
                distances.set(neighbor, totalDistance);
                previous.set(neighbor, {stopId: current, edge});

                if (!queue.includes(neighbor)) {
                    queue.push(neighbor);
                }
            }
        }
    }

    if(!previous.has(endStopId) || previous.get(endStopId) === null) {
        return null;
    }
    const path: Edge[] = [];
    let current = endStopId;
    while (current !== startStopId) {
        const prev = previous.get(current);
        if (!prev) break;

        path.unshift(prev.edge);
        current = prev.stopId;
    }

    return mergeConsecutiveEdges(path);
}


/**
 * Haversine function distance calculation
 */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}