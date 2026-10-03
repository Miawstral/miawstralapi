import type { Request, Response } from 'express';
import { getNetwork } from '../../network/network.store';
import { requiredString } from '../validation';
import * as linesService from './lines.service';

export const getAll = (_req: Request, res: Response) => {
    res.json(linesService.listLines(getNetwork()));
};

export const search = (req: Request, res: Response) => {
    res.json(linesService.searchLines(getNetwork(), requiredString(req.query.q, 'q')));
};

export const getById = (req: Request<{ id: string }>, res: Response) => {
    res.json(linesService.getLineDetails(getNetwork(), req.params.id));
};
