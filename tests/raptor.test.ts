import { beforeAll, describe, expect, it } from 'vitest';
import type { RawLineFileV1 } from '../src/interfaces/BusData';
import { TransitNetwork } from '../src/network/network';
import { planJourneys, PlanRequest } from '../src/routing/planner';
import { raptor, RaptorQuery } from '../src/routing/raptor';
import { line, minutes, network, stop } from './helpers';

/*
 *  G ──3──────────── F          Line 1: A → B → C → D        (7:00, 7:20)
 *  │                 │          Line 2: C → E → F            (7:08, 7:12, 7:30)
 *  │                 E          Line 3: A → G → F, slow      (7:01)
 *  │                 │          Line 4: H → I, H is 100 m from D (7:15)
 *  A ──1── B ──1──── C ──1── D H ──4── I
 */
function buildNetwork(): TransitNetwork {
    return network([
        line('1', [
            stop('A', 0, 0, ['7:00', '7:20']),
            stop('B', 1, 0, ['7:03', '7:23']),
            stop('C', 2, 0, ['7:06', '7:26']),
            stop('D', 3, 0, ['7:09', '7:29']),
        ]),
        line('2', [
            stop('C', 2, 0, ['7:08', '7:12', '7:30']),
            stop('E', 2, 1, ['7:11', '7:15', '7:33']),
            stop('F', 2, 2, ['7:14', '7:18', '7:36']),
        ]),
        line('3', [stop('A', 0, 0, ['7:01']), stop('G', 0, 2, ['7:15']), stop('F', 2, 2, ['7:30'])]),
        line('4', [stop('H', 3.1, 0, ['7:15']), stop('I', 4, 0, ['7:20'])]),
    ]);
}

let net: TransitNetwork;
const at = (id: string) => net.getStop(id)!.index;
const query = (from: string, to: string, departure: string, extra: Partial<RaptorQuery> = {}): RaptorQuery => ({
    departure: minutes(departure),
    access: [{ stop: at(from), duration: 0, distance: 0 }],
    egress: [{ stop: at(to), duration: 0, distance: 0 }],
    maxTransfers: 2,
    ...extra,
});
const summary = (q: RaptorQuery) =>
    raptor(net, q).map(j => ({
        arrival: j.arrival,
        transfers: j.transfers,
        lines: j.legs.flatMap(l => (l.type === 'ride' ? [l.trip.line] : [])),
    }));

beforeAll(() => {
    net = buildNetwork();
});

describe('TransitNetwork', () => {
    it('indexes stops, lines and walking transfers', () => {
        expect(net.stops).toHaveLength(9);
        expect(net.getStop('C')!.lines).toEqual(['1', '2']);
        expect(net.footpaths[at('D')].map(f => net.stops[f.to].id)).toEqual(['H']);
        expect(net.footpaths[at('H')].map(f => net.stops[f.to].id)).toEqual(['D']);
        expect(net.footpaths[at('A')]).toEqual([]);
    });

    it('mirrors the missing direction of legacy files only', () => {
        expect(network([line('1', [stop('A', 0, 0, ['7:00']), stop('B', 1, 0, ['7:03'])])], true).getLine('1')!.directions).toHaveLength(1);
        const legacy: RawLineFileV1 = {
            bus_id: '1',
            lineName: 'Line 1',
            direction: 'OUTWARD',
            lineId: null,
            notes: [],
            stops: [stop('A', 0, 0, ['7:00']), stop('B', 1, 0, ['7:03'])],
        };
        const estimated = new TransitNetwork([legacy], { estimateMissingDirections: true });
        const inward = estimated.getLine('1')!.directions[1];
        expect(inward).toMatchObject({ direction: 'INWARD', estimated: true, headsign: 'A' });
        expect(inward.trips[0].stops.map(s => estimated.stops[s].id)).toEqual(['B', 'A']);
    });

    it('lists the next departures, excluding the terminus', () => {
        const departures = net.departures(at('C'), minutes('7:07'), 10);
        expect(departures.map(d => [d.trip.line, d.time])).toEqual([
            ['2', minutes('7:08')],
            ['2', minutes('7:12')],
            ['1', minutes('7:26')],
            ['2', minutes('7:30')],
        ]);
        expect(net.departures(at('D'), 0, 10)).toEqual([]);
    });

    it('searches stops without accents, prefix first', () => {
        const n = network([
            line('9', [stop('X', 0, 0, ['7:00']), stop('Y', 1, 0, ['7:05'])]),
        ]);
        n.stops[0].name = 'Place de la Liberté';
        n.stops[0].searchKey = 'place de la liberte';
        n.stops[1].name = 'Liberté';
        n.stops[1].searchKey = 'liberte';
        expect(n.searchStops('LIBERTE').map(s => s.name)).toEqual(['Liberté', 'Place de la Liberté']);
    });
});

