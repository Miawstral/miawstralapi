import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { HttpError } from '../lib/http-error';

/** Protects admin endpoints with `Authorization: Bearer <ADMIN_TOKEN>`. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
    if (!config.adminToken) {
        throw new HttpError(403, 'Data refresh is disabled: set ADMIN_TOKEN to enable it.');
    }
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const expected = Buffer.from(config.adminToken);
    const given = Buffer.from(token);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
        throw new HttpError(401, 'Invalid or missing admin token.');
    }
    next();
}
