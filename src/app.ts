import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import dataRouter, { legacyRefreshRouter } from './api/data/data.routes';
import linesRouter from './api/lines/lines.routes';
import { openApiDocument } from './api/openapi';
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

    const origins = config.corsOrigin.split(',').map(o => o.trim());
    app.use(cors({ origin: origins.includes('*') ? '*' : origins }));
    app.use(express.json({ limit: '100kb' }));
    app.use((req, res, next) => {
        const started = Date.now();
        res.on('finish', () => log.debug(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`));
        next();
    });

    app.get('/api/health', (_req, res) => {
        const network = getNetwork();
        res.json({
            status: 'ok',
            uptime: Math.round(process.uptime()),
            data: { lines: network.lines.size, stops: network.stops.length, trips: network.tripCount, loadedAt: network.loadedAt },
        });
    });
    app.use('/api/stops', stopsRouter);
    app.use('/api/lines', linesRouter);
    app.use('/api/routes', routesRouter);
    app.use('/api/data', dataRouter);
    app.use('/refresh', legacyRefreshRouter);
    app.get('/api/openapi.json', (_req, res) => {
        res.json(openApiDocument);
    });
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: 'Miawstral API' }));
    app.use('/api', (req, _res, next) => next(new HttpError(404, `Not found: ${req.method} ${req.originalUrl}`)));

    // The built React client, if any (client/dist), with SPA fallback.
    const index = path.join(config.clientDir, 'index.html');
    if (fs.existsSync(index)) {
        app.use(express.static(config.clientDir, { index: false, maxAge: '1h' }));
        app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(index) : next()));
    } else {
        app.get('/', (_req, res) => {
            res.redirect('/api/docs');
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
