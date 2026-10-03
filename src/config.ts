import fs from 'fs';
import path from 'path';

/** Repository root: works both from `src/` (tsx) and from `dist/` (compiled). */
const projectRoot = path.resolve(__dirname, '..');

const envFile = path.join(projectRoot, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
    // Variables already set in the environment take precedence over the file.
    process.loadEnvFile(envFile);
}

function bool(name: string, fallback: boolean): boolean {
    const value = process.env[name];
    if (value === undefined || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function int(name: string, fallback: number): number {
    const value = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isFinite(value) ? value : fallback;
}

const trimUrl = (value: string | undefined) => (value ?? '').trim().replace(/\/+$/, '');
const osrmFootUrl = trimUrl(process.env.OSRM_FOOT_URL) || trimUrl(process.env.OSRM_URL);
const osrmCarUrl = trimUrl(process.env.OSRM_CAR_URL) || trimUrl(process.env.OSRM_URL);

function resolvePath(value: string | undefined, fallback: string): string {
    if (!value) return fallback;
    return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
}

export const config = {
    env: process.env.NODE_ENV ?? 'development',
    isProduction: process.env.NODE_ENV === 'production',
    port: int('PORT', 3000),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    /** Comma separated list of allowed origins, `*` (default) allows everything. */
    corsOrigin: process.env.CORS_ORIGIN ?? '*',

    dataDir: resolvePath(process.env.DATA_DIR, path.join(projectRoot, 'data')),
    /** Built React client served on `/` when present. */
    clientDir: resolvePath(process.env.CLIENT_DIR, path.join(projectRoot, 'client', 'dist')),

    timezone: process.env.TZ_NETWORK ?? 'Europe/Paris',
    /** Mirror the scraped direction of a line when the other one is missing. */
    estimateMissingDirections: bool('ESTIMATE_MISSING_DIRECTIONS', true),

    /**
     * Street-level geometries. One osrm-routed serves one profile, so walking and
     * driving can have their own server; OSRM_URL is used for both otherwise.
     * Without OSRM, itineraries use straight lines between stops.
     */
    osrm: {
        enabled: bool('USE_OSRM', true) && Boolean(osrmFootUrl || osrmCarUrl),
        footUrl: osrmFootUrl,
        carUrl: osrmCarUrl,
        timeoutMs: int('OSRM_TIMEOUT_MS', 3000),
        /** After a failure, OSRM is not called again for this long. */
        cooldownMs: int('OSRM_COOLDOWN_MS', 60_000),
    },

    scraper: {
        flaresolverrUrl: process.env.FLARESOLVERR_URL ?? 'http://localhost:8191/v1',
        timeoutMs: int('FLARESOLVERR_TIMEOUT_MS', 60_000),
        /** Lines scraped in parallel, each by its own browser session (SCRAPER_BATCH_SIZE before 2.0). */
        concurrency: Math.max(1, int('SCRAPER_CONCURRENCY', int('SCRAPER_BATCH_SIZE', 2))),
        /** Pause of each worker between two lines. */
        delayMs: int('SCRAPER_DELAY_MS', int('SCRAPER_BATCH_DELAY_MS', 500)),
        maxRetries: int('SCRAPER_MAX_RETRIES', 3),
        /** Highest numeric line id tried during a full scan. */
        maxLineId: int('SCRAPER_MAX_LINE_ID', 300),
        /** Day of the timetables to scrape (YYYY-MM-DD). Default: the next working day. */
        date: process.env.SCRAPER_DATE ?? '',
        /**
         * Refresh the timetables automatically every N hours (0 = never). At
         * startup, a refresh runs right away when the data is older than that or
         * still in the legacy format.
         */
        autoRefreshHours: int('AUTO_REFRESH_HOURS', 0),
        /** Delay before the startup refresh, to let FlareSolverr start. */
        autoRefreshDelayMs: int('AUTO_REFRESH_DELAY_MS', 20_000),
    },

    /** Required (Bearer token) to call the data refresh endpoints. They are disabled when empty. */
    adminToken: process.env.ADMIN_TOKEN ?? '',
} as const;

export type AppConfig = typeof config;
