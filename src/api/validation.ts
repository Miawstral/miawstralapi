import { badRequest } from '../lib/http-error';
import { parseTime } from '../lib/time';

/** Helpers to read and validate query parameters and JSON bodies. */

interface NumberOptions {
    min?: number;
    max?: number;
    integer?: boolean;
}

function toNumber(value: unknown): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') return Number(value);
    return undefined;
}

export function optionalNumber(value: unknown, name: string, options: NumberOptions = {}): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const n = toNumber(value);
    if (n === undefined || !Number.isFinite(n)) throw badRequest(`'${name}' must be a number`);
    if (options.integer && !Number.isInteger(n)) throw badRequest(`'${name}' must be an integer`);
    if (options.min !== undefined && n < options.min) throw badRequest(`'${name}' must be ≥ ${options.min}`);
    if (options.max !== undefined && n > options.max) throw badRequest(`'${name}' must be ≤ ${options.max}`);
    return n;
}

export function requiredNumber(value: unknown, name: string, options: NumberOptions = {}): number {
    const n = optionalNumber(value, name, options);
    if (n === undefined) throw badRequest(`'${name}' is required`);
    return n;
}

export function requiredString(value: unknown, name: string): string {
    if (typeof value !== 'string' || value.trim() === '') throw badRequest(`Query parameter '${name}' is required.`);
    return value.trim();
}

/** "HH:MM" → minutes since midnight. */
export function optionalTime(value: unknown, name: string): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const minutes = typeof value === 'string' ? parseTime(value) : null;
    if (minutes === null || minutes >= 24 * 60) throw badRequest(`'${name}' must be a time formatted HH:MM`);
    return minutes;
}

export function optionalBoolean(value: unknown, name: string): boolean | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    throw badRequest(`'${name}' must be a boolean`);
}

/** Array of strings, or a comma separated string. */
export function optionalStringList(value: unknown, name: string): string[] | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const list = typeof value === 'string' ? value.split(',') : value;
    if (!Array.isArray(list) || !list.every(v => typeof v === 'string' || typeof v === 'number')) {
        throw badRequest(`'${name}' must be a list of strings`);
    }
    return list.map(v => String(v).trim()).filter(Boolean);
}
