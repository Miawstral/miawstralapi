import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { HttpError } from '../lib/http-error';
import { createLogger } from '../lib/logger';
import { compareLineIds } from '../network/line-colors';
import type { TransitNetwork } from '../network/network';
import { getNetwork, lineFilePath, LINE_FILE_SUFFIX, reloadNetwork } from '../network/network.store';
import { createSession, destroyAllSessions, destroySession, fetchHtml, FlareSolverrUnavailableError, scrapeLine, ScrapeError } from './mistral.scraper';

const log = createLogger('refresh');

export type RefreshMode = 'smart' | 'full';

export interface RefreshResult {
    mode: RefreshMode;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    totalLines: number;
    successLines: string[];
    /** Line ids that do not exist on the network (expected during a full scan). */
    notFoundLines: string[];
    errorLines: { line: string; error: string }[];
    /** Set when the refresh stopped early. */
    aborted?: string;
}

export interface RefreshStatus {
    running: boolean;
    mode: RefreshMode | null;
    startedAt: string | null;
    processed: number;
    total: number;
    lastResult: RefreshResult | null;
}

interface WorkingLinesFile {
    lastUpdated: string;
    workingLines: string[];
    totalCount: number;
}

const workingLinesFile = () => path.join(config.dataDir, 'working_lines.json');

const status: RefreshStatus = { running: false, mode: null, startedAt: null, processed: 0, total: 0, lastResult: null };

export function getRefreshStatus(): RefreshStatus {
    return { ...status };
}

export function loadWorkingLines(): WorkingLinesFile | null {
    try {
        const parsed = JSON.parse(fs.readFileSync(workingLinesFile(), 'utf-8')) as WorkingLinesFile;
        return Array.isArray(parsed.workingLines) && parsed.workingLines.length > 0 ? parsed : null;
    } catch {
        return null;
    }
}

function saveWorkingLines(lines: string[]): void {
    const sorted = [...new Set(lines)].sort(compareLineIds);
    const data: WorkingLinesFile = { lastUpdated: new Date().toISOString(), workingLines: sorted, totalCount: sorted.length };
    writeAtomic(workingLinesFile(), JSON.stringify(data, null, 2));
}

function writeAtomic(file: string, content: string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, content, 'utf-8');
    fs.renameSync(tmp, file);
}

function existingLineIds(): string[] {
    if (!fs.existsSync(config.dataDir)) return [];
    return fs
        .readdirSync(config.dataDir)
        .filter(f => f.endsWith(LINE_FILE_SUFFIX))
        .map(f => f.slice(0, -LINE_FILE_SUFFIX.length));
}

