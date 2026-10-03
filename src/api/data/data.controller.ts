import type { Request, Response } from 'express';
import { getNetwork } from '../../network/network.store';
import { getRefreshStatus, loadWorkingLines, refreshLines, RefreshMode } from '../../scraper/refresh.service';
import { optionalBoolean, optionalStringList } from '../validation';

/** GET /api/data/status: what is loaded and the state of the last refresh. */
export const status = (_req: Request, res: Response) => {
    const network = getNetwork();
    const cachedAt = [...network.lines.values()].map(l => l.cachedAt).filter((d): d is string => Boolean(d)).sort();
    res.json({
        success: true,
        data: {
            loadedAt: network.loadedAt.toISOString(),
            lines: network.lines.size,
            stops: network.stops.length,
            trips: network.tripCount,
            oldestTimetable: cachedAt[0] ?? null,
            newestTimetable: cachedAt[cachedAt.length - 1] ?? null,
            estimatedDirections: [...network.lines.values()].flatMap(l =>
                l.directions.filter(d => d.estimated).map(d => `${l.id}:${d.direction}`),
            ),
            workingLines: loadWorkingLines(),
            warnings: network.warnings,
            refresh: getRefreshStatus(),
        },
    });
};

/**
 * POST /api/data/refresh?mode=smart|full[&wait=true][&lines=1,87]
 * Starts a scrape in the background (202) or waits for it (200).
 */
export const refresh = (mode: RefreshMode | null) => async (req: Request, res: Response) => {
    const selected: RefreshMode = mode ?? (req.query.mode === 'full' ? 'full' : 'smart');
    const lines = optionalStringList(req.query.lines, 'lines');
    const wait = optionalBoolean(req.query.wait, 'wait') ?? false;

    const running = refreshLines(selected, lines);
    if (wait) {
        res.json({ success: true, data: await running });
        return;
    }
    // Surface "already running" synchronously, otherwise let it run in the background.
    await Promise.race([running, new Promise(resolve => setImmediate(resolve))]);
    running.catch(() => undefined);
    res.status(202).json({ success: true, message: `Refresh (${selected}) started`, data: getRefreshStatus() });
};