describe('raptor', () => {
    it('finds a direct trip', () => {
        expect(summary(query('A', 'D', '6:50'))).toEqual([{ arrival: minutes('7:09'), transfers: 0, lines: ['1'] }]);
    });

    it('returns the Pareto set of arrival time and transfers', () => {
        expect(summary(query('A', 'F', '6:50'))).toEqual([
            { arrival: minutes('7:30'), transfers: 0, lines: ['3'] },
            { arrival: minutes('7:14'), transfers: 1, lines: ['1', '2'] },
        ]);
    });

    it('respects the minimum transfer time', () => {
        const result = summary(query('A', 'F', '6:50', { minTransferTime: 3 }));
        expect(result[1]).toEqual({ arrival: minutes('7:18'), transfers: 1, lines: ['1', '2'] });
    });

    it('respects maxTransfers and excluded lines', () => {
        expect(summary(query('A', 'F', '6:50', { maxTransfers: 0 }))).toEqual([
            { arrival: minutes('7:30'), transfers: 0, lines: ['3'] },
        ]);
        expect(summary(query('A', 'F', '6:50', { excludedLines: new Set(['3']) }))).toEqual([
            { arrival: minutes('7:14'), transfers: 1, lines: ['1', '2'] },
        ]);
    });

    it('walks between nearby stops to transfer', () => {
        const [journey] = raptor(net, query('A', 'I', '6:50'));
        expect(journey.legs.map(l => l.type)).toEqual(['access', 'ride', 'transfer', 'ride', 'egress']);
        const transfer = journey.legs[2];
        expect(transfer).toMatchObject({ type: 'transfer', from: at('D'), to: at('H'), departure: minutes('7:09') });
        expect(journey.arrival).toBe(minutes('7:20'));
    });

    it('waits for the next trip and gives up after the last one', () => {
        expect(summary(query('A', 'D', '7:01'))[0].arrival).toBe(minutes('7:29'));
        expect(summary(query('A', 'D', '7:21'))).toEqual([]);
    });

    it('leaves the origin just in time for the first vehicle', () => {
        const [journey] = raptor(net, {
            ...query('A', 'D', '6:30'),
            access: [{ stop: at('A'), duration: 5, distance: 400 }],
        });
        expect(journey.departure).toBe(minutes('6:55'));
        expect(journey.legs[0]).toMatchObject({ type: 'access', departure: minutes('6:55'), arrival: minutes('7:00') });
    });
});

describe('planJourneys', () => {
    const request = (overrides: Partial<PlanRequest>): PlanRequest => ({
        from: { stopId: 'A' },
        to: { stopId: 'F' },
        departure: minutes('6:50'),
        maxWalkingDistance: 800,
        maxTransfers: 2,
        excludedLines: [],
        maxResults: 5,
        includeGeometry: false,
        ...overrides,
    });

    it('builds itineraries with steps and formatted times', async () => {
        const result = await planJourneys(net, request({}));
        expect(result.routes.map(r => [r.departureTime, r.arrivalTime, r.transfers])).toEqual([
            ['07:00', '07:14', 1],
            ['07:01', '07:30', 0],
            ['07:20', '07:36', 1],
        ]);
        const [best] = result.routes;
        expect(best.steps.map(s => s.type)).toEqual(['bus', 'bus']);
        const first = best.steps[0];
        expect(first).toMatchObject({
            type: 'bus',
            line: '1',
            headsign: 'D',
            departureTime: '07:00',
            arrivalTime: '07:06',
            stopsCount: 2,
            estimated: false,
        });
        expect(first.type === 'bus' && first.intermediateStops.map(s => [s.name, s.time])).toEqual([['B', '07:03']]);
    });

    it('walks to and from coordinates', async () => {
        const f = net.getStop('F')!;
        const result = await planJourneys(net, request({ to: { lat: f.lat + 0.002, lon: f.lon, name: 'Maison' } }));
        const [best] = result.routes;
        expect(best.steps.map(s => s.type)).toEqual(['bus', 'bus', 'walk']);
        expect(best.steps[2]).toMatchObject({ type: 'walk', departureTime: '07:14', to: { name: 'Maison' } });
        expect(best.walkingDistance).toBeGreaterThan(200);
    });

    it('suggests walking when it is the best option', async () => {
        const b = net.getStop('B')!;
        const result = await planJourneys(net, request({ to: { stopId: 'B' }, departure: minutes('7:04') }));
        expect(result.routes[0].steps.map(s => s.type)).toEqual(['walk']);
        expect(result.routes[0].steps[0].to).toMatchObject({ stopId: b.id });
    });

    it('explains why nothing was found', async () => {
        const same = await planJourneys(net, request({ to: { stopId: 'A' } }));
        expect(same.routes).toEqual([]);
        expect(same.warnings[0]).toMatch(/identiques/);

        const far = await planJourneys(net, request({ to: { lat: 44, lon: 6 } }));
        expect(far.routes).toEqual([]);
        expect(far.warnings[0]).toMatch(/Aucun arrêt/);
    });

    it('rejects unknown stops', async () => {
        await expect(planJourneys(net, request({ from: { stopId: 'NOPE' } }))).rejects.toMatchObject({ status: 404 });
    });
});
