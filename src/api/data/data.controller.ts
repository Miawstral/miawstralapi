import type { Request, Response } from 'express';
import { config } from '../../config';
import { feedValidity, getFeed, getFeedMeta, getNetwork, initFeed } from '../../network/network.store';
import { realtime } from '../../realtime/realtime.service';

function statusPayload() {
    const network = getNetwork();
    const feed = getFeed();
    return {
        source: {
            name: 'Réseau Mistral — données ouvertes (transport.data.gouv.fr)',
            url: config.gtfs.url,
            version: feed?.feedInfo.version ?? null,
            publisher: feed?.feedInfo.publisher ?? null,
            downloadedAt: getFeedMeta()?.downloadedAt ?? null,
            validity: feedValidity(),
        },
        serviceDate: network.serviceDate,
        lines: network.lines.size,
        stops: network.stops.length,
        trips: network.tripCount,
        realtime: realtime.status(),
    };
}

/** GET /api/data/status */
export const status = (_req: Request, res: Response) => {
    res.json({ success: true, data: statusPayload() });
};

/** POST /api/data/refresh: downloads the GTFS again if it changed (admin). */
export const refresh = async (_req: Request, res: Response) => {
    await initFeed(true);
    res.json({ success: true, data: statusPayload() });
};
