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

    /** Official open data of the Réseau Mistral (transport.data.gouv.fr). */
    gtfs: {
        url: process.env.GTFS_URL ?? 'https://www.data.gouv.fr/api/1/datasets/r/b0789d9e-5077-4124-b6b2-773353ada8cf',
        /** Check for a new timetable every N hours (0 = never). */
        refreshHours: int('GTFS_REFRESH_HOURS', 12),
    },
    realtime: {
        enabled: bool('REALTIME', true),
        vehiclePositionsUrl:
            process.env.GTFS_RT_VEHICLES_URL ?? 'https://www.data.gouv.fr/api/1/datasets/r/9fe8291c-2fb2-4f89-b578-282ba05dd999',
        tripUpdatesUrl:
            process.env.GTFS_RT_TRIP_UPDATES_URL ?? 'https://www.data.gouv.fr/api/1/datasets/r/10f2e5d4-6a1b-45e2-897a-5b9044ebb6b3',
        alertsUrl: process.env.GTFS_RT_ALERTS_URL ?? 'https://www.data.gouv.fr/api/1/datasets/r/f30614b3-a35b-4c9f-98c9-7450585d3941',
        /** Feeds are fetched on demand, at most once per this many seconds. */
        vehiclesTtlSeconds: int('REALTIME_VEHICLES_TTL', 10),
        tripUpdatesTtlSeconds: int('REALTIME_TRIP_UPDATES_TTL', 20),
        alertsTtlSeconds: int('REALTIME_ALERTS_TTL', 120),
    },

    /** Requests per minute and per IP on the expensive endpoints (0 = unlimited). */
    rateLimitPerMinute: int('RATE_LIMIT_PER_MINUTE', 120),

    /** Required (Bearer token) to force a timetable refresh. The endpoint is disabled when empty. */
    adminToken: process.env.ADMIN_TOKEN ?? '',
} as const;

export type AppConfig = typeof config;
