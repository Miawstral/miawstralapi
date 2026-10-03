import { createApp } from './app';
import { config } from './config';
import { createLogger } from './lib/logger';
import { getNetwork } from './network/network.store';
import { startAutoRefresh, stopAutoRefresh } from './scraper/refresh.service';

const log = createLogger('server');

// Load the timetables before accepting requests.
const network = getNetwork();
if (network.lines.size === 0) log.warn(`No timetable found in ${config.dataDir}: run "npm run scrape -- --full"`);

const server = createApp().listen(config.port, () => {
    log.info(`Miawstral is running on http://localhost:${config.port} (docs: /api/docs)`);
    if (!config.osrm.enabled) log.info('OSRM disabled: itineraries use straight lines (set OSRM_URL to enable).');
    if (!config.adminToken) log.info('ADMIN_TOKEN not set: data refresh endpoints are disabled.');
    startAutoRefresh();
});

function shutdown(signal: string): void {
    log.info(`${signal} received, shutting down`);
    stopAutoRefresh();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
