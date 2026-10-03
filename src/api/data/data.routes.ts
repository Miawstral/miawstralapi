import { Router } from 'express';
import { requireAdmin } from '../auth';
import * as dataController from './data.controller';

const router = Router();

router.get('/status', dataController.status);
router.post('/refresh', requireAdmin, dataController.refresh(null));

export default router;

/** Pre-2.0 endpoints (`/refresh/refresh`, `/refresh/full`, `/refresh/stats`), kept for compatibility. */
export const legacyRefreshRouter = Router();
legacyRefreshRouter.post('/refresh', requireAdmin, dataController.refresh('smart'));
legacyRefreshRouter.post('/full', requireAdmin, dataController.refresh('full'));
legacyRefreshRouter.get('/stats', dataController.status);
