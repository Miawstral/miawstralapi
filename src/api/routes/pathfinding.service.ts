import * as stopsSerivce from "../stops/stops.service";
import { Stop, BusLine } from "../../interfaces/BusData";
import fs from "fs";
import path from "path";

const dataDir = path.join(__dirname, "../../data");

interface Node {
  stopId: string;
  name: string;
  lat: number;
  lon: number;
}

export interface Edge {
  from: string;
  to: string;
  line: string;
  lineName: string;
  duration: number;
  distance: number;
  stopsCount: number;
  type: "bus" | "walk";
  fromIndex?: number;
  toIndex?: number;
  busLine?: BusLine;
  direction?: string;
}

interface PathNode {
  stopId: string;
  distance: number;
  previous: string | null;
  edge: Edge | null;
}

/**
 * Parse a time "HH:MM" to minutes since midnight
 */
export function parseTime(timeStr: string): number | null {
  if (!timeStr || !timeStr.includes(":")) return null;
  const [hours, minutes] = timeStr.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Format minutes since midnight to "HH:MM"
 */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Find next available departure from a stop after a given time
 */
export function findNextDeparture(stop: any, afterTime: number): number | null {
  if (!stop.times || stop.times.length === 0) return null;

  for (const timeStr of stop.times) {
    const depTime = parseTime(timeStr);
    if (depTime !== null && depTime >= afterTime) {
      return depTime;
    }
  }

  // If no departure found after the time, return the first departure of next day
  const firstTime = parseTime(stop.times[0]);
  return firstTime !== null ? firstTime + 24 * 60 : null;
}

/**
 * Calculate average duration between two stops based on actual schedules
 */
function calculateAverageDuration(fromStop: any, toStop: any): number {
  if (
    !fromStop.times ||
    !toStop.times ||
    fromStop.times.length === 0 ||
    toStop.times.length === 0
  ) {
    return 5; // Default 5 minutes if no schedule data
  }

  const durations: number[] = [];
  const maxIndex = Math.min(fromStop.times.length, toStop.times.length);

  for (let i = 0; i < maxIndex; i++) {
    const depTime = parseTime(fromStop.times[i]);
    const arrTime = parseTime(toStop.times[i]);

    if (depTime !== null && arrTime !== null) {
      let duration;
      if (arrTime < depTime) {
        // Handle midnight crossing
        duration = 24 * 60 - depTime + arrTime;
      } else {
        duration = arrTime - depTime;
      }

      // Only add reasonable durations (between 1 min and 120 min)
      if (duration > 0 && duration < 120) {
        durations.push(duration);
      }
    }
  }

  if (durations.length === 0) {
    return 5; // Default if no valid durations found
  }

  // Return average duration
  const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  return Math.round(avg);
}

export function buildTransportGraph(): Map<string, Edge[]> {
  const graph = new Map<string, Edge[]>;
  const files = fs.readdirSync(dataDir).filter((file) => file.endsWith('_horaires.json'));

  let totalEdges = 0;

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const line: BusLine = JSON.parse(fs.readFileSync(filePath, "utf-8"));

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

      const duration = calculateAverageDuration(from, to);

      const edgeOutward: Edge = {
        from: from.stopPointId,
        to: to.stopPointId,
        line: line.bus_id,
        lineName: line.lineName,
        duration,
        distance, 
        stopsCount: 1,
        type: "bus",
        fromIndex: i,
        toIndex: i + 1,
        busLine: line,
        direction: line.direction,
      };

      const edgeInward: Edge = {
        from: to.stopPointId,
        to: from.stopPointId,
        line: line.bus_id,
        lineName: line.lineName,
        duration, 
        distance, 
        stopsCount: 1,
        type: "bus",
        fromIndex: i + 1,
        toIndex: i,
        busLine: line,
        direction: line.direction === "OUTWARD" ? "INWARD_VIRTUAL" : "OUTWARD_VIRTUAL",
      };

      if (!graph.has(from.stopPointId)) graph.set(from.stopPointId, []);
      if (!graph.has(to.stopPointId)) graph.set(to.stopPointId, []);

      graph.get(from.stopPointId)!.push(edgeOutward);
      graph.get(to.stopPointId)!.push(edgeInward);
      totalEdges += 2;
    }
  }

  console.log(
    `[GRAPH] Built transport graph with ${graph.size} stops, ${totalEdges} edges (bidirectional)`
  );

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

    if (current.line === next.line && current.type === "bus") {
      // Fusionner
      current = {
        ...current,
        to: next.to,
        duration: current.duration + next.duration,
        distance: current.distance + next.distance,
        stopsCount: current.stopsCount! + next.stopsCount!,
        toIndex: next.toIndex,
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
  maxTransfers: number = 2,
  excludedLines: string[] = [],
): Edge[] | null {
  console.log(`[DIJKSTRA] Finding path from ${startStopId} to ${endStopId}`);

  if (!graph.has(startStopId)) {
    console.log(`[DIJKSTRA] ERROR: Start stop ${startStopId} not in graph`);
    return null;
  }
  if (!graph.has(endStopId)) {
    console.log(`[DIJKSTRA] ERROR: End stop ${endStopId} not in graph`);
    return null;
  }

  const startEdges = graph.get(startStopId) || [];
  const endEdges = graph.get(endStopId) || [];
  console.log(`[DIJKSTRA] Start stop has ${startEdges.length} outgoing edges`);
  console.log(`[DIJKSTRA] End stop has ${endEdges.length} outgoing edges`);

  const distances = new Map<string, number>();
  const previous = new Map<string, { stopId: string; edge: Edge } | null>();
  const queue: string[] = [];
  const visited = new Set<string>();

  for (const stopId of graph.keys()) {
    distances.set(stopId, Infinity);
    previous.set(stopId, null);
  }
  distances.set(startStopId, 0);
  queue.push(startStopId);

  let iterations = 0;
  const maxIterations = 10000;

  while (queue.length > 0 && iterations < maxIterations) {
    iterations++;
    queue.sort((a, b) => distances.get(a)! - distances.get(b)!);
    const current = queue.shift()!;

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === endStopId) {
      console.log(`[DIJKSTRA] Found path in ${iterations} iterations`);
      break;
    }

    const currentDistance = distances.get(current)!;
    if (currentDistance === Infinity) continue;

    const edges = graph.get(current) || [];

    for (const edge of edges) {
      if (excludedLines.includes(edge.line)) {
        continue;
      }
      
      // Add penalty for using reverse direction
      let directionPenalty = 0;
      if (edge.direction?.includes("VIRTUAL")) {
        directionPenalty = 100; // Heavy penalty for reverse direction
      }
      
      const neighbor = edge.to;
      const newDistance = currentDistance + edge.duration + directionPenalty;

      let penalty = 0;
      const prevEdge = previous.get(current)?.edge;
      if (prevEdge && prevEdge.line !== edge.line) {
        penalty = 5; // Transfer penalty
      }

      const totalDistance = newDistance + penalty;

      if (totalDistance < distances.get(neighbor)!) {
        distances.set(neighbor, totalDistance);
        previous.set(neighbor, { stopId: current, edge });
        if (!queue.includes(neighbor) && !visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
  }

  // Reconstruct path
  if (distances.get(endStopId) === Infinity) {
    console.log(`[DIJKSTRA] No path found to ${endStopId}`);
    return null;
  }

  const path: Edge[] = [];
  let current = endStopId;

  while (previous.get(current)) {
    const prev = previous.get(current)!;
    path.unshift(prev.edge);
    current = prev.stopId;
  }

  console.log(`[DIJKSTRA] Path found with ${path.length} segments`);
  return mergeConsecutiveEdges(path);
}

/**
 * Haversine function distance calculation
 */
function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}
