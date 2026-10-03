import { Router, type Request, type Response } from 'express';
import { getNetwork } from '../../network/network.store';
import { liveVehicles, serviceAlerts } from '../../realtime/enrich';
import { optionalStringList } from '../validation';
import { badRequest } from '../../lib/http-error';

const router = Router();

/** GET /api/realtime/vehicles?bbox=minLon,minLat,maxLon,maxLat&lines=1,87 */
router.get('/vehicles', async (req: Request, res: Response) => {
    const bbox = optionalStringList(req.query.bbox, 'bbox')?.map(Number);
    if (bbox && (bbox.length !== 4 || bbox.some(v => !Number.isFinite(v)))) throw badRequest("'bbox' must be minLon,minLat,maxLon,maxLat");
    const lines = new Set(optionalStringList(req.query.lines, 'lines') ?? []);

    const { updatedAt, vehicles } = await liveVehicles(getNetwork());
    const filtered = vehicles.filter(
        v =>
            (!bbox || (v.lon >= bbox[0] && v.lat >= bbox[1] && v.lon <= bbox[2] && v.lat <= bbox[3])) &&
            (lines.size === 0 || (v.line !== null && lines.has(v.line))),
    );
    res.set('Cache-Control', 'no-cache');
    res.json({ updatedAt, count: filtered.length, vehicles: filtered });
});

/** GET /api/realtime/alerts?line=87 */
router.get('/alerts', async (req: Request, res: Response) => {
    const network = getNetwork();
    const asked = typeof req.query.line === 'string' ? req.query.line : null;
    const line = asked ? (network.getLine(asked)?.id ?? asked) : null;
    const alerts = await serviceAlerts(network);
    res.set('Cache-Control', 'public, max-age=120');
    res.json({ alerts: line ? alerts.filter(a => a.lines.some(l => l.id === line)) : alerts });
});

export default router;
