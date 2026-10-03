import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { config } from '../src/config';
import { setFeed } from '../src/network/network.store';
import { fixtureFeed } from './helpers';

const app = createApp();
const MONDAY = '2026-10-05';

beforeAll(() => {
    setFeed(fixtureFeed());
});

describe('API', () => {
    it('reports health', async () => {
        const res = await request(app).get('/api/health').expect(200);
        expect(res.body).toMatchObject({ status: expect.any(String), data: { stops: 5 } });
    });

    it('lists, searches and locates stops (compressed, cacheable)', async () => {
        const all = await request(app).get('/api/stops').set('Accept-Encoding', 'gzip').expect(200);
        expect(all.headers['cache-control']).toContain('max-age');
        expect(all.headers.etag).toBeTruthy();
        expect(all.body).toHaveLength(5);

        const again = await request(app).get('/api/stops').set('If-None-Match', all.headers.etag);
        expect(again.status).toBe(304);

        const search = await request(app).get('/api/stops/search').query({ q: 'bravo' }).expect(200);
        expect(search.body.map((s: { stopPointId: string }) => s.stopPointId)).toEqual(['TOBRAV', 'TOBRAW']);

        const nearby = await request(app).get('/api/stops/nearby').query({ lat: 43.1, lon: 5.9, radius: 100 }).expect(200);
        expect(nearby.body[0]).toMatchObject({ stopPointId: 'TOALPH', distance: 0 });
        await request(app).get('/api/stops/nearby').query({ lat: 'x', lon: 5 }).expect(400);
    });

    it('lists the departures of a stop and its siblings', async () => {
        const res = await request(app).get('/api/stops/TOBRAV/departures').query({ date: MONDAY, time: '08:00' }).expect(200);
        expect(res.body.departures.map((d: { line: string; time: string }) => `${d.line} ${d.time}`)).toEqual([
            '1 08:04',
            '8M 08:10',
            '1 08:25',
            '1 08:34',
            '1 24:09'.replace('24:09', '00:09'),
        ]);
        expect(res.body.departures[1]).toMatchObject({ mode: 'boat', realtime: null, cancelled: false, stopPointId: 'TOBRAW' });
        await request(app).get('/api/stops/NOPE/departures').expect(404);
        await request(app).get('/api/stops/TOBRAV/departures').query({ date: '2027-01-01' }).expect(400);
    });

    it('describes lines and their shapes', async () => {
        const lines = await request(app).get('/api/lines').query({ date: MONDAY }).expect(200);
        expect(lines.body.map((l: { bus_id: string; mode: string }) => `${l.bus_id}:${l.mode}`)).toEqual(['1:bus', '8M:boat']);

        const line = await request(app).get('/api/lines/1').query({ date: MONDAY }).expect(200);
        expect(line.body.directions[0].stops.map((s: { name: string }) => s.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);

        const shape = await request(app).get('/api/lines/1/shape').query({ date: MONDAY }).expect(200);
        expect(shape.body.directions[0].coordinates).toHaveLength(5);
        expect(shape.body.directions[1].coordinates).toHaveLength(3); // no shape: through the stops

        await request(app).get('/api/lines/999').expect(404);
    });

    it('plans itineraries across modes, on the official shapes', async () => {
        const res = await request(app)
            .post('/api/routes/calculate')
            .send({ from: { stopId: 'TOALPH' }, to: { stopId: 'SEECHO' }, date: MONDAY, departureTime: '07:55' })
            .expect(200);
        expect(res.headers['server-timing']).toMatch(/route;dur=/);
        const [best] = res.body.data.routes;
        // The boat leaves from the other stop point of Bravo, across the street.
        expect(best.steps.map((s: { type: string; line?: string }) => s.line ?? s.type)).toEqual(['1', 'walk', '8M']);
        expect(best.steps[0]).toMatchObject({ departureTime: '08:00', arrivalTime: '08:04', mode: 'bus', textColor: '#ffffff' });
        expect(best.steps[0].geometry).toHaveLength(4); // shape points between Alpha and Bravo
        expect(res.body.data).toMatchObject({ serviceDate: MONDAY, alerts: [] });
    });

    it('arrives on time and respects accessibility', async () => {
        const arrive = await request(app)
            .post('/api/routes/calculate')
            .send({ from: { stopId: 'TOALPH' }, to: { stopId: 'SECHAR' }, date: MONDAY, arrivalTime: '08:40' })
            .expect(200);
        expect(arrive.body.data.routes[0]).toMatchObject({ departureTime: '08:30', arrivalTime: '08:39' });

        const accessible = await request(app)
            .post('/api/routes/calculate')
            .send({ from: { stopId: 'TOALPH' }, to: { stopId: 'SECHAR' }, date: MONDAY, departureTime: '07:55', wheelchair: true })
            .expect(200);
        // Charlie is not accessible: no bus can drop there, only the walk is left.
        expect(accessible.body.data.routes.every((r: { steps: { type: string }[] }) => r.steps.every(s => s.type === 'walk'))).toBe(true);
    });

    it('validates itinerary requests', async () => {
        const post = (body: unknown) => request(app).post('/api/routes/calculate').send(body as object);
        expect((await post({}).expect(400)).body).toEqual({ success: false, message: "'from' is required." });
        await post({ from: { lat: 43 }, to: { stopId: 'TOALPH' } }).expect(400);
        await post({ from: { stopId: 'NOPE' }, to: { stopId: 'TOALPH' } }).expect(404);
        await post({ from: { stopId: 'TOALPH' }, to: { stopId: 'SECHAR' }, departureTime: '08:00', arrivalTime: '09:00' }).expect(400);
        await post({ from: { stopId: 'TOALPH' }, to: { stopId: 'SECHAR' }, date: '05/10/2026' }).expect(400);
        await request(app).post('/api/routes/calculate').set('content-type', 'application/json').send('{oops').expect(400);
    });

    it('computes isochrones', async () => {
        const res = await request(app).get('/api/isochrone').query({ stopId: 'TOALPH', date: MONDAY, time: '07:55', maxDuration: 30 }).expect(200);
        const byId = Object.fromEntries(res.body.stops.map((s: { stopPointId: string; duration: number }) => [s.stopPointId, s.duration]));
        expect(byId).toMatchObject({ TOALPH: 0, TOBRAV: 9, SECHAR: 14 });
        await request(app).get('/api/isochrone').expect(400);
    });

    it('answers the real-time endpoints even when disabled', async () => {
        const vehicles = await request(app).get('/api/realtime/vehicles').expect(200);
        expect(vehicles.body).toMatchObject({ count: 0, vehicles: [] });
        const alerts = await request(app).get('/api/realtime/alerts').expect(200);
        expect(alerts.body).toEqual({ alerts: [] });
        await request(app).get('/api/realtime/vehicles').query({ bbox: '1,2,3' }).expect(400);
    });

    it('protects the refresh endpoint and reports the data status', async () => {
        const previous = config.adminToken;
        try {
            (config as { adminToken: string }).adminToken = '';
            await request(app).post('/api/data/refresh').expect(403);
            (config as { adminToken: string }).adminToken = 'secret';
            await request(app).post('/api/data/refresh').set('authorization', 'Bearer wrong!').expect(401);
        } finally {
            (config as { adminToken: string }).adminToken = previous;
        }
        const status = await request(app).get('/api/data/status').expect(200);
        expect(status.body.data.source).toMatchObject({ version: 'test-1', validity: { from: '2026-10-01', to: '2026-11-30' } });
    });

    it('serves the OpenAPI document and JSON 404s', async () => {
        const spec = await request(app).get('/api/openapi.json').expect(200);
        expect(spec.body.openapi).toMatch(/^3\./);
        await request(app).get('/api/docs').expect(301);
        expect((await request(app).get('/api/nope').expect(404)).body.success).toBe(false);
    });
});
