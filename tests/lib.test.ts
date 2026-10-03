import { describe, expect, it } from 'vitest';
import { estimateWalk, haversine } from '../src/lib/geo';
import { normalizeText } from '../src/lib/text';
import { formatTime, nowInTimezone, parseTime } from '../src/lib/time';

describe('time', () => {
    it('parses H:MM and HH:MM', () => {
        expect(parseTime('6:45')).toBe(405);
        expect(parseTime('23:59')).toBe(1439);
        expect(parseTime('24:15')).toBe(1455);
    });

    it('rejects invalid values', () => {
        for (const value of ['', null, undefined, '-', '7h30', '12:60', '- - -']) {
            expect(parseTime(value)).toBeNull();
        }
    });

    it('formats and wraps past midnight', () => {
        expect(formatTime(405)).toBe('06:45');
        expect(formatTime(1455)).toBe('00:15');
        expect(formatTime(-10)).toBe('23:50');
    });

    it('reads the time of day in a time zone', () => {
        const date = new Date('2026-07-01T10:30:00Z');
        expect(nowInTimezone('Europe/Paris', date)).toBe(12 * 60 + 30); // UTC+2 in summer
        expect(nowInTimezone('UTC', date)).toBe(10 * 60 + 30);
    });
});

describe('geo', () => {
    it('computes great-circle distances', () => {
        // Two stops of Toulon city centre, ≈ 350 m apart
        const d = haversine(43.12544, 5.93009, 43.12855, 5.92939);
        expect(d).toBeGreaterThan(300);
        expect(d).toBeLessThan(400);
        expect(haversine(43, 5, 43, 5)).toBe(0);
    });

    it('estimates walks with a detour factor and at least one minute', () => {
        expect(estimateWalk(43, 5, 43, 5)).toEqual({ distance: 0, duration: 1 });
        const walk = estimateWalk(43.1, 5.9, 43.1 + 1 / 111, 5.9); // ~1 km
        expect(walk.distance).toBeGreaterThan(1250);
        expect(walk.duration).toBe(Math.ceil(walk.distance / 80));
    });
});

describe('normalizeText', () => {
    it('removes accents and punctuation', () => {
        expect(normalizeText("Hôtel de Ville (Hyères)")).toBe('hotel de ville hyeres');
        expect(normalizeText('  Liberté ')).toBe('liberte');
    });
});
