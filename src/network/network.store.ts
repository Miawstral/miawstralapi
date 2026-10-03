import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { parseGtfsZip, type GtfsFeed } from '../gtfs/feed';
import { sourceForDate } from '../gtfs/source';
import { createLogger } from '../lib/logger';
import { serviceDateNow } from '../lib/time';
import { TransitNetwork } from './network';

const log = createLogger('network');

const feedFile = () => path.join(config.dataDir, 'gtfs.zip');
const feedMetaFile = () => path.join(config.dataDir, 'gtfs.meta.json');

interface FeedMeta {
    url: string;
    downloadedAt: string;
    lastModified: string | null;
    etag: string | null;
}

let feed: GtfsFeed | null = null;
let feedMeta: FeedMeta | null = null;
/** Networks by service date (a few days kept). */
const networks = new Map<string, TransitNetwork>();
const MAX_NETWORKS = 4;

function readMeta(): FeedMeta | null {
    try {
        return JSON.parse(fs.readFileSync(feedMetaFile(), 'utf-8')) as FeedMeta;
    } catch {
        return null;
    }
}

/**
 * Downloads the GTFS when it changed (conditional request). Returns true when
 * a new file was written.
 */
export async function downloadFeed(): Promise<boolean> {
    const previous = readMeta();
    const headers: Record<string, string> = {};
    if (previous?.url === config.gtfs.url && fs.existsSync(feedFile())) {
        if (previous.etag) headers['If-None-Match'] = previous.etag;
        if (previous.lastModified) headers['If-Modified-Since'] = previous.lastModified;
    }
    const response = await fetch(config.gtfs.url, { headers, redirect: 'follow', signal: AbortSignal.timeout(120_000) });
    if (response.status === 304) {
        log.info('GTFS unchanged');
        return false;
    }
    if (!response.ok) throw new Error(`GTFS download failed: HTTP ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    fs.mkdirSync(config.dataDir, { recursive: true });
    const tmp = `${feedFile()}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, feedFile());
    const meta: FeedMeta = {
        url: config.gtfs.url,
        downloadedAt: new Date().toISOString(),
        lastModified: response.headers.get('last-modified'),
        etag: response.headers.get('etag'),
    };
    fs.writeFileSync(feedMetaFile(), JSON.stringify(meta, null, 2));
    log.info(`GTFS downloaded (${(data.length / 1e6).toFixed(1)} MB)`);
    return true;
}

/** Parses the cached GTFS and serves it. */
export function loadFeedFromDisk(): boolean {
    if (!fs.existsSync(feedFile())) return false;
    const started = Date.now();
    setFeed(parseGtfsZip(new Uint8Array(fs.readFileSync(feedFile()))));
    feedMeta = readMeta();
    log.info(
        `GTFS ${feed!.feedInfo.version ?? ''} loaded: ${feed!.routes.size} routes, ${feed!.stops.size} stops, ` +
            `${feed!.trips.size} trips in ${Date.now() - started} ms`,
    );
    return true;
}

/**
 * Startup: use the cached GTFS when there is one, and download it otherwise
 * (or when `refresh` is set and a newer version exists).
 */
export async function initFeed(refresh = false): Promise<void> {
    const cached = fs.existsSync(feedFile());
    if (!cached || refresh) {
        try {
            const changed = await downloadFeed();
            if (changed || !feed) loadFeedFromDisk();
            return;
        } catch (error) {
            log.warn(`${(error as Error).message}${cached ? ', using the cached GTFS' : ''}`);
        }
    }
    if (!feed) loadFeedFromDisk();
}

export function setFeed(next: GtfsFeed | null): void {
    feed = next;
    networks.clear();
}

export function getFeed(): GtfsFeed | null {
    return feed;
}

export function getFeedMeta(): FeedMeta | null {
    return feedMeta;
}

const EMPTY_SOURCE = (date: string) => ({ serviceDate: date, stops: [], lines: [], shapes: new Map(), feedVersion: null });

/** Network of a service day (YYYY-MM-DD), today's by default. */
export function getNetwork(date: string = serviceDateNow(config.timezone).date): TransitNetwork {
    let network = networks.get(date);
    if (!network) {
        const started = Date.now();
        network = new TransitNetwork(feed ? sourceForDate(feed, date) : EMPTY_SOURCE(date));
        if (feed) {
            log.info(
                `Network of ${date}: ${network.lines.size} lines, ${network.tripCount} trips, ` +
                    `${network.patterns.length} patterns in ${Date.now() - started} ms`,
            );
        }
        networks.set(date, network);
        if (networks.size > MAX_NETWORKS) networks.delete(networks.keys().next().value!);
    }
    return network;
}

/** Validity of the feed, for date pickers. */
export function feedValidity(): { from: string | null; to: string | null } {
    const toIso = (d: string | null) => (d && /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : null);
    if (!feed) return { from: null, to: null };
    let from = feed.feedInfo.startDate;
    let to = feed.feedInfo.endDate;
    if (!from || !to) {
        for (const cal of feed.calendar.values()) {
            if (!from || cal.start < from) from = cal.start;
            if (!to || cal.end > to) to = cal.end;
        }
    }
    return { from: toIso(from), to: toIso(to) };
}
