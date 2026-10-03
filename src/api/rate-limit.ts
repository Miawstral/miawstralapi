import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { HttpError } from '../lib/http-error';

const WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

/** Fixed-window limit per client IP on the expensive endpoints (RATE_LIMIT_PER_MINUTE). */
export function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const limit = config.rateLimitPerMinute;
    if (limit <= 0) return next();
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + WINDOW_MS };
        hits.set(key, entry);
        if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    entry.count++;
    res.set('RateLimit-Limit', String(limit));
    res.set('RateLimit-Remaining', String(Math.max(0, limit - entry.count)));
    res.set('RateLimit-Reset', String(Math.ceil((entry.resetAt - now) / 1000)));
    if (entry.count > limit) {
        res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
        throw new HttpError(429, 'Too many requests, try again in a minute.');
    }
    next();
}
