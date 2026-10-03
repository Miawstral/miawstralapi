import { createApp } from './app';
import { config } from './config';
import { createLogger } from './lib/logger';
import { getNetwork, initFeed } from './network/network.store';

const log = createLogger('server');

async function main(): Promise<void> {
    // Timetables first: from the cache, downloaded on the first start.
    await initFeed();
    const network = getNetwork();
    if (network.lines.size === 0) log.warn('No timetable loaded: check GTFS_URL and the network access.');

    const server = createApp().listen(config.port, () => {
        log.info(`Miawstral is running on http://localhost:${config.port} (docs: /docs)`);
        if (!config.osrm.enabled) log.info('OSRM disabled: walks are drawn as straight lines (set OSRM_FOOT_URL to enable).');
    });

    // New timetables are published regularly: check for them (conditional download).
    let refreshTimer: NodeJS.Timeout | null = null;
    if (config.gtfs.refreshHours > 0) {
        refreshTimer = setInterval(() => {
            initFeed(true).catch(error => log.warn(`GTFS refresh failed: ${(error as Error).message}`));
        }, config.gtfs.refreshHours * 3_600_000);
        refreshTimer.unref();
    }

    const shutdown = (signal: string) => {
        log.info(`${signal} received, shutting down`);
        if (refreshTimer) clearInterval(refreshTimer);
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(error => {
    log.error(`Startup failed: ${(error as Error).stack ?? error}`);
    process.exit(1);
});
