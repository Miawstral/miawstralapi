import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { TransitNetwork } from '../src/network/network';
import {
    mistralCode,
    parseTimetable,
    referenceServiceDate,
    scrapeLine,
    ScrapeError,
    timetableUrl,
} from '../src/scraper/mistral.scraper';

const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'timetable.html'), 'utf-8');

describe('mistral scraper', () => {
    it('formats line codes', () => {
        expect(mistralCode('1')).toBe('0001');
        expect(mistralCode('10')).toBe('0010');
        expect(mistralCode('100')).toBe('0100');
        expect(mistralCode('u')).toBe('U');
    });

    it('builds timetable URLs for both directions and a given day', () => {
        // The site calls the second direction RETURN.
        expect(timetableUrl('87', 'INWARD', '2026-10-05')).toBe(
            'https://sim.112.prod.instant-system.com/fr/horaires/Reseau-Mistral/Bus/ligne/87/direction/RETURN/MISTRAL:0087' +
                '?islid=MISTRAL%3A0087&ismode=Bus&islsn=87&issubnet=Reseau%20Mistral&isdir=RETURN&w=true&date=2026-10-05',
        );
        expect(timetableUrl('U', 'OUTWARD')).toMatch(/\/ligne\/U\/direction\/OUTWARD\/MISTRAL:U\?islid=MISTRAL%3AU&.*isdir=OUTWARD/);
    });

    it('scrapes the next working day by default', () => {
        // Saturday 3 October 2026 → Monday 5 October
        expect(referenceServiceDate(new Date('2026-10-03T13:00:00Z'), '')).toBe('2026-10-05');
        expect(referenceServiceDate(new Date('2026-10-05T13:00:00Z'), '')).toBe('2026-10-05');
        // Wednesday 11 November (Armistice) → Thursday 12
        expect(referenceServiceDate(new Date('2026-11-11T08:00:00Z'), '')).toBe('2026-11-12');
        expect(referenceServiceDate(new Date(), '2026-12-01')).toBe('2026-12-01');
    });

    it('keeps trip columns aligned with null for skipped stops', () => {
        const parsed = parseTimetable(html);
        expect(parsed).toMatchObject({ lineName: 'Seyne Centre - Le Brusc', direction: 'OUTWARD', lineId: 'MISTRAL:0087' });
        expect(parsed.notes).toEqual(['Ne circule pas les jours fériés']);
        expect(parsed.stops.map(s => [s.stopPointId, s.times])).toEqual([
            ['MISTRAL:SECENN', ['6:45', '7:10', '8:00']],
            ['MISTRAL:SELBAO', ['6:46', null, '8:01']],
            ['MISTRAL:SELBEO', ['6:48', '7:12', null]],
        ]);
        expect(parsed.stops[0]).toMatchObject({ city: 'La Seyne-sur-Mer', accessible: true, latitude: '43.10121' });
        expect(parsed.stops[1].accessible).toBe(false);
    });

    it('detects Cloudflare and missing timetables', () => {
        expect(() => parseTimetable('<title>Attention Required! | Cloudflare</title>')).toThrow(/Cloudflare/);
        try {
            parseTimetable('<div class="is-Result-Error-Description">Ligne inconnue</div>');
            expect.unreachable();
        } catch (error) {
            expect(error).toBeInstanceOf(ScrapeError);
            expect((error as ScrapeError).message).toBe('Ligne inconnue');
            expect((error as ScrapeError).retryable).toBe(false);
        }
    });

    it('scrapes both directions', async () => {
        const urls: string[] = [];
        const line = await scrapeLine(
            '87',
            async url => {
                urls.push(url);
                return url.includes('RETURN') ? html.replace('data-direction-id="OUTWARD"', 'data-direction-id="RETURN"') : html;
            },
            '2026-10-05',
        );
        expect(urls.every(u => u.endsWith('date=2026-10-05'))).toBe(true);
        expect(line).toMatchObject({ version: 2, bus_id: '87', serviceDate: '2026-10-05' });
        expect(line.directions.map(d => d.direction)).toEqual(['OUTWARD', 'INWARD']);
    });

    it('does not store a direction the site does not have', async () => {
        // A loop line answers the RETURN request with its only (OUTWARD) timetable.
        const line = await scrapeLine('87', async () => html);
        expect(line).toMatchObject({ version: 2, bus_id: '87', lineName: 'Seyne Centre - Le Brusc' });
        expect(line.directions.map(d => d.direction)).toEqual(['OUTWARD']);

        // The scraped file is directly usable by the network, trips intact.
        const network = new TransitNetwork([line], { estimateMissingDirections: false });
        expect(network.getLine('87')!.directions[0].trips.map(t => t.stops.length)).toEqual([3, 2, 2]);
    });

    it('does not ask for the other direction of an unknown line', async () => {
        let calls = 0;
        const error = '<div class="is-Result-Error-Description">Ligne inconnue</div>';
        await expect(scrapeLine('299', async () => (calls++, error))).rejects.toThrow('Ligne inconnue');
        expect(calls).toBe(1);
    });

    it('fails the whole line on a transient error', async () => {
        await expect(
            scrapeLine('87', async url => {
                if (url.includes('RETURN')) throw new ScrapeError('timeout');
                return html;
            }),
        ).rejects.toThrow('timeout');
    });
});

describe('automatic refresh', () => {
    it('refreshes missing, legacy or old data', async () => {
        const { staleReason } = await import('../src/scraper/refresh.service');
        const { line, network, stop } = await import('./helpers');
        const day = 24 * 3_600_000;
        const fresh = network([line('1', [stop('A', 0, 0, ['7:00']), stop('B', 1, 0, ['7:03'])])]);
        const cachedAt = Date.parse('2026-01-01T00:00:00.000Z');

        expect(staleReason(network([]), day)).toBe('no timetable');
        expect(staleReason(fresh, day, cachedAt + day / 2)).toBeNull();
        expect(staleReason(fresh, day, cachedAt + 2 * day)).toMatch(/older/);
        const legacy = new TransitNetwork(
            [{ bus_id: '1', lineName: null, direction: 'OUTWARD', lineId: null, notes: [], stops: [stop('A', 0, 0, ['7:00']), stop('B', 1, 0, ['7:03'])] }],
            {},
        );
        expect(staleReason(legacy, day, cachedAt)).toBe('legacy data format');

        const { staleLines } = await import('../src/scraper/refresh.service');
        const mixed = new TransitNetwork(
            [
                line('1', [stop('A', 0, 0, ['7:00']), stop('B', 1, 0, ['7:03'])]),
                { bus_id: '2', lineName: null, direction: 'OUTWARD', lineId: null, notes: [], stops: [stop('C', 0, 1, ['7:00']), stop('D', 1, 1, ['7:03'])] },
            ],
            {},
        );
        expect(staleLines(mixed, day, cachedAt + day / 2)).toEqual(['2']);
    });
});
