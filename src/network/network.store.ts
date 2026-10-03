import fs from 'fs';
import path from 'path';
import { config } from '../config';
import type { RawLineFile } from '../interfaces/BusData';
import { createLogger } from '../lib/logger';
import { TransitNetwork } from './network';

const log = createLogger('network');

export const LINE_FILE_SUFFIX = '_horaires.json';

export function lineFilePath(busId: string, dataDir = config.dataDir): string {
    return path.join(dataDir, `${busId}${LINE_FILE_SUFFIX}`);
}

function isLineFile(value: unknown): value is RawLineFile {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return typeof v.bus_id === 'string' && (Array.isArray(v.stops) || Array.isArray(v.directions));
}

/** Reads every timetable file of the data directory. Invalid files are skipped and reported. */
export function readLineFiles(dataDir = config.dataDir): { files: RawLineFile[]; errors: string[] } {
    const files: RawLineFile[] = [];
    const errors: string[] = [];
    if (!fs.existsSync(dataDir)) {
        errors.push(`Data directory not found: ${dataDir}`);
        return { files, errors };
    }
    for (const name of fs.readdirSync(dataDir).filter(f => f.endsWith(LINE_FILE_SUFFIX)).sort()) {
        try {
            const parsed: unknown = JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf-8'));
            if (isLineFile(parsed)) files.push(parsed);
            else errors.push(`${name}: not a timetable file`);
        } catch (error) {
            errors.push(`${name}: ${(error as Error).message}`);
        }
    }
    return { files, errors };
}

export function buildNetwork(dataDir = config.dataDir): TransitNetwork {
    const started = Date.now();
    const { files, errors } = readLineFiles(dataDir);
    errors.forEach(e => log.warn(e));

    const network = new TransitNetwork(files, { estimateMissingDirections: config.estimateMissingDirections });
    network.warnings.forEach(w => log.debug(w));
    log.info(
        `Loaded ${network.lines.size} lines, ${network.stops.length} stops, ${network.tripCount} trips, ` +
            `${network.patterns.length} patterns in ${Date.now() - started} ms`,
    );
    return network;
}

let current: TransitNetwork | null = null;

/** The network currently served (built on first use). */
export function getNetwork(): TransitNetwork {
    if (!current) current = buildNetwork();
    return current;
}

/** Rebuilds the network from disk, e.g. after a data refresh. Requests in flight keep the old instance. */
export function reloadNetwork(): TransitNetwork {
    current = buildNetwork();
    return current;
}

/** Replaces the served network (tests). */
export function setNetwork(network: TransitNetwork | null): void {
    current = network;
}
