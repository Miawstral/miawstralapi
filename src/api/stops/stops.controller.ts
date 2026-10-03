import type { Request, Response } from 'express';
import { config } from '../../config';
import { nowInTimezone } from '../../lib/time';
import { getNetwork } from '../../network/network.store';
import { optionalNumber, optionalTime, requiredNumber, requiredString } from '../validation';
import * as stopsService from './stops.service';

export const getAll = (_req: Request, res: Response) => {
    res.json(stopsService.listStops(getNetwork()));
};

export const search = (req: Request, res: Response) => {
    const query = requiredString(req.query.q, 'q');
    const limit = optionalNumber(req.query.limit, 'limit', { min: 1, max: 100, integer: true }) ?? 20;
    res.json(stopsService.searchStops(getNetwork(), query, limit));
};

export const findNearby = (req: Request, res: Response) => {
    const lat = requiredNumber(req.query.lat, 'lat', { min: -90, max: 90 });
    const lon = requiredNumber(req.query.lon, 'lon', { min: -180, max: 180 });
    const radius = optionalNumber(req.query.radius, 'radius', { min: 1, max: 5000 }) ?? 500;
    const limit = optionalNumber(req.query.limit, 'limit', { min: 1, max: 200, integer: true }) ?? 50;
    res.json(stopsService.nearbyStops(getNetwork(), lat, lon, radius, limit));
};

export const getById = (req: Request<{ id: string }>, res: Response) => {
    res.json(stopsService.getStopDetails(getNetwork(), req.params.id));
};

export const getDepartures = (req: Request<{ id: string }>, res: Response) => {
    const after = optionalTime(req.query.time, 'time') ?? nowInTimezone(config.timezone);
    const limit = optionalNumber(req.query.limit, 'limit', { min: 1, max: 50, integer: true }) ?? 10;
    res.json(stopsService.getDepartures(getNetwork(), req.params.id, after, limit));
};