function linesToScan(mode: RefreshMode, only?: string[]): string[] {
    if (only && only.length > 0) return only;
    if (mode === 'smart') {
        const known = loadWorkingLines()?.workingLines ?? existingLineIds();
        if (known.length > 0) return known;
    }
    const all = Array.from({ length: config.scraper.maxLineId }, (_, i) => String(i + 1));
    return [...all, 'U'];
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeWithRetry(busId: string, session?: string) {
    for (let attempt = 1; ; attempt++) {
        try {
            return await scrapeLine(busId, url => fetchHtml(url, session));
        } catch (error) {
            const retryable = !(error instanceof FlareSolverrUnavailableError) && !(error instanceof ScrapeError && !error.retryable);
            if (!retryable || attempt >= config.scraper.maxRetries) throw error;
            const wait = 2 ** attempt * 1000;
            log.warn(`Line ${busId}: attempt ${attempt} failed (${(error as Error).message}), retrying in ${wait} ms`);
            await delay(wait);
        }
    }
}

/**
 * Scrapes the timetables and rewrites the data files. A line that fails keeps
 * its previous file. The served network is reloaded at the end.
 *
 * - smart: only the lines known to exist (working_lines.json, else the files present)
 * - full: every id from 1 to SCRAPER_MAX_LINE_ID, plus "U"
 */
export async function refreshLines(mode: RefreshMode, only?: string[]): Promise<RefreshResult> {
    if (status.running) throw new HttpError(409, 'A refresh is already running');

    const lines = linesToScan(mode, only);
    const started = new Date();
    Object.assign(status, { running: true, mode, startedAt: started.toISOString(), processed: 0, total: lines.length });
    const result: RefreshResult = {
        mode,
        startedAt: started.toISOString(),
        finishedAt: '',
        durationMs: 0,
        totalLines: lines.length,
        successLines: [],
        notFoundLines: [],
        errorLines: [],
    };
    log.info(`Starting ${mode} refresh of ${lines.length} line(s)`);

    try {
        const leaked = await destroyAllSessions().catch(error => {
            if (error instanceof FlareSolverrUnavailableError) result.aborted = error.message;
            return 0;
        });
        if (leaked > 0) log.info(`Closed ${leaked} FlareSolverr session(s) left by a previous run`);
        if (result.aborted) log.error(`Refresh aborted: ${result.aborted}`);

        const queue = result.aborted ? [] : [...lines];
        const worker = async () => {
            // One browser session per worker; without it, each page opens a new browser.
            const session = await createSession().catch(error => {
                if (error instanceof FlareSolverrUnavailableError) throw error;
                log.warn(`No FlareSolverr session (${(error as Error).message}), continuing without`);
                return undefined;
            });
            try {
                for (let busId = queue.shift(); busId !== undefined && !result.aborted; busId = queue.shift()) {
                    try {
                        const line = await scrapeWithRetry(busId, session);
                        writeAtomic(lineFilePath(busId), JSON.stringify(line, null, 2));
                        result.successLines.push(busId);
                        log.info(`Line ${busId}: ${line.directions.map(d => `${d.direction} ${d.stops.length} stops`).join(', ')}`);
                    } catch (error) {
                        if (error instanceof FlareSolverrUnavailableError) {
                            result.aborted ??= error.message; // stops the other workers too
                            throw error;
                        }
                        if (error instanceof ScrapeError && !error.retryable) {
                            result.notFoundLines.push(busId);
                        } else {
                            result.errorLines.push({ line: busId, error: (error as Error).message });
                            log.warn(`Line ${busId}: ${(error as Error).message}`);
                        }
                    }
                    status.processed++;
                    if (queue.length > 0) await delay(config.scraper.delayMs);
                }
            } finally {
                if (session) await destroySession(session);
            }
        };

        const workers = await Promise.allSettled(
            Array.from({ length: Math.min(config.scraper.concurrency, queue.length) }, worker),
        );
        const unavailable = workers.find(
            (w): w is PromiseRejectedResult => w.status === 'rejected' && w.reason instanceof FlareSolverrUnavailableError,
        );
        if (unavailable) {
            result.aborted ??= (unavailable.reason as Error).message;
            log.error(`Refresh aborted: ${result.aborted}`);
        }
        const crashed = workers.find((w): w is PromiseRejectedResult => w.status === 'rejected' && w !== unavailable);
        if (crashed) throw crashed.reason;

        // Never replace the list of known lines by the result of a failed run.
        if (result.successLines.length > 0 && !only) {
            const keep = mode === 'smart' ? result.errorLines.map(e => e.line) : [];
            saveWorkingLines([...result.successLines, ...keep]);
        }
        if (result.successLines.length > 0) reloadNetwork();
    } finally {
        const finished = new Date();
        result.finishedAt = finished.toISOString();
        result.durationMs = finished.getTime() - started.getTime();
        Object.assign(status, { running: false, lastResult: result });
        log.info(
            `Refresh done in ${(result.durationMs / 1000).toFixed(1)} s: ${result.successLines.length} ok, ` +
                `${result.notFoundLines.length} not found, ${result.errorLines.length} errors`,
        );
    }
    return result;
}

// ---------------------------------------------------------------------------
// Automatic refresh
// ---------------------------------------------------------------------------

const HOUR = 3_600_000;
/** Retry delay when a refresh could not run (FlareSolverr starting, network down…). */
const RETRY_DELAY = 5 * 60_000;

/** Lines whose timetable is in the legacy format or older than `maxAgeMs`. */
export function staleLines(network: TransitNetwork, maxAgeMs: number, now = Date.now()): string[] {
    return [...network.lines.values()]
        .filter(l => l.legacy || !l.cachedAt || now - Date.parse(l.cachedAt) >= maxAgeMs)
        .map(l => l.id);
}

/** Why the served data should be refreshed, or null when it is fresh enough. */
export function staleReason(network: TransitNetwork, maxAgeMs: number, now = Date.now()): string | null {
    if (network.lines.size === 0) return 'no timetable';
    const stale = staleLines(network, maxAgeMs, now);
    if (stale.length === 0) return null;
    return stale.some(id => network.lines.get(id)!.legacy) ? 'legacy data format' : 'timetables older than the refresh interval';
}

let autoRefreshTimer: NodeJS.Timeout | null = null;

/**
 * Starts the AUTO_REFRESH_HOURS schedule (no-op when 0). Only the known lines
 * that are stale are scraped; a full scan (to discover new lines) runs only
 * when no timetable exists at all, otherwise on demand.
 */
export function startAutoRefresh(): void {
    const intervalMs = config.scraper.autoRefreshHours * HOUR;
    if (intervalMs <= 0 || autoRefreshTimer) return;

    const schedule = (delay: number) => {
        autoRefreshTimer = setTimeout(run, delay);
        autoRefreshTimer.unref();
    };

    const run = async () => {
        const network = getNetwork();
        const reason = staleReason(network, intervalMs);
        if (!reason) {
            const oldest = Math.min(...[...network.lines.values()].map(l => Date.parse(l.cachedAt ?? '') || 0));
            schedule(Math.max(RETRY_DELAY, oldest + intervalMs - Date.now()));
            return;
        }
        try {
            const stale = staleLines(network, intervalMs);
            log.info(`Automatic refresh (${reason}): ${stale.length > 0 ? `${stale.length} line(s)` : 'full scan'}`);
            const result = stale.length > 0 ? await refreshLines('smart', stale) : await refreshLines('full');
            // Lines that failed are retried with the next scheduled refresh.
            schedule(result.aborted || result.successLines.length === 0 ? RETRY_DELAY : intervalMs);
        } catch (error) {
            log.warn(`Automatic refresh failed: ${(error as Error).message}`);
            schedule(RETRY_DELAY);
        }
    };

    log.info(`Automatic refresh every ${config.scraper.autoRefreshHours} h`);
    schedule(config.scraper.autoRefreshDelayMs);
}

export function stopAutoRefresh(): void {
    if (autoRefreshTimer) clearTimeout(autoRefreshTimer);
    autoRefreshTimer = null;
}
