import type { Response } from 'express';

/**
 * Responses that only change when the timetable changes (stop and line lists)
 * are serialized once and served with an ETag: clients revalidate cheaply.
 */
const cache = new Map<string, string>();
const MAX_ENTRIES = 32;

export function sendCachedJson(res: Response, key: string, build: () => unknown): void {
    let body = cache.get(key);
    if (body === undefined) {
        body = JSON.stringify(build());
        cache.set(key, body);
        if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    }
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
    res.type('application/json').send(body);
}
