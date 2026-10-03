import { Router, type Request, type Response } from 'express';
import { getNetwork } from '../../network/network.store';
import { accessStops, resolvePlace } from '../../routing/planner';
import { reachability } from '../../routing/raptor';
import { formatTime } from '../../lib/time';
import { resolveServiceTime } from '../service-time';
import { optionalBoolean, optionalDate, optionalNumber, optionalTime } from '../validation';
import { badRequest } from '../../lib/http-error';

const router = Router();

/**
 * GET /api/isochrone?stopId=…|lat=…&lon=…&time=08:00&maxDuration=45&maxTransfers=2
 * Every stop reachable within `maxDuration` minutes, with the travel time.
 */
router.get('/', (req: Request, res: Response) => {
    const { date, minutes } = resolveServiceTime(optionalDate(req.query.date, 'date'), optionalTime(req.query.time, 'time'));
    const network = getNetwork(date);
    const stopId = typeof req.query.stopId === 'string' ? req.query.stopId : undefined;
    const lat = optionalNumber(req.query.lat, 'lat', { min: -90, max: 90 });
    const lon = optionalNumber(req.query.lon, 'lon', { min: -180, max: 180 });
    if (!stopId && (lat === undefined || lon === undefined)) throw badRequest("Give either 'stopId' or 'lat' and 'lon'.");
    const maxDuration = optionalNumber(req.query.maxDuration, 'maxDuration', { min: 5, max: 180, integer: true }) ?? 45;
    const maxTransfers = optionalNumber(req.query.maxTransfers, 'maxTransfers', { min: 0, max: 4, integer: true }) ?? 2;
    const wheelchair = optionalBoolean(req.query.wheelchair, 'wheelchair') ?? false;

    const started = Date.now();
    const origin = resolvePlace(network, stopId ? { stopId } : { lat, lon });
    const access = accessStops(network, origin, 600, wheelchair);
    const reach = reachability(network, { departure: minutes, access, maxTransfers, accessibleOnly: wheelchair });

    const stops = [];
    for (let i = 0; i < network.stops.length; i++) {
        const duration = reach.arrival[i] - minutes;
        if (!Number.isFinite(duration) || duration > maxDuration) continue;
        const stop = network.stops[i];
        stops.push({
            stopPointId: stop.id,
            name: stop.name,
            lat: stop.lat,
            lon: stop.lon,
            duration: Math.round(duration),
            transfers: Math.max(0, reach.rides[i] - 1),
        });
    }
    stops.sort((a, b) => a.duration - b.duration);
    res.json({
        origin,
        serviceDate: date,
        departureTime: formatTime(minutes),
        maxDuration,
        calculationTime: Date.now() - started,
        stops,
    });
});

export default router;
