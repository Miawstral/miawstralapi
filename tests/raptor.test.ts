import { beforeAll, describe, expect, it } from 'vitest';
import type { TransitNetwork } from '../src/network/network';
import { planJourneys, PlanRequest } from '../src/routing/planner';
import { raptor, RaptorQuery, reachability } from '../src/routing/raptor';
import { line, minutes, network, stop, trip } from './helpers';

/*
 *  G ──3──────────── F          Line 1: A → B → C → D        (7:00, 7:20)
 *  │                 │          Line 2: C → E → F            (7:08, 7:12, 7:30)
 *  │                 E          Line 3: A → G → F, slow      (7:01)
 *  │                 │          Line 4: H → I, H is 100 m from D (7:15)
 *  A ──1── B ──1──── C ──1── D H ──4── I
 */
function buildNetwork(): TransitNetwork {
    const stops = [stop('A', 0, 0), stop('B', 1, 0), stop('C', 2, 0), stop('D', 3, 0), stop('E', 2, 1), stop('F', 2, 2), stop('G', 0, 2), stop('H', 3.1, 0), stop('I', 4, 0)];
    return network(stops, [
        line('1', [trip('1a', ['A', 'B', 'C', 'D'], ['7:00', '7:03', '7:06', '7:09']), trip('1b', ['A', 'B', 'C', 'D'], ['7:20', '7:23', '7:26', '7:29'])]),
        line('2', [
            trip('2a', ['C', 'E', 'F'], ['7:08', '7:11', '7:14']),
            trip('2b', ['C', 'E', 'F'], ['7:12', '7:15', '7:18']),
            trip('2c', ['C', 'E', 'F'], ['7:30', '7:33', '7:36']),
        ]),
        line('3', [trip('3a', ['A', 'G', 'F'], ['7:01', '7:15', '7:30'])]),
        line('4', [trip('4a', ['H', 'I'], ['7:15', '7:20'])]),
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

    it('groups trips by line and direction', () => {
        const two = net.getLine('2')!;
        expect(two.directions.map(d => [d.direction, d.headsign, d.trips.length])).toEqual([['OUTWARD', 'F', 3]]);
        expect(net.patterns.filter(p => p.line === '2')).toHaveLength(1);
        expect(net.trips.get('2b')!.times).toEqual([minutes('7:12'), minutes('7:15'), minutes('7:18')]);
    });

    it('accepts the stop ids of the 1.x API', () => {
        expect(net.getStop('MISTRAL:A')?.id).toBe('A');
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
        const n = network([{ ...stop('X', 0, 0), name: 'Place de la Liberté' }, { ...stop('Y', 1, 0), name: 'Liberté' }], [
            line('9', [trip('9a', ['X', 'Y'], ['7:00', '7:05'])]),
        ]);
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

    it('boards and alights only at accessible stops when asked to', () => {
        const n = network([stop('A', 0, 0), stop('B', 1, 0, false), stop('C', 2, 0)], [
            line('1', [trip('1a', ['A', 'B', 'C'], ['7:00', '7:05', '7:10'])]),
        ]);
        const at = (id: string) => n.getStop(id)!.index;
        const q = (to: string) => ({ departure: minutes('6:50'), access: [{ stop: at('A'), duration: 0, distance: 0 }], egress: [{ stop: at(to), duration: 0, distance: 0 }], maxTransfers: 0, accessibleOnly: true });
        expect(raptor(n, q('C'))).toHaveLength(1); // rides through B
        expect(raptor(n, q('B'))).toHaveLength(0);
    });

    it('computes the earliest arrival everywhere', () => {
        const reach = reachability(net, { departure: minutes('6:50'), access: [{ stop: at('A'), duration: 0, distance: 0 }], maxTransfers: 2 });
        expect(reach.arrival[at('F')]).toBe(minutes('7:14'));
        expect(reach.rides[at('F')]).toBe(2);
        expect(reach.arrival[at('A')]).toBe(minutes('6:50'));
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
            cancelled: false,
            realtime: null,
        });
        expect(first.type === 'bus' && first.intermediateStops.map(s => [s.name, s.time])).toEqual([['B', '07:03']]);
    });

    it('arrives before a time, latest departures first', async () => {
        const result = await planJourneys(net, request({ arriveBy: minutes('7:35') }));
        expect(result.arrivalTime).toBe('07:35');
        expect(result.routes.map(r => [r.departureTime, r.arrivalTime])).toEqual([
            ['07:01', '07:30'],
            ['07:00', '07:14'],
        ]);
        expect(result.routes.every(r => r.arrivalTime <= '07:35')).toBe(true);
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
