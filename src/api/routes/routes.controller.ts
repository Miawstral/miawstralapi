import type { Request, Response } from 'express';
import { getNetwork } from '../../network/network.store';
import { planJourneys } from '../../routing/planner';
import { resolveServiceTime } from '../service-time';
import { optionalDate } from '../validation';
import { parseRouteRequest } from './routes.validation';

export const calculate = async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = parseRouteRequest(body, -1);
    const requested = parsed.arriveBy ?? (parsed.departure >= 0 ? parsed.departure : undefined);
    const { date, minutes } = resolveServiceTime(optionalDate(body.date, 'date'), requested);
    const request = {
        ...parsed,
        departure: minutes,
        arriveBy: parsed.arriveBy === undefined ? undefined : minutes,
    };
    const result = await planJourneys(getNetwork(date), request);
    res.setHeader('Server-Timing', `route;dur=${result.calculationTime}`);
    res.json({ success: true, data: result });
};
