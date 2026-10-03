import type { Request, Response } from 'express';
import { getNetwork } from '../../network/network.store';
import { sendCachedJson } from '../http-cache';
import { resolveServiceTime } from '../service-time';
import { optionalDate, requiredString } from '../validation';
import * as linesService from './lines.service';

const networkOf = (req: Request) => getNetwork(resolveServiceTime(optionalDate(req.query.date, 'date'), undefined).date);

export const getAll = (req: Request, res: Response) => {
    const network = networkOf(req);
    sendCachedJson(res, `lines:${network.serviceDate}:${network.loadedAt.getTime()}`, () => linesService.listLines(network));
};

export const search = (req: Request, res: Response) => {
    res.json(linesService.searchLines(networkOf(req), requiredString(req.query.q, 'q')));
};

export const getById = (req: Request<{ id: string }>, res: Response) => {
    res.json(linesService.getLineDetails(networkOf(req), req.params.id));
};

export const getShape = (req: Request<{ id: string }>, res: Response) => {
    const network = networkOf(req);
    sendCachedJson(res, `shape:${req.params.id}:${network.serviceDate}:${network.loadedAt.getTime()}`, () =>
        linesService.getLineShape(network, req.params.id),
    );
};
