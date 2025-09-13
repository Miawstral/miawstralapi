import { Request, Response } from 'express';
import { CacheService } from './cache.service';

export class CacheController {
    private cacheService: CacheService;

    constructor() {
        this.cacheService = new CacheService();
    }

    /**
     * Refresh all bus lines cache
     * POST /refresh
     */
    refreshCache = async (req: Request, res: Response): Promise<void> => {
        try {
            console.log('[INFO] Cache refresh requested via API');
            
            const result = await this.cacheService.refreshAllLines();
            
            const mode = result.successLines.length < 50 ? 'Smart (cached lines)' : 'Full scan (1-300)';
            
            res.status(200).json({
                success: true,
                message: 'Cache refresh completed',
                mode: mode,
                data: {
                    totalLines: result.totalLines,
                    successCount: result.successCount,
                    warningCount: result.warningCount,
                    errorCount: result.errorCount,
                    successRate: ((result.successCount / result.totalLines) * 100).toFixed(1) + '%',
                    summary: result.summary,
                    details: {
                        successLines: result.successLines,
                        warningLines: result.warningLines,
                        errorLines: result.errorLines
                    }
                }
            });
        } catch (error) {
            console.error('[ERROR] Cache refresh failed:', error);
            res.status(500).json({
                success: false,
                message: 'Cache refresh failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    /**
     * Force full refresh (ignore cached working lines)
     * POST /refresh/full
     */
    forceFullRefresh = async (req: Request, res: Response): Promise<void> => {
        try {
            console.log('[INFO] FORCED full cache refresh requested via API');
            
            const result = await this.cacheService.forceFullRefresh();
            
            res.status(200).json({
                success: true,
                message: 'Forced full cache refresh completed',
                mode: 'Full scan (1-300)',
                data: {
                    totalLines: result.totalLines,
                    successCount: result.successCount,
                    warningCount: result.warningCount,
                    errorCount: result.errorCount,
                    successRate: ((result.successCount / result.totalLines) * 100).toFixed(1) + '%',
                    summary: result.summary,
                    details: {
                        successLines: result.successLines,
                        warningLines: result.warningLines,
                        errorLines: result.errorLines
                    }
                }
            });
        } catch (error) {
            console.error('[ERROR] Forced cache refresh failed:', error);
            res.status(500).json({
                success: false,
                message: 'Forced cache refresh failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };
    getCacheStats = async (req: Request, res: Response): Promise<void> => {
        try {
            const stats = this.cacheService.getCacheStats();
            
            res.status(200).json({
                success: true,
                message: 'Cache statistics retrieved',
                data: stats
            });
        } catch (error) {
            console.error('[ERROR] Failed to get cache stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get cache statistics',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };
}
