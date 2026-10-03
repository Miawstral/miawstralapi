import type { Request, Response } from 'express';
import { getNetwork } from '../../network/network.store';
import { resolveServiceTime } from '../service-time';
import { optionalBoolean, optionalDate, optionalNumber, optionalTime, requiredNumber, requiredString } from '../validation';
import * as stopsService from './stops.service';
import { sendCachedJson } from '../http-cache';

export const getAll = (_req: Request, res: Response) => {
    const network = getNetwork();
    sendCachedJson(res, `stops:${network.serviceDate}:${network.loadedAt.getTime()}`, () => stopsService.listStops(network));
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
    const { date } = resolveServiceTime(optionalDate(req.query.date, 'date'), undefined);
    res.json(stopsService.getStopDetails(getNetwork(date), req.params.id));
};

export const getDepartures = async (req: Request<{ id: string }>, res: Response) => {
    const { date, minutes } = resolveServiceTime(optionalDate(req.query.date, 'date'), optionalTime(req.query.time, 'time'));
    const limit = optionalNumber(req.query.limit, 'limit', { min: 1, max: 50, integer: true }) ?? 10;
    const area = optionalBoolean(req.query.area, 'area') ?? true;
    res.set('Cache-Control', 'no-cache');
    res.json(await stopsService.getDepartures(getNetwork(date), req.params.id, minutes, limit, area));
};
