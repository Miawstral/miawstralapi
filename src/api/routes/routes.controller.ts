import type { Request, Response } from 'express';
import { config } from '../../config';
import { nowInTimezone } from '../../lib/time';
import { getNetwork } from '../../network/network.store';
import { planJourneys } from '../../routing/planner';
import { parseRouteRequest } from './routes.validation';

export const calculate = async (req: Request, res: Response) => {
    const request = parseRouteRequest(req.body, nowInTimezone(config.timezone));
    const result = await planJourneys(getNetwork(), request);
    res.setHeader('Server-Timing', `route;dur=${result.calculationTime}`);
    res.json({ success: true, data: result });
};
