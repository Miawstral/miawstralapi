import { Router } from 'express';
import { CacheController } from './cache.controller';

const router = Router();
const cacheController = new CacheController();

/**
 * @route POST /refresh
 * @description Smart refresh: use cached working lines if available, otherwise full scan
 * @access Public
 */
router.post('/refresh', cacheController.refreshCache);

/**
 * @route POST /full
 * @description Force full refresh (ignore cached working lines, scan 1-300)
 * @access Public
 */
router.post('/full', cacheController.forceFullRefresh);

/**
 * @route GET /stats
 * @description Get cache statistics (number of cached lines, files, etc.)
 * @access Public
 */
router.get('/stats', cacheController.getCacheStats);

export default router;
