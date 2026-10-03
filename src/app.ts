import compression from 'compression';
import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import dataRouter from './api/data/data.routes';
import isochroneRouter from './api/isochrone/isochrone.routes';
import linesRouter from './api/lines/lines.routes';
import { openApiDocument } from './api/openapi';
import { rateLimit } from './api/rate-limit';
import realtimeRouter from './api/realtime/realtime.routes';
import routesRouter from './api/routes/routes.routes';
import stopsRouter from './api/stops/stops.routes';
import { config } from './config';
import { HttpError } from './lib/http-error';
import { createLogger } from './lib/logger';
import { getNetwork } from './network/network.store';

const log = createLogger('http');

export function createApp(): Application {
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 'loopback, linklocal, uniquelocal');

    const origins = config.corsOrigin.split(',').map(o => o.trim());
    app.use(cors({ origin: origins.includes('*') ? '*' : origins }));
    app.use(compression());
    app.use(express.json({ limit: '100kb' }));
    app.use((req, res, next) => {
        const started = Date.now();
        res.on('finish', () => log.debug(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`));
        next();
    });

    app.get('/api/health', (_req, res) => {
        const network = getNetwork();
        res.set('Cache-Control', 'no-store');
        res.json({
            status: network.lines.size > 0 ? 'ok' : 'degraded',
            uptime: Math.round(process.uptime()),
            data: { serviceDate: network.serviceDate, lines: network.lines.size, stops: network.stops.length, trips: network.tripCount },
        });
    });
    app.use('/api/stops', stopsRouter);
    app.use('/api/lines', linesRouter);
    app.use('/api/routes', rateLimit, routesRouter);
    app.use('/api/isochrone', rateLimit, isochroneRouter);
    app.use('/api/realtime', realtimeRouter);
    app.use('/api/data', dataRouter);
    app.get('/api/openapi.json', (_req, res) => {
        res.set('Cache-Control', 'public, max-age=300');
        res.json(openApiDocument);
    });
    // The documentation is a page of the web client.
    app.get(['/api', '/api/docs'], (_req, res) => res.redirect(301, '/docs'));
    app.use('/api', (req, _res, next) => next(new HttpError(404, `Not found: ${req.method} ${req.originalUrl}`)));

    // The built React client (client/dist): hashed assets are immutable, pages are revalidated.
    const index = path.join(config.clientDir, 'index.html');
    if (fs.existsSync(index)) {
        app.use(
            express.static(config.clientDir, {
                index: false,
                setHeaders: (res, file) => {
                    res.setHeader(
                        'Cache-Control',
                        file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
                    );
                },
            }),
        );
        const docs = path.join(config.clientDir, 'docs.html');
        app.get(['/docs', '/docs/'], (_req, res) => res.sendFile(fs.existsSync(docs) ? docs : index));
        app.use((req, res, next) => (req.method === 'GET' ? res.set('Cache-Control', 'no-cache').sendFile(index) : next()));
    } else {
        app.get(['/', '/docs'], (_req, res) => {
            res.redirect('/api/openapi.json');
        });
    }

    app.use((req, _res, next) => next(new HttpError(404, `Not found: ${req.method} ${req.originalUrl}`)));
    app.use((err: Error & { type?: string; status?: number }, req: Request, res: Response, _next: NextFunction) => {
        if (err instanceof HttpError) {
            res.status(err.status).json({ success: false, message: err.message, ...(err.details ? { details: err.details } : {}) });
            return;
        }
        if (err.type === 'entity.parse.failed') {
            res.status(400).json({ success: false, message: 'Invalid JSON body.' });
            return;
        }
        if (err.status && err.status >= 400 && err.status < 500) {
            res.status(err.status).json({ success: false, message: err.message });
            return;
        }
        log.error(`${req.method} ${req.originalUrl}: ${err.stack ?? err.message}`);
        res.status(500).json({
            success: false,
            message: config.isProduction ? 'An internal server error occurred.' : err.message,
        });
    });

    return app;
}
