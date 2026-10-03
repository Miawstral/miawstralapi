import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { config } from '../src/config';
import { getNetwork } from '../src/network/network.store';

const app = createApp();

beforeAll(() => {
    getNetwork(); // load the shipped data once
});

describe('API', () => {
    it('reports health', async () => {
        const res = await request(app).get('/api/health').expect(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.data.lines).toBeGreaterThanOrEqual(40);
    });

    it('lists, searches and locates stops', async () => {
        const all = await request(app).get('/api/stops').expect(200);
        expect(all.body.length).toBeGreaterThan(1000);
        expect(all.body[0]).toHaveProperty('stopPointId');

        const search = await request(app).get('/api/stops/search').query({ q: 'liberte', limit: 3 }).expect(200);
        expect(search.body.map((s: { name: string }) => s.name)).toEqual(['Liberté', 'Liberté', 'Liberté']);

        const nearby = await request(app).get('/api/stops/nearby').query({ lat: 43.10121, lon: 5.8834, radius: 200 }).expect(200);
        expect(nearby.body[0]).toMatchObject({ stopPointId: 'MISTRAL:SECENN', distance: 0 });

        await request(app).get('/api/stops/search').expect(400);
        await request(app).get('/api/stops/nearby').query({ lat: 'x', lon: 5 }).expect(400);
    });

    it('describes a stop and its next departures', async () => {
        const stop = await request(app).get('/api/stops/MISTRAL:SECENN').expect(200);
        expect(stop.body.passingLines.map((l: { bus_id: string }) => l.bus_id)).toContain('87');

        const departures = await request(app)
            .get('/api/stops/MISTRAL:SECENN/departures')
            .query({ time: '07:59', limit: 3 })
            .expect(200);
        expect(departures.body.departures[0]).toMatchObject({ line: '87', time: '08:00', headsign: 'Le Brusc', estimated: false });

        await request(app).get('/api/stops/NOPE').expect(404);
        await request(app).get('/api/stops/MISTRAL:SECENN/departures').query({ time: '8h' }).expect(400);
    });

    it('lists and describes lines', async () => {
        const lines = await request(app).get('/api/lines').expect(200);
        expect(lines.body[0]).toMatchObject({ bus_id: '1' });

        const line = await request(app).get('/api/lines/87').expect(200);
        expect(line.body.lineName).toBe('Seyne Centre - Le Brusc');
        expect(line.body.directions[0].stops[0]).toMatchObject({ name: 'Seyne Centre' });

        const search = await request(app).get('/api/lines/search').query({ q: 'brusc' }).expect(200);
        expect(search.body.map((l: { bus_id: string }) => l.bus_id)).toEqual(['87']);

        await request(app).get('/api/lines/999').expect(404);
    });

    it('calculates itineraries', async () => {
        const res = await request(app)
            .post('/api/routes/calculate')
            .send({ from: { stopId: 'MISTRAL:SECENN' }, to: { stopId: 'MISTRAL:SELBEO' }, departureTime: '08:00' })
            .expect(200);
        expect(res.body.success).toBe(true);
        const [best] = res.body.data.routes;
        expect(best).toMatchObject({ departureTime: '08:00', arrivalTime: '08:02', transfers: 0 });
        expect(best.steps[0]).toMatchObject({ type: 'bus', line: '87', departureTime: '08:00', arrivalTime: '08:02' });
    });

    it('treats stop points of the same name as one place', async () => {
        // SECENS and SECENN are both "Seyne Centre", on each side of the street; the 87 leaves from SECENN.
        const res = await request(app)
            .post('/api/routes/calculate')
            .send({ from: { stopId: 'MISTRAL:SECENS' }, to: { stopId: 'MISTRAL:SELBEO' }, departureTime: '08:00' })
            .expect(200);
        expect(res.body.data.routes[0]).toMatchObject({ departureTime: '08:00', arrivalTime: '08:02' });
        expect(res.body.data.routes[0].steps.map((s: { type: string }) => s.type)).toEqual(['bus']);
    });

    it('validates itinerary requests', async () => {
        const post = (body: unknown) => request(app).post('/api/routes/calculate').send(body as object);
        expect((await post({}).expect(400)).body).toEqual({ success: false, message: "'from' is required." });
        await post({ from: { lat: 43 }, to: { stopId: 'MISTRAL:SECENN' } }).expect(400);
        await post({ from: { stopId: 'NOPE' }, to: { stopId: 'MISTRAL:SECENN' } }).expect(404);
        await post({ from: { stopId: 'MISTRAL:SECENN' }, to: { stopId: 'MISTRAL:SELBEO' }, maxTransfers: 12 }).expect(400);
        await post({ from: { stopId: 'MISTRAL:SECENN' }, to: { stopId: 'MISTRAL:SELBEO' }, departureTime: '24:00' }).expect(400);
        await request(app).post('/api/routes/calculate').set('content-type', 'application/json').send('{oops').expect(400);
    });

    it('protects the refresh endpoints', async () => {
        const previous = config.adminToken;
        try {
            (config as { adminToken: string }).adminToken = '';
            await request(app).post('/api/data/refresh').expect(403);
            await request(app).post('/refresh/full').expect(403);

            (config as { adminToken: string }).adminToken = 'secret';
            await request(app).post('/api/data/refresh').expect(401);
            await request(app).post('/api/data/refresh').set('authorization', 'Bearer wrong!').expect(401);
        } finally {
            (config as { adminToken: string }).adminToken = previous;
        }
        const status = await request(app).get('/api/data/status').expect(200);
        expect(status.body.data.refresh.running).toBe(false);
    });

    it('stops a refresh early when FlareSolverr is unreachable', async () => {
        const mutable = config as unknown as { adminToken: string; dataDir: string; scraper: { flaresolverrUrl: string } };
        const saved = { adminToken: mutable.adminToken, dataDir: mutable.dataDir, url: mutable.scraper.flaresolverrUrl };
        try {
            mutable.adminToken = 'secret';
            mutable.dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'miawstral-')); // never touch data/
            mutable.scraper.flaresolverrUrl = 'http://127.0.0.1:65530/v1'; // nothing listens there
            const res = await request(app)
                .post('/api/data/refresh')
                .query({ lines: '87', wait: 'true' })
                .set('authorization', 'Bearer secret')
                .expect(200);
            expect(res.body.data.successLines).toEqual([]);
            expect(res.body.data.aborted).toMatch(/FlareSolverr unreachable/);
            expect(fs.readdirSync(mutable.dataDir)).toEqual([]);
        } finally {
            fs.rmSync(mutable.dataDir, { recursive: true, force: true });
            mutable.adminToken = saved.adminToken;
            mutable.dataDir = saved.dataDir;
            mutable.scraper.flaresolverrUrl = saved.url;
        }
    });

    it('serves the API documentation and JSON 404s', async () => {
        const spec = await request(app).get('/api/openapi.json').expect(200);
        expect(spec.body.openapi).toBe('3.0.3');
        expect((await request(app).get('/api/nope').expect(404)).body.success).toBe(false);
    });
});
