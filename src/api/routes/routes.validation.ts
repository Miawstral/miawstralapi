import { badRequest } from '../../lib/http-error';
import type { PlanRequest } from '../../routing/planner';
import { optionalBoolean, optionalNumber, optionalStringList, optionalTime } from '../validation';

function parseLocation(value: unknown, name: 'from' | 'to'): PlanRequest['from'] {
    if (!value || typeof value !== 'object') throw badRequest(`'${name}' is required.`);
    const location = value as Record<string, unknown>;
    const label = typeof location.name === 'string' ? location.name : undefined;

    if (typeof location.stopId === 'string' && location.stopId.trim() !== '') {
        return { stopId: location.stopId.trim(), name: label };
    }
    const lat = optionalNumber(location.lat, `${name}.lat`, { min: -90, max: 90 });
    const lon = optionalNumber(location.lon, `${name}.lon`, { min: -180, max: 180 });
    if (lat === undefined || lon === undefined) {
        throw badRequest(`'${name}' must have either lat/lon or stopId`);
    }
    return { lat, lon, name: label };
}

/** Validates the body of POST /api/routes/calculate. */
export function parseRouteRequest(body: unknown, now: number): PlanRequest {
    if (!body || typeof body !== 'object') throw badRequest('A JSON body is required.');
    const b = body as Record<string, unknown>;

    const arriveBy = optionalTime(b.arrivalTime, 'arrivalTime');
    if (arriveBy !== undefined && b.departureTime) throw badRequest("Use either 'departureTime' or 'arrivalTime'.");

    return {
        from: parseLocation(b.from, 'from'),
        to: parseLocation(b.to, 'to'),
        departure: optionalTime(b.departureTime, 'departureTime') ?? (arriveBy !== undefined ? arriveBy : now),
        arriveBy,
        wheelchair: optionalBoolean(b.wheelchair, 'wheelchair') ?? false,
        maxWalkingDistance: optionalNumber(b.maxWalkingDistance, 'maxWalkingDistance', { min: 0, max: 3000 }) ?? 800,
        maxTransfers: optionalNumber(b.maxTransfers, 'maxTransfers', { min: 0, max: 4, integer: true }) ?? 2,
        excludedLines: optionalStringList(b.excludedLines, 'excludedLines') ?? [],
        maxResults: optionalNumber(b.maxResults, 'maxResults', { min: 1, max: 10, integer: true }) ?? 5,
        includeGeometry: optionalBoolean(b.includeGeometry, 'includeGeometry') ?? true,
    };
}
