import * as cheerio from 'cheerio';
import { config } from '../config';
import type { Direction, RawDirection, RawLineFileV2, RawStop } from '../interfaces/BusData';

/**
 * Scraper of the Réseau Mistral timetables published by Instant System.
 * The site sits behind Cloudflare, so pages are fetched through FlareSolverr
 * (https://github.com/FlareSolverr/FlareSolverr).
 */

const TIMETABLE_BASE_URL = 'https://sim.112.prod.instant-system.com/fr/horaires/Reseau-Mistral/Bus/ligne';
export const DIRECTIONS: Direction[] = ['OUTWARD', 'INWARD'];
/** Direction names used by the site. */
const SITE_DIRECTION: Record<Direction, string> = { OUTWARD: 'OUTWARD', INWARD: 'RETURN' };

/** Fixed-date French public holidays (MM-DD): reduced service, never used as reference day. */
const PUBLIC_HOLIDAYS = new Set(['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25']);

export class ScrapeError extends Error {
    constructor(message: string, readonly retryable = true) {
        super(message);
        this.name = 'ScrapeError';
    }
}

/** FlareSolverr cannot be reached at all: retrying other lines is pointless. */
export class FlareSolverrUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FlareSolverrUnavailableError';
    }
}

/** "7" → "0007", "87" → "0087", "U" → "U". */
export function mistralCode(busId: string): string {
    return /^\d+$/.test(busId) ? busId.padStart(4, '0') : busId.toUpperCase();
}

/**
 * Day whose timetable is scraped (YYYY-MM-DD): SCRAPER_DATE, or the next
 * working day so that the data reflects the usual weekday service.
 */
export function referenceServiceDate(now: Date = new Date(), configured = config.scraper.date): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(configured)) return configured;
    const format = new Intl.DateTimeFormat('en-CA', {
        timeZone: config.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
    });
    for (let offset = 0; ; offset++) {
        const parts = format.formatToParts(new Date(now.getTime() + offset * 86_400_000));
        const get = (type: string) => parts.find(p => p.type === type)!.value;
        const date = `${get('year')}-${get('month')}-${get('day')}`;
        if (!['Sat', 'Sun'].includes(get('weekday')) && !PUBLIC_HOLIDAYS.has(date.slice(5))) return date;
    }
}

export function timetableUrl(busId: string, direction: Direction, date = ''): string {
    const code = mistralCode(busId);
    const siteDirection = SITE_DIRECTION[direction];
    const path = `${TIMETABLE_BASE_URL}/${encodeURIComponent(busId)}/direction/${siteDirection}/MISTRAL:${code}`;
    const query = new URLSearchParams({
        islid: `MISTRAL:${code}`,
        ismode: 'Bus',
        islsn: busId,
        issubnet: 'Reseau Mistral',
        isdir: siteDirection,
        w: 'true',
        date,
    });
    return `${path}?${query.toString().replace(/\+/g, '%20')}`;
}

export interface ParsedTimetable {
    lineName: string | null;
    direction: string | null;
    lineId: string | null;
    stops: RawStop[];
    notes: string[];
}

const TIME_PATTERN = /(\d{1,2}):(\d{2})/;

function parseCell(text: string): string | null {
    const match = TIME_PATTERN.exec(text);
    return match ? `${Number(match[1])}:${match[2]}` : null;
}

/**
 * Parses a timetable page. Rows are stops, columns are trips; a "-" cell (trip
 * not serving the stop) is kept as `null` so every row has the same columns.
 */
export function parseTimetable(html: string): ParsedTimetable {
    if (/cf-error-details|Attention Required! \| Cloudflare|You have been blocked/.test(html)) {
        throw new ScrapeError('Blocked by Cloudflare');
    }

    const $ = cheerio.load(html);
    const stops: RawStop[] = [];

    $('.is-LineDirection-Timesheet tbody tr').each((_, row) => {
        const header = $(row).find('th.is-Timesheet-StopPoint .is-Timesheet-StopPoint-Link');
        if (header.length === 0) return;

        const times: (string | null)[] = [];
        const cell = $(row).find('td.is-Timesheet-Passages');
        const items = cell.find('li.is-Timesheet-Passage-Item');
        if (items.length > 0) {
            items.each((__, item) => {
                times.push(parseCell($(item).find('.is-Timesheet-Passage-Item-C1').text()));
            });
        } else {
            // Some tables have no list: "6:45 - 7:10 -"
            for (const token of cell.text().split(/\s+/).filter(Boolean)) times.push(parseCell(token));
        }

        const name = (header.attr('data-stoppoint-name') || header.text()).replace(/\s+/g, ' ').trim();
        if (!name) return;
        stops.push({
            name,
            city: header.find('.is-Timesheet-StopPoint-City').first().text().trim() || null,
            latitude: header.attr('data-lat') ?? null,
            longitude: header.attr('data-lon') ?? null,
            stopPointId: header.attr('data-stoppoint-id') ?? null,
            accessible: header.find('.is-Icon-sim-accessible').length > 0,
            times,
        });
    });

    if (stops.length === 0) {
        const reason = $('.is-Result-Error-Description').text().trim();
        throw new ScrapeError(reason || 'No timetable found', false);
    }

    // Every row must expose the same trip columns.
    const columns = Math.max(...stops.map(s => s.times.length));
    for (const stop of stops) {
        while (stop.times.length < columns) stop.times.push(null);
    }

    const input = $('#is-SchedulesInput');
    return {
        lineName: (input.val() as string | undefined)?.trim() || null,
        direction: input.attr('data-direction-id') ?? null,
        lineId: input.attr('data-line-id') ?? null,
        stops: stops.filter(s => s.times.some(t => t !== null)),
        notes: $('.is-Timesheet-Note')
            .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
            .get()
            .filter(Boolean),
    };
}

