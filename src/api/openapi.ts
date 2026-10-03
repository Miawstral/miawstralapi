/** OpenAPI description of the public API, served on /api/docs. */

const stopSummary = {
    type: 'object',
    properties: {
        stopPointId: { type: 'string', example: 'MISTRAL:TOLIBI' },
        name: { type: 'string', example: 'Liberté' },
        city: { type: 'string', nullable: true, example: 'Toulon' },
        latitude: { type: 'string', example: '43.12513' },
        longitude: { type: 'string', example: '5.93205' },
        accessible: { type: 'boolean' },
        lines: { type: 'array', items: { type: 'string' }, example: ['1', '2', '9'] },
        distance: { type: 'integer', description: 'Meters (nearby search only)' },
    },
};

const place = {
    type: 'object',
    properties: {
        lat: { type: 'number' },
        lon: { type: 'number' },
        name: { type: 'string' },
        stopId: { type: 'string' },
    },
};

const error = {
    type: 'object',
    properties: { success: { type: 'boolean', example: false }, message: { type: 'string' } },
};

const errorResponse = (description: string) => ({
    description,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const json = (schema: object, description = 'OK') => ({ description, content: { 'application/json': { schema } } });
const query = (name: string, description: string, schema: object, required = false) => ({
    name,
    in: 'query',
    required,
    description,
    schema,
});
const idParam = (description: string) => ({ name: 'id', in: 'path', required: true, description, schema: { type: 'string' } });

export const openApiDocument = {
    openapi: '3.0.3',
    info: {
        title: 'Miawstral API',
        version: '2.0.0',
        description:
            'Arrêts, lignes, horaires et calcul d’itinéraires pour le Réseau Mistral (Toulon Provence Méditerranée). ' +
            'Projet non officiel, construit à partir de données publiques.',
        license: { name: 'GPL-3.0-or-later' },
    },
    tags: [{ name: 'Stops' }, { name: 'Lines' }, { name: 'Routes' }, { name: 'Data' }],
    paths: {
        '/api/health': {
            get: { summary: 'Health check', tags: ['Data'], responses: { 200: json({ type: 'object' }) } },
        },
        '/api/stops': {
            get: {
                summary: 'All stops',
                tags: ['Stops'],
                responses: { 200: json({ type: 'array', items: { $ref: '#/components/schemas/StopSummary' } }) },
            },
        },
        '/api/stops/search': {
            get: {
                summary: 'Search stops by name (accent-insensitive)',
                tags: ['Stops'],
                parameters: [
                    query('q', 'Text to search', { type: 'string' }, true),
                    query('limit', 'Max results (default 20)', { type: 'integer', maximum: 100 }),
                ],
                responses: {
                    200: json({ type: 'array', items: { $ref: '#/components/schemas/StopSummary' } }),
                    400: errorResponse('Missing query'),
                },
            },
        },
        '/api/stops/nearby': {
            get: {
                summary: 'Stops around a point, nearest first',
                tags: ['Stops'],
                parameters: [
                    query('lat', 'Latitude', { type: 'number' }, true),
                    query('lon', 'Longitude', { type: 'number' }, true),
                    query('radius', 'Radius in meters (default 500, max 5000)', { type: 'number' }),
                    query('limit', 'Max results (default 50)', { type: 'integer' }),
                ],
                responses: {
                    200: json({ type: 'array', items: { $ref: '#/components/schemas/StopSummary' } }),
                    400: errorResponse('Invalid parameters'),
                },
            },
        },
        '/api/stops/{id}': {
            get: {
                summary: 'Stop details with the lines and times passing there',
                tags: ['Stops'],
                parameters: [idParam('stopPointId, e.g. MISTRAL:TOLIBI')],
                responses: { 200: json({ type: 'object' }), 404: errorResponse('Unknown stop') },
            },
        },
        '/api/stops/{id}/departures': {
            get: {
                summary: 'Next departures from a stop',
                tags: ['Stops'],
                parameters: [
                    idParam('stopPointId'),
                    query('time', 'HH:MM, defaults to now (Europe/Paris)', { type: 'string', example: '08:00' }),
                    query('limit', 'Max results (default 10)', { type: 'integer', maximum: 50 }),
                ],
                responses: { 200: json({ type: 'object' }), 404: errorResponse('Unknown stop') },
            },
        },
        '/api/lines': {
            get: { summary: 'All lines', tags: ['Lines'], responses: { 200: json({ type: 'array', items: { type: 'object' } }) } },
        },
        '/api/lines/search': {
            get: {
                summary: 'Search lines by number or name',
                tags: ['Lines'],
                parameters: [query('q', 'Text to search', { type: 'string' }, true)],
                responses: { 200: json({ type: 'array', items: { type: 'object' } }) },
            },
        },
        '/api/lines/{id}': {
            get: {
                summary: 'Line details: directions, stops and times',
                tags: ['Lines'],
                parameters: [idParam('Line number, e.g. 87 or U')],
                responses: { 200: json({ type: 'object' }), 404: errorResponse('Unknown line') },
            },
        },
        '/api/routes/calculate': {
            post: {
                summary: 'Itineraries from A to B (RAPTOR)',
                tags: ['Routes'],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/RouteRequest' } } },
                },
                responses: {
                    200: json({
                        type: 'object',
                        properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/RouteResponse' } },
                    }),
                    400: errorResponse('Invalid request'),
                    404: errorResponse('Unknown stop'),
                },
            },
        },
        '/api/data/status': {
            get: { summary: 'Loaded data and refresh status', tags: ['Data'], responses: { 200: json({ type: 'object' }) } },
        },
        '/api/data/refresh': {
            post: {
                summary: 'Scrape the timetables again (admin)',
                tags: ['Data'],
                security: [{ bearer: [] }],
                parameters: [
                    query('mode', 'smart (known lines) or full (every id)', { type: 'string', enum: ['smart', 'full'] }),
                    query('lines', 'Comma separated line ids to refresh', { type: 'string' }),
                    query('wait', 'Wait for the end instead of answering 202', { type: 'boolean' }),
                ],
                responses: {
                    200: json({ type: 'object' }, 'Finished (wait=true)'),
                    202: json({ type: 'object' }, 'Started'),
                    401: errorResponse('Bad token'),
                    403: errorResponse('ADMIN_TOKEN not configured'),
                    409: errorResponse('Already running'),
                },
            },
        },
    },
    components: {
        securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
        schemas: {
            Error: error,
            StopSummary: stopSummary,
            Place: place,
            RouteRequest: {
                type: 'object',
                required: ['from', 'to'],
                properties: {
                    from: { $ref: '#/components/schemas/Place' },
                    to: { $ref: '#/components/schemas/Place' },
                    departureTime: { type: 'string', example: '08:00' },
                    maxWalkingDistance: { type: 'number', default: 800, maximum: 3000 },
                    maxTransfers: { type: 'integer', default: 2, maximum: 4 },
                    excludedLines: { type: 'array', items: { type: 'string' } },
                    maxResults: { type: 'integer', default: 5, maximum: 10 },
                    includeGeometry: { type: 'boolean', default: true },
                },
                example: { from: { stopId: 'MISTRAL:SECENN' }, to: { stopId: 'MISTRAL:SELBEO' }, departureTime: '08:00' },
            },
            RouteResponse: {
                type: 'object',
                properties: {
                    from: { $ref: '#/components/schemas/Place' },
                    to: { $ref: '#/components/schemas/Place' },
                    departureTime: { type: 'string' },
                    routes: { type: 'array', items: { type: 'object' } },
                    warnings: { type: 'array', items: { type: 'string' } },
                    calculationTime: { type: 'integer', description: 'ms' },
                },
            },
        },
    },
};