interface FlareSolverrResponse {
    status?: string;
    message?: string;
    session?: string;
    solution?: { status?: number; response?: string };
}

async function callFlareSolverr(payload: Record<string, unknown>): Promise<FlareSolverrResponse> {
    let response: Response;
    try {
        response = await fetch(config.scraper.flaresolverrUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(config.scraper.timeoutMs + 10_000),
        });
    } catch (error) {
        const cause = (error as { cause?: { code?: string } }).cause?.code;
        if (cause === 'ECONNREFUSED' || cause === 'ENOTFOUND' || cause === 'EAI_AGAIN') {
            throw new FlareSolverrUnavailableError(`FlareSolverr unreachable at ${config.scraper.flaresolverrUrl} (${cause})`);
        }
        throw new ScrapeError(`FlareSolverr request failed: ${(error as Error).message}`);
    }
    const body = (await response.json().catch(() => null)) as FlareSolverrResponse | null;
    if (!response.ok || body?.status !== 'ok') {
        throw new ScrapeError(`FlareSolverr error: ${body?.message ?? `HTTP ${response.status}`}`);
    }
    return body;
}

/**
 * A FlareSolverr session keeps one browser (and the Cloudflare clearance)
 * between requests: much faster and lighter than a new browser per page.
 */
export async function createSession(): Promise<string> {
    const body = await callFlareSolverr({ cmd: 'sessions.create' });
    if (!body.session) throw new ScrapeError('FlareSolverr did not return a session');
    return body.session;
}

export async function destroySession(session: string): Promise<void> {
    await callFlareSolverr({ cmd: 'sessions.destroy', session }).catch(() => undefined);
}

/**
 * Closes every open session. Miawstral is FlareSolverr's only client: sessions
 * still open belong to a refresh interrupted by a restart, and each one keeps a
 * browser in memory.
 */
export async function destroyAllSessions(): Promise<number> {
    const body = (await callFlareSolverr({ cmd: 'sessions.list' })) as FlareSolverrResponse & { sessions?: string[] };
    const sessions = body.sessions ?? [];
    await Promise.all(sessions.map(destroySession));
    return sessions.length;
}

/** Fetches a page through FlareSolverr, optionally inside a session. */
export async function fetchHtml(url: string, session?: string): Promise<string> {
    const body = await callFlareSolverr({
        cmd: 'request.get',
        url,
        maxTimeout: config.scraper.timeoutMs,
        // Images, fonts and styles are useless to read the timetable.
        disableMedia: true,
        ...(session ? { session } : {}),
    });
    if (!body.solution?.response) throw new ScrapeError('FlareSolverr returned an empty page');
    if (body.solution.status && body.solution.status >= 400 && body.solution.status !== 404) {
        throw new ScrapeError(`Timetable page answered HTTP ${body.solution.status}`);
    }
    return body.solution.response;
}

/**
 * Scrapes both directions of a line. A missing direction is tolerated (some
 * lines are loops); the line fails only when no direction could be read.
 */
export async function scrapeLine(
    busId: string,
    fetchPage: (url: string) => Promise<string> = fetchHtml,
    date = referenceServiceDate(),
): Promise<RawLineFileV2> {
    const directions: RawDirection[] = [];
    let meta: ParsedTimetable | null = null;
    let firstError: Error | null = null;

    for (const direction of DIRECTIONS) {
        try {
            const parsed = parseTimetable(await fetchPage(timetableUrl(busId, direction, date)));
            // A line without this direction answers with the other one: do not store it twice.
            if (parsed.direction && parsed.direction !== SITE_DIRECTION[direction]) {
                throw new ScrapeError(`No ${direction} timetable`, false);
            }
            meta ??= parsed;
            directions.push({ direction, stops: parsed.stops });
        } catch (error) {
            // Only "this direction does not exist" is tolerated: a transient failure must
            // not produce a file with a direction missing.
            if (!(error instanceof ScrapeError) || error.retryable) throw error;
            firstError ??= error;
            if (direction === 'OUTWARD') break; // unknown line: no need to ask for the other direction
        }
    }

    if (!meta || directions.length === 0) {
        throw firstError ?? new ScrapeError('No timetable found', false);
    }
    return {
        version: 2,
        bus_id: busId,
        lineName: meta.lineName,
        lineId: meta.lineId,
        notes: meta.notes,
        cachedAt: new Date().toISOString(),
        serviceDate: date,
        directions,
    };
}
