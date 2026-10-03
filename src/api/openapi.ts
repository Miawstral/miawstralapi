/**
 * OpenAPI 3.1 description of the public API, served on GET /api/openapi.json.
 *
 * It is the single source of the documentation page (/docs, client/src/docs):
 * Markdown descriptions, examples (real responses, shortened) and a few `x-`
 * extensions read by that page:
 * - info `x-features`: feature cards of the introduction;
 * - info `x-quickstart`: operation used for the quickstart snippet;
 * - operation `x-badges`: chips next to the title (`tone`: live | limit | cache | admin);
 * - operation `x-preview`: visual preview of live responses (vehicles | isochrone | shape | route).
 * A parameter `example` pre-fills the "Essayer" console; schema `examples` are documentation only.
 */

type Schema = Record<string, unknown>;

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const nullable = (schema: Schema): Schema => ({ ...schema, type: [schema.type as string, 'null'] });
const arrayOf = (items: Schema, extra: Schema = {}): Schema => ({ type: 'array', items, ...extra });
const json = (schema: Schema, example?: unknown) => ({
    'application/json': { schema, ...(example === undefined ? {} : { example }) },
});
const ok = (description: string, schema: Schema, example: unknown, headers?: Record<string, unknown>) => ({
    description,
    ...(headers ? { headers } : {}),
    content: json(schema, example),
});
const response = (name: string) => ({ $ref: `#/components/responses/${name}` });
const param = (name: string) => ({ $ref: `#/components/parameters/${name}` });
const header = (name: string) => ({ $ref: `#/components/headers/${name}` });

const TIME = { type: 'string', pattern: '^\\d{2}:\\d{2}$' };
const COLOR = { type: 'string', pattern: '^#[0-9a-f]{6}$' };
const CACHED_HEADERS = { 'Cache-Control': header('CacheControl'), ETag: header('ETag') };
const RATE_LIMIT_HEADERS = {
    'RateLimit-Limit': header('RateLimitLimit'),
    'RateLimit-Remaining': header('RateLimitRemaining'),
    'RateLimit-Reset': header('RateLimitReset'),
};

const lineIdParameter = {
    name: 'id',
    in: 'path',
    required: true,
    description: 'Numéro de la ligne (`bus_id`, insensible à la casse) ou identifiant GTFS (`lineId`).',
    schema: { type: 'string' },
    example: '87',
};

const badge = {
    live: { label: 'Temps réel', tone: 'live' },
    limit: { label: '120 req/min', tone: 'limit' },
    cache: { label: 'Cache 5 min + ETag', tone: 'cache' },
    admin: { label: 'Admin', tone: 'admin' },
};

/** Real responses captured on the live network (October 2026), shortened. */
const EX = {
    health: { status: 'ok', uptime: 243, data: { serviceDate: '2026-10-03', lines: 47, stops: 2013, trips: 2674 } },
    stops: [
        {
            stopPointId: 'TOLIBI',
            name: 'Liberté',
            city: 'Toulon',
            latitude: '43.125444',
            longitude: '5.930089',
            accessible: true,
            lines: ['1', '2', '9', '10', '18', '191'],
        },
        {
            stopPointId: 'SECENN',
            name: 'Seyne Centre',
            city: 'La Seyne-sur-Mer',
            latitude: '43.101214',
            longitude: '5.8834',
            accessible: true,
            lines: ['2', '12', '18', '28', '81', '82', '83', '87'],
        },
        {
            stopPointId: 'SIBRUE',
            name: 'Le Brusc',
            city: 'Six-Fours-les-Plages',
            latitude: '43.071185',
            longitude: '5.794589',
            accessible: true,
            lines: ['87'],
        },
    ],
    stopsSearch: [
        {
            stopPointId: 'TOLIBI',
            name: 'Liberté',
            city: 'Toulon',
            latitude: '43.125444',
            longitude: '5.930089',
            accessible: true,
            lines: ['1', '2', '9', '10', '18', '191'],
        },
        {
            stopPointId: 'TOLIBN',
            name: 'Liberté',
            city: 'Toulon',
            latitude: '43.125501',
            longitude: '5.930137',
            accessible: true,
            lines: ['3', '6', '11', '11B', '15', '20', '23', '36', '40'],
        },
        {
            stopPointId: 'TOLIBS',
            name: 'Liberté',
            city: 'Toulon',
            latitude: '43.125204',
            longitude: '5.930611',
            accessible: true,
            lines: ['1', '2', '3', '6', '9', '10', '11', '11B', '15', '18', '20', '29', '36', '39', '70', '102', '103', '191'],
        },
    ],
    stopsNearby: [
        {
            stopPointId: 'BNPOPN',
            name: 'Porte Principale',
            city: 'Toulon',
            latitude: '43.122821',
            longitude: '5.928035',
            accessible: true,
            lines: ['BN1'],
            distance: 153,
        },
        {
            stopPointId: 'TOVAUS',
            name: 'Vauban',
            city: 'Toulon',
            latitude: '43.125728',
            longitude: '5.927914',
            accessible: true,
            lines: ['1', '2', '6', '10', '11', '11B', '18', '20', '29', '36', '39', '40', '70', '102', '103', '191'],
            distance: 170,
        },
        {
            stopPointId: 'TOSENE',
            name: 'Sénès',
            city: 'Toulon',
            latitude: '43.124412',
            longitude: '5.930654',
            accessible: true,
            lines: ['6', '15', '23', '40'],
            distance: 217,
        },
    ],
    stop: {
        stopPointId: 'TOLIBI',
        name: 'Liberté',
        city: 'Toulon',
        latitude: '43.125444',
        longitude: '5.930089',
        accessible: true,
        lines: ['1', '2', '9', '10', '18', '191'],
        passingLines: [
            {
                bus_id: '1',
                lineName: 'Hôpital Ste Musse / Coupiane - Beaucaire / Cordeille',
                color: '#003893',
                textColor: '#ffffff',
                mode: 'bus',
                direction: 'OUTWARD',
                headsign: 'Beaucaire',
                times: ['08:15', '08:29', '08:47', '09:01', '09:17', '09:31'],
            },
            {
                bus_id: '2',
                lineName: 'Valgora (La Valette) - La Seyne',
                color: '#00c7b2',
                textColor: '#ffffff',
                mode: 'bus',
                direction: 'OUTWARD',
                headsign: 'La Seyne',
                times: ['09:02', '09:22', '09:43', '10:06', '10:27', '10:47'],
            },
        ],
    },
    departures: {
        stop: {
            stopPointId: 'TOLIBI',
            name: 'Liberté',
            city: 'Toulon',
            latitude: '43.125444',
            longitude: '5.930089',
            accessible: true,
            lines: ['1', '2', '9', '10', '18', '191'],
        },
        serviceDate: '2026-10-03',
        time: '16:38',
        realtime: true,
        departures: [
            {
                tripId: '5822646',
                line: '3',
                lineName: '4 Ch. des Routes - Mourillon',
                color: '#d81e05',
                textColor: '#ffffff',
                mode: 'bus',
                direction: 'INWARD',
                headsign: 'Mourillon',
                time: '16:42',
                realtime: { time: '16:39', delay: -154 },
                cancelled: false,
                stopPointId: 'TOLIBS',
            },
            {
                tripId: '5820033',
                line: '9',
                lineName: 'Hôpital Ste Musse - C.C. Ollioules/Gare (Toulon)',
                color: '#5bbf21',
                textColor: '#ffffff',
                mode: 'bus',
                direction: 'OUTWARD',
                headsign: 'Gare Toulon',
                time: '16:40',
                realtime: { time: '16:40', delay: -5 },
                cancelled: false,
                stopPointId: 'TOLIBI',
            },
            {
                tripId: '5820278',
                line: '11',
                lineName: 'Blache - Montserrat',
                color: '#9c4e96',
                textColor: '#ffffff',
                mode: 'bus',
                direction: 'INWARD',
                headsign: 'Blache',
                time: '16:42',
                realtime: { time: '16:42', delay: 11 },
                cancelled: false,
                stopPointId: 'TOLIBS',
            },
            {
                tripId: '5820680',
                line: '11B',
                lineName: 'La Baume - Blache',
                color: '#9c4e96',
                textColor: '#ffffff',
                mode: 'bus',
                direction: 'OUTWARD',
                headsign: 'La Baume',
                time: '16:43',
                realtime: { time: '16:43', delay: 0 },
                cancelled: false,
                stopPointId: 'TOLIBN',
            },
        ],
    },
    lines: [
        {
            bus_id: '87',
            lineName: 'Seyne Centre - Le Brusc',
            lineId: '0087',
            color: '#9aaad7',
            textColor: '#ffffff',
            mode: 'bus',
            directions: [
                { direction: 'OUTWARD', headsign: 'Le Brusc', trips: 21 },
                { direction: 'INWARD', headsign: 'Seyne Centre', trips: 21 },
            ],
        },
        {
            bus_id: '8M',
            lineName: 'Toulon - La Seyne',
            lineId: '8M',
            color: '#9aaad7',
            textColor: '#ffffff',
            mode: 'boat',
            directions: [
                { direction: 'OUTWARD', headsign: 'Esp. Marine-Seyne', trips: 27 },
                { direction: 'INWARD', headsign: 'Toulon', trips: 27 },
            ],
        },
        {
            bus_id: 'U',
            lineName: 'Pôle d\'Activité Toulon Est - Technopôle Mer',
            lineId: 'U',
            color: '#fc9d44',
            textColor: '#ffffff',
            mode: 'bus',
            directions: [
                { direction: 'OUTWARD', headsign: 'Technopole de la Mer', trips: 64 },
                { direction: 'INWARD', headsign: 'Pôle d\'Activité Toulon Est', trips: 64 },
            ],
        },
        {
            bus_id: 'T',
            lineName: 'Téléphérique du Mont Faron',
            lineId: 'T',
            color: '#db0000',
            textColor: '#ffffff',
            mode: 'cable',
            directions: [{ direction: 'OUTWARD', headsign: 'Faron', trips: 34 }, { direction: 'INWARD', headsign: 'Toulon', trips: 34 }],
        },
    ],
    linesSearch: [
        {
            bus_id: '87',
            lineName: 'Seyne Centre - Le Brusc',
            lineId: '0087',
            color: '#9aaad7',
            textColor: '#ffffff',
            mode: 'bus',
            directions: [
                { direction: 'OUTWARD', headsign: 'Le Brusc', trips: 21 },
                { direction: 'INWARD', headsign: 'Seyne Centre', trips: 21 },
            ],
        },
    ],
    line: {
        bus_id: '87',
        lineName: 'Seyne Centre - Le Brusc',
        lineId: '0087',
        color: '#9aaad7',
        textColor: '#ffffff',
        mode: 'bus',
        serviceDate: '2026-10-03',
        directions: [
            {
                direction: 'OUTWARD',
                headsign: 'Le Brusc',
                trips: 21,
                stops: [
                    {
                        stopPointId: 'SECENN',
                        name: 'Seyne Centre',
                        city: 'La Seyne-sur-Mer',
                        latitude: '43.101214',
                        longitude: '5.8834',
                        accessible: true,
                        times: ['06:05', '06:45', '07:25', '08:05', '08:45', '09:25'],
                    },
                    {
                        stopPointId: 'SELBAO',
                        name: 'La Barre (La Seyne)',
                        city: 'La Seyne-sur-Mer',
                        latitude: '43.098955',
                        longitude: '5.882432',
                        accessible: true,
                        times: ['06:06', '06:46', '07:26', '08:06', '08:46', '09:26'],
                    },
                    {
                        stopPointId: 'SELBEO',
                        name: 'Lycée Beaussier',
                        city: 'La Seyne-sur-Mer',
                        latitude: '43.099138',
                        longitude: '5.879734',
                        accessible: true,
                        times: ['06:07', '06:47', '07:27', '08:07', '08:47', '09:27'],
                    },
                ],
            },
            {
                direction: 'INWARD',
                headsign: 'Seyne Centre',
                trips: 21,
                stops: [
                    {
                        stopPointId: 'SIBRUE',
                        name: 'Le Brusc',
                        city: 'Six-Fours-les-Plages',
                        latitude: '43.071185',
                        longitude: '5.794589',
                        accessible: true,
                        times: ['06:05', '06:45', '07:25', '08:05', '08:45', '09:25'],
                    },
                    {
                        stopPointId: 'SIPBRE',
                        name: 'Port du Brusc',
                        city: 'Six-Fours-les-Plages',
                        latitude: '43.0743',
                        longitude: '5.79993',
                        accessible: true,
                        times: ['06:07', '06:47', '07:27', '08:07', '08:47', '09:27'],
                    },
                    {
                        stopPointId: 'SIEMBE',
                        name: 'Embarcadère (Brusc)',
                        city: 'Six-Fours-les-Plages',
                        latitude: '43.075524',
                        longitude: '5.801915',
                        accessible: true,
                        times: ['06:07', '06:47', '07:27', '08:07', '08:47', '09:27'],
                    },
                ],
            },
        ],
    },
    shape: {
        bus_id: '8M',
        color: '#9aaad7',
        directions: [
            {
                direction: 'OUTWARD',
                headsign: 'Esp. Marine-Seyne',
                coordinates: [[43.12032, 5.930997], [43.113266, 5.923915], [43.105257, 5.892216], [43.103212, 5.883946], [43.102315, 5.88189]],
                stops: [
                    { stopPointId: 'TOPTOS', name: 'Ponton Toulon', lat: 43.12035, lon: 5.930977 },
                    { stopPointId: 'SEPEMS', name: 'Ponton Espace Marine', lat: 43.102439, lon: 5.889641 },
                    { stopPointId: 'SEPSES', name: 'Ponton Seyne', lat: 43.102303, lon: 5.881899 },
                ],
            },
            {
                direction: 'INWARD',
                headsign: 'Toulon',
                coordinates: [[43.102315, 5.88189], [43.104719, 5.887976], [43.10657, 5.897052], [43.11441, 5.926993], [43.12032, 5.930997]],
                stops: [
                    { stopPointId: 'SEPSES', name: 'Ponton Seyne', lat: 43.102303, lon: 5.881899 },
                    { stopPointId: 'SEPEMS', name: 'Ponton Espace Marine', lat: 43.102439, lon: 5.889641 },
                    { stopPointId: 'TOPTOS', name: 'Ponton Toulon', lat: 43.12035, lon: 5.930977 },
                ],
            },
        ],
    },
    route: {
        success: true,
        data: {
            from: { lat: 43.071185, lon: 5.794589, name: 'Le Brusc', stopId: 'SIBRUE' },
            to: { lat: 43.125444, lon: 5.930089, name: 'Liberté', stopId: 'TOLIBI' },
            serviceDate: '2026-10-03',
            departureTime: '16:45',
            routes: [
                {
                    departureTime: '16:45',
                    arrivalTime: '17:36',
                    duration: 51,
                    transfers: 1,
                    walkingDistance: 181,
                    steps: [
                        {
                            type: 'bus',
                            tripId: '5819127',
                            line: '87',
                            lineName: 'Seyne Centre - Le Brusc',
                            color: '#9aaad7',
                            textColor: '#ffffff',
                            mode: 'bus',
                            headsign: 'Seyne Centre',
                            from: { stopId: 'SIBRUE', name: 'Le Brusc', lat: 43.071185, lon: 5.794589 },
                            to: { stopId: 'SELBAE', name: 'La Barre (La Seyne)', lat: 43.09901, lon: 5.882597 },
                            departureTime: '16:45',
                            arrivalTime: '17:11',
                            stopsCount: 31,
                            intermediateStops: [
                                { stopId: 'SIPBRE', name: 'Port du Brusc', lat: 43.0743, lon: 5.79993, time: '16:46' },
                                { stopId: 'SIEMBE', name: 'Embarcadère (Brusc)', lat: 43.075524, lon: 5.801915, time: '16:46' },
                            ],
                            duration: 26,
                            distance: 11557,
                            realtime: { departureTime: '16:45', arrivalTime: '17:11', departureDelay: 0, arrivalDelay: 2 },
                            cancelled: false,
                            geometry: [[43.071174, 5.79464], [43.09236, 5.84322], [43.09902533333334, 5.882594]],
                        },
                        {
                            type: 'walk',
                            from: { lat: 43.09901, lon: 5.882597, name: 'La Barre (La Seyne)', stopId: 'SELBAE' },
                            to: { lat: 43.099225, lon: 5.884285, name: 'Kennedy', stopId: 'SEKENN' },
                            departureTime: '17:11',
                            arrivalTime: '17:14',
                            duration: 3,
                            distance: 181,
                            geometry: [[43.09901, 5.882597], [43.099225, 5.884285]],
                        },
                        {
                            type: 'bus',
                            tripId: '5819403',
                            line: '18',
                            lineName: 'Blache - Sablettes',
                            color: '#ab9ecb',
                            textColor: '#ffffff',
                            mode: 'bus',
                            headsign: 'Blache par autoroute',
                            from: { stopId: 'SEKENN', name: 'Kennedy', lat: 43.099225, lon: 5.884285 },
                            to: { stopId: 'TOLIBS', name: 'Liberté', lat: 43.125204, lon: 5.930611 },
                            departureTime: '17:16',
                            arrivalTime: '17:36',
                            stopsCount: 17,
                            intermediateStops: [
                                { stopId: 'SECENN', name: 'Seyne Centre', lat: 43.101214, lon: 5.8834, time: '17:17' },
                                { stopId: 'SEMAIE', name: 'Mairie (La Seyne)', lat: 43.102625, lon: 5.881757, time: '17:18' },
                            ],
                            duration: 20,
                            distance: 7156,
                            realtime: { departureTime: '17:16', arrivalTime: '17:36', departureDelay: 0, arrivalDelay: 0 },
                            cancelled: false,
                            geometry: [[43.099223, 5.884246], [43.119866, 5.887265], [43.125274, 5.930637]],
                        },
                    ],
                    alerts: ['8800c49c-7c59-4cdc-9b8a-97846f2ec4c4'],
                    score: 61,
                },
                {
                    departureTime: '17:25',
                    arrivalTime: '18:30',
                    duration: 65,
                    transfers: 1,
                    walkingDistance: 0,
                    steps: [
                        {
                            type: 'bus',
                            tripId: '5819128',
                            line: '87',
                            lineName: 'Seyne Centre - Le Brusc',
                            color: '#9aaad7',
                            textColor: '#ffffff',
                            mode: 'bus',
                            headsign: 'Seyne Centre',
                            from: { stopId: 'SIBRUE', name: 'Le Brusc', lat: 43.071185, lon: 5.794589 },
                            to: { stopId: 'SIFFIS', name: 'Font de Fillol', lat: 43.098105, lon: 5.8281 },
                            departureTime: '17:25',
                            arrivalTime: '17:36',
                            stopsCount: 12,
                            intermediateStops: [
                                { stopId: 'SIPBRE', name: 'Port du Brusc', lat: 43.0743, lon: 5.79993, time: '17:26' },
                                { stopId: 'SIEMBE', name: 'Embarcadère (Brusc)', lat: 43.075524, lon: 5.801915, time: '17:26' },
                            ],
                            duration: 11,
                            distance: 5460,
                            realtime: { departureTime: '17:25', arrivalTime: '17:36', departureDelay: 0, arrivalDelay: 0 },
                            cancelled: false,
                            geometry: [[43.071174, 5.79464], [43.08369, 5.81224], [43.09814909090909, 5.828158181818182]],
                        },
                        {
                            type: 'bus',
                            tripId: '5834145',
                            line: '70',
                            lineName: 'Gare Routière (Toulon) - Bonnegrâce',
                            color: '#009bab',
                            textColor: '#ffffff',
                            mode: 'bus',
                            headsign: 'Gare Routière Toulon',
                            from: { stopId: 'SIFFIS', name: 'Font de Fillol', lat: 43.098105, lon: 5.8281 },
                            to: { stopId: 'TOLIBS', name: 'Liberté', lat: 43.125204, lon: 5.930611 },
                            departureTime: '17:56',
                            arrivalTime: '18:30',
                            stopsCount: 29,
                            intermediateStops: [
                                { stopId: 'SIGABS', name: 'Gabois', lat: 43.096313, lon: 5.831112, time: '17:57' },
                                { stopId: 'SIPTBS', name: 'Pont du Brusc', lat: 43.094274, lon: 5.836045, time: '17:59' },
                            ],
                            duration: 34,
                            distance: 12020,
                            realtime: { departureTime: '17:56', arrivalTime: '18:30', departureDelay: 0, arrivalDelay: 0 },
                            cancelled: false,
                            geometry: [[43.0981486, 5.8281591], [43.10714, 5.87684], [43.125266499999995, 5.93067375]],
                        },
                    ],
                    alerts: [],
                    score: 75,
                },
            ],
            alerts: [
                {
                    id: '8800c49c-7c59-4cdc-9b8a-97846f2ec4c4',
                    title: 'Le 04/10 : 5 & 10 KM de Tamaris',
                    description: 'Le dimanche 4 octobre 2026, à l’occasion des courses des 5 et 10 km de Tamaris, la ligne 18 risque d’être perturbée entre les arrêts Sablettes et Marégau, de 9h à 9h30.\n\nMerci de votre compréhension.',
                    url: null,
                    cause: 'OTHER_CAUSE',
                    effect: 'REDUCED_SERVICE',
                    start: '2026-10-04T01:00:00.000Z',
                    end: '2026-10-04T21:45:00.000Z',
                    active: false,
                    lines: [{ id: '18', color: '#ab9ecb', textColor: '#ffffff' }],
                    stops: [],
                },
            ],
            warnings: [],
            calculationTime: 827,
        },
    },
    isochrone: {
        origin: { lat: 43.125444, lon: 5.930089, name: 'Liberté', stopId: 'TOLIBI' },
        serviceDate: '2026-10-03',
        departureTime: '08:00',
        maxDuration: 20,
        calculationTime: 6,
        stops: [
            { stopPointId: 'TOLIBI', name: 'Liberté', lat: 43.125444, lon: 5.930089, duration: 0, transfers: 0 },
            { stopPointId: 'TOSTRO', name: 'Strasbourg', lat: 43.124493, lon: 5.934111, duration: 1, transfers: 0 },
            { stopPointId: 'TOCLES', name: 'Clemenceau', lat: 43.123634, lon: 5.937001, duration: 2, transfers: 0 },
            { stopPointId: 'TOBLA5', name: 'Blache', lat: 43.123224, lon: 5.936473, duration: 4, transfers: 0 },
            { stopPointId: 'TODARS', name: 'Dardanelles', lat: 43.128735, lon: 5.925639, duration: 6, transfers: 0 },
            { stopPointId: 'VATHOO', name: 'Thouar (Coupiane)', lat: 43.131079, lon: 5.992159, duration: 20, transfers: 1 },
        ],
    },
    vehicles: {
        updatedAt: '2026-10-03T14:40:30.000Z',
        count: 4,
        vehicles: [
            {
                id: '313',
                label: '313',
                tripId: '5819127',
                line: '87',
                lineName: 'Seyne Centre - Le Brusc',
                color: '#9aaad7',
                textColor: '#ffffff',
                mode: 'bus',
                headsign: 'Seyne Centre',
                lat: 43.0713005065918,
                lon: 5.7947998046875,
                bearing: 196,
                speed: 0,
                delay: 0,
                status: 'IN_TRANSIT_TO',
                nextStop: { stopPointId: 'SIPBRE', name: 'Port du Brusc' },
                updatedAt: '2026-10-03T14:36:48.000Z',
            },
            {
                id: '327',
                label: '327',
                tripId: '5819106',
                line: '87',
                lineName: 'Seyne Centre - Le Brusc',
                color: '#9aaad7',
                textColor: '#ffffff',
                mode: 'bus',
                headsign: 'Le Brusc',
                lat: 43.10129928588867,
                lon: 5.883299827575684,
                bearing: 354,
                speed: 0,
                delay: 0,
                status: 'IN_TRANSIT_TO',
                nextStop: { stopPointId: 'SELBAO', name: 'La Barre (La Seyne)' },
                updatedAt: '2026-10-03T14:40:18.000Z',
            },
            {
                id: '987',
                label: '987',
                tripId: '5828775',
                line: '8M',
                lineName: 'Toulon - La Seyne',
                color: '#9aaad7',
                textColor: '#ffffff',
                mode: 'boat',
                headsign: 'Toulon',
                lat: 43.10240173339844,
                lon: 5.884300231933594,
                bearing: 86,
                speed: 36,
                delay: 0,
                status: 'IN_TRANSIT_TO',
                nextStop: { stopPointId: 'SEPEMS', name: 'Ponton Espace Marine' },
                updatedAt: '2026-10-03T14:41:38.000Z',
            },
            {
                id: '992',
                label: '992',
                tripId: '5828755',
                line: '8M',
                lineName: 'Toulon - La Seyne',
                color: '#9aaad7',
                textColor: '#ffffff',
                mode: 'boat',
                headsign: 'Esp. Marine-Seyne',
                lat: 43.11980056762695,
                lon: 5.930799961090088,
                bearing: 202,
                speed: 0,
                delay: 37,
                status: 'IN_TRANSIT_TO',
                nextStop: { stopPointId: 'SEPEMS', name: 'Ponton Espace Marine' },
                updatedAt: '2026-10-03T14:41:18.000Z',
            },
        ],
    },
    alerts: {
        alerts: [
            {
                id: '31a2685f-8893-4034-a3d2-e45f2a6ff10e',
                title: 'À partir du 06/03 : Travaux Av Esprit Armando à La Seyne',
                description: 'À partir du 06/03 : Travaux Av Esprit Armando à La Seyne\n\nÀ partir du 06 mars et pour une durée de 8 mois, suite aux travaux Av Esprit Armando à La Seyne sur Mer, les lignes 81 et 82 sont déviées dans les 2 sens. \n\nArrêts non desservis : "Carmille","Bonaparte" et "Oiseaux" (L81 uniquement)\n\nReportez-vous aux arrêts St Antoine et Platane. \n\nMerci de votre compréhension.',
                url: null,
                cause: 'CONSTRUCTION',
                effect: 'REDUCED_SERVICE',
                start: '2026-02-16T09:00:00.000Z',
                end: '2026-12-31T22:45:00.000Z',
                active: true,
                lines: [{ id: '81', color: '#d81e05', textColor: '#ffffff' }, { id: '82', color: '#f77f00', textColor: '#ffffff' }],
                stops: [],
            },
            {
                id: '803de08a-2608-4839-9e13-4b8f481d15a2',
                title: 'Les 03 et 04/10 : Fête de l\'Olivier à Ollioules',
                description: 'Le samedi 03 et dimanche 04 octobre 2026, à l\'occasion de la Fête de l\'Olivier, le centre-ville d\'Ollioules est fermé à la circulation.\n\n- Ligne 12 : Déviée en direction de la Seyne par l\'avenue Clémenceau, les rues Hauteclocque et République - SAMEDI ET DIMANCHE\n- Ligne 11B : Déviée en direction de La Baume uniquement par Clemenceau, Hauteclocque et République - SAMEDI \n- Ligne 120 : Déviée en direction de Gare La Seyne / Six-Fours - SAMEDI\n- L\'appel BUS 122 : Déviée en direction de Ste Barbe par le chemin de St Roch, av J.Monnet et Résistance - SAMEDI\n\nPour connaître l\'ensemble des arrêts non desservis, télécharger le "plan de déviation".\n\nMerci de votre compréhension.',
                url: 'https://www.reseaumistral.com/deviation/84600b58-c14c-4ed3-9aaf-b6f8b100a13c.pdf',
                cause: 'OTHER_CAUSE',
                effect: 'REDUCED_SERVICE',
                start: '2026-09-02T22:00:00.000Z',
                end: '2026-10-04T21:45:00.000Z',
                active: true,
                lines: [
                    { id: '11B', color: '#9c4e96', textColor: '#ffffff' },
                    { id: '12', color: '#d81e05', textColor: '#ffffff' },
                    { id: '120', color: '#f8e415', textColor: '#000000' },
                ],
                stops: [],
            },
        ],
    },
    status: {
        success: true,
        data: {
            source: {
                name: 'Réseau Mistral — données ouvertes (transport.data.gouv.fr)',
                url: 'https://www.data.gouv.fr/api/1/datasets/r/b0789d9e-5077-4124-b6b2-773353ada8cf',
                version: '2026-10-02 15:17:52.704803 UTC',
                publisher: 'RATP Dev',
                downloadedAt: '2026-10-03T14:32:53.069Z',
                validity: { from: '2026-10-02', to: '2026-11-30' },
            },
            serviceDate: '2026-10-03',
            lines: 47,
            stops: 2013,
            trips: 2674,
            realtime: {
                enabled: true,
                vehicles: { fetchedAt: '2026-10-03T14:41:50.551Z', feedTimestamp: '2026-10-03T14:40:30.000Z', error: null },
                tripUpdates: { fetchedAt: '2026-10-03T14:41:50.898Z', feedTimestamp: '2026-10-03T14:40:29.000Z', error: null },
                alerts: { fetchedAt: '2026-10-03T14:40:59.010Z', feedTimestamp: '2026-10-03T14:40:59.000Z', error: null },
            },
        },
    },
};

const DESCRIPTION = `Miawstral met à disposition les données du **Réseau Mistral** — bus, bateaux-bus et téléphérique de la métropole Toulon Provence Méditerranée — sous la forme d'une API REST en JSON : arrêts, lignes, horaires, prochains passages en temps réel, positions des véhicules, perturbations et calcul d'itinéraires.

L'API est **ouverte, gratuite et sans clé**. Elle repose uniquement sur les données ouvertes officielles du réseau. *Projet indépendant, non affilié au Réseau Mistral ni à RATP Dev.*

## Démarrage rapide

Toutes les routes sont sous \`/api\` et répondent en JSON (UTF-8). Pas de compte ni de jeton : une requête HTTP suffit, depuis un serveur comme depuis un navigateur (CORS ouvert).

1. **Trouver un arrêt** : \`GET /api/stops/search?q=liberte\` renvoie ses points d'arrêt (\`TOLIBI\`, \`TOLIBN\`, \`TOLIBS\`).
2. **Afficher ses prochains départs** : \`GET /api/stops/TOLIBI/departures\` donne l'horaire prévu et l'estimation temps réel de chaque passage.
3. **Calculer un itinéraire** : \`POST /api/routes/calculate\` avec un départ et une arrivée, arrêts ou coordonnées.

\`\`\`http
POST /api/routes/calculate
Content-Type: application/json

{ "from": { "stopId": "SIBRUE" }, "to": { "stopId": "TOLIBI" } }
\`\`\`

## Concepts

### Arrêts et points d'arrêt
Un **point d'arrêt** (\`stopPointId\`, ex. \`TOLIBI\`) est un quai ou un côté de rue : un même lieu en compte souvent plusieurs (*Liberté* : \`TOLIBI\`, \`TOLIBN\`, \`TOLIBS\`). Les identifiants préfixés de la v1 (\`MISTRAL:TOLIBI\`) restent acceptés.

### Lignes et sens
Une ligne est identifiée par son numéro commercial (\`bus_id\`) : \`87\`, \`U\`, \`8M\` (bateau-bus), \`T\` (téléphérique du Mont Faron). Chacune a deux sens, \`OUTWARD\` (aller) et \`INWARD\` (retour), et ses couleurs officielles (\`color\`, \`textColor\`).

### Heures et journée de service
Les heures sont au format \`HH:MM\`, heure de Paris. Une **journée de service** va de 3 h à 3 h le lendemain : \`time=00:30\` désigne la nuit qui suit. Une \`date\` (\`YYYY-MM-DD\`) doit être couverte par les horaires publiés, indiqués par \`/api/data/status\`.

### Temps réel
Les retards (\`delay\`) sont en **secondes** : positifs en retard, négatifs en avance. \`realtime: null\` signifie que la course n'est pas suivie : l'horaire théorique fait foi. \`cancelled: true\` signale une course supprimée.

## Limites et bonnes pratiques

### Débit limité
Le calcul d'itinéraires et les isochrones sont limités à **120 requêtes par minute et par adresse IP**. Les en-têtes \`RateLimit-Limit\`, \`RateLimit-Remaining\` et \`RateLimit-Reset\` indiquent où vous en êtes ; au-delà, l'API répond \`429\` avec \`Retry-After\`.

### Cache et ETag
Les listes d'arrêts et de lignes et les tracés ne changent qu'avec les horaires : ils sont servis avec \`Cache-Control: public, max-age=300\` et un \`ETag\`. Renvoyez-le dans \`If-None-Match\` pour obtenir un \`304 Not Modified\` sans corps.

### Compression
Toutes les réponses sont compressées en **gzip** si le client envoie \`Accept-Encoding\` (c'est automatique avec \`fetch\`, \`curl --compressed\` ou \`requests\`). La liste complète des arrêts passe ainsi de 300 Ko à 40 Ko environ.

### Temps réel
Les flux GTFS-RT sont relus au plus toutes les 10 s (positions), 20 s (prévisions) et 2 min (perturbations). Interroger plus souvent n'apporte rien : un rafraîchissement toutes les **15 à 30 secondes** suffit pour un affichage en direct.

## Erreurs

Les erreurs utilisent les codes HTTP standards et un corps JSON constant, dont le \`message\` (en anglais) décrit le problème :

\`\`\`json
{ "success": false, "message": "Stop not found: NOPE" }
\`\`\`

| Code | Signification |
| --- | --- |
| \`400\` | Paramètre absent ou invalide, JSON mal formé, date hors des horaires publiés |
| \`401\` | Jeton d'administration absent ou invalide |
| \`403\` | Opération d'administration désactivée sur ce serveur |
| \`404\` | Arrêt, ligne ou route inconnus |
| \`429\` | Trop de requêtes : attendez \`Retry-After\` secondes |
| \`500\` | Erreur inattendue du serveur |

## Données et licence

Les horaires proviennent du flux **GTFS** officiel du Réseau Mistral, et le temps réel des flux **GTFS-RT** (positions des véhicules, prévisions de passage, perturbations), publiés par la Métropole Toulon Provence Méditerranée et RATP Dev sur [transport.data.gouv.fr](https://transport.data.gouv.fr/datasets/reseau-de-transport-urbain-de-la-metropole-toulon-provence-mediterranee) sous [Licence Ouverte 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/). Les horaires sont rechargés automatiquement lorsqu'une nouvelle version est publiée.

Si vous réutilisez ces données, mentionnez la source : **« Réseau Mistral – RATP Dev, via transport.data.gouv.fr »**. Le code de Miawstral est un logiciel libre sous licence GPL-3.0 ou ultérieure.`;

const ITINERARY_DESCRIPTION = `Calcule les meilleurs itinéraires entre deux lieux avec l'algorithme **RAPTOR** (*Round-bAsed Public Transit Optimized Router*), sur les horaires du jour et les prévisions temps réel.

- \`from\` et \`to\` acceptent un **arrêt** (\`{ "stopId": "TOLIBI" }\`) ou des **coordonnées** (\`{ "lat": 43.12, "lon": 5.93, "name": "Maison" }\`). Partir d'un arrêt inclut les autres points d'arrêt du même lieu.
- Les itinéraires sont **Pareto-optimaux** sur l'heure d'arrivée et le nombre de correspondances, triés par heure d'arrivée. Un trajet entièrement à pied est proposé jusqu'à 2 km.
- \`departureTime\` (par défaut : maintenant) ou \`arrivalTime\` pour **arriver avant** une heure ; pas les deux.
- Chaque étape \`bus\` (y compris bateau et téléphérique, voir \`mode\`) liste les arrêts desservis, suit le tracé officiel et porte sa prévision \`realtime\`. Les perturbations des lignes empruntées sont jointes dans \`alerts\`.

L'en-tête \`Server-Timing\` indique la durée du calcul. Limité à 120 requêtes par minute et par IP.`;

export const openApiDocument = {
    openapi: '3.1.0',
    info: {
        title: 'Miawstral API',
        version: '2.0.0',
        summary: 'Horaires, itinéraires et temps réel du Réseau Mistral, en une API ouverte.',
        description: DESCRIPTION,
        contact: { name: 'Projet Miawstral' },
        license: { name: 'GPL-3.0 ou ultérieure', identifier: 'GPL-3.0-or-later' },
        'x-features': [
            {
                icon: 'radio',
                title: 'Temps réel GTFS-RT',
                text: 'Retards, suppressions, positions des véhicules et perturbations, rafraîchis en continu.',
            },
            {
                icon: 'route',
                title: 'Itinéraires RAPTOR',
                text: 'Bus, bateaux-bus et marche combinés en quelques millisecondes, correspondances comprises.',
            },
            {
                icon: 'badge-check',
                title: 'Données officielles',
                text: 'Le GTFS publié par le Réseau Mistral, rechargé dès qu’une nouvelle version paraît.',
            },
            {
                icon: 'key',
                title: 'Ouverte, sans clé',
                text: 'Aucune inscription : du JSON, du CORS ouvert, des réponses compressées et cachables.',
            },
        ],
        'x-quickstart': { operationId: 'getStopDepartures' },
    },
    servers: [{ url: '/', description: 'Ce serveur' }],
    // Public API: no authentication, except where an operation says otherwise.
    security: [],
    tags: [
        {
            name: 'Arrêts',
            description: 'Les quelque 2 000 points d’arrêt du réseau : recherche par nom, autour d’un point, horaires de passage et prochains départs en temps réel.',
        },
        {
            name: 'Lignes',
            description: 'Les lignes de bus, de bateaux-bus et le téléphérique : couleurs officielles, sens, arrêts desservis, horaires et tracés.',
        },
        {
            name: 'Itinéraires',
            description: 'Calcul d’itinéraires multimodal (bus, bateau, téléphérique, marche) avec RAPTOR et le temps réel.',
            externalDocs: {
                description: 'Article de référence sur RAPTOR (Delling, Pajor, Werneck, 2012)',
                url: 'https://www.microsoft.com/en-us/research/wp-content/uploads/2012/01/raptor_alenex.pdf',
            },
        },
        {
            name: 'Temps réel',
            description: 'Positions des véhicules et perturbations en cours, issues des flux GTFS-RT officiels.',
        },
        {
            name: 'Explorer',
            description: 'Analyses du réseau : jusqu’où peut-on aller en transports en commun, en combien de temps ?',
        },
        {
            name: 'Données',
            description: 'État du service, des horaires chargés et des flux temps réel.',
        },
    ],
    paths: {
        '/api/stops': {
            get: {
                operationId: 'listStops',
                tags: ['Arrêts'],
                summary: 'Lister les arrêts',
                description:
                    'Tous les **points d’arrêt** du réseau, avec les lignes qui les desservent le jour même. Un lieu en compte souvent plusieurs, un par quai ou côté de rue.\n\n' +
                    'La réponse est volumineuse (≈ 2 000 arrêts, 300 Ko, 40 Ko compressée) mais ne change qu’avec les horaires : gardez-la en cache et revalidez-la avec l’`ETag`.',
                'x-badges': [badge.cache],
                responses: {
                    200: ok('Les points d’arrêt (extrait).', arrayOf(ref('StopSummary')), EX.stops, CACHED_HEADERS),
                    304: { description: 'Inchangé depuis l’`ETag` envoyé dans `If-None-Match`.' },
                },
            },
        },
        '/api/stops/search': {
            get: {
                operationId: 'searchStops',
                tags: ['Arrêts'],
                summary: 'Rechercher un arrêt',
                description:
                    'Recherche sur le nom des arrêts, **insensible à la casse et aux accents** : `liberte` trouve *Liberté*. ' +
                    'Les noms identiques passent en premier, puis ceux qui commencent par le texte, ceux qui contiennent un mot qui commence par lui, et enfin les autres. L’identifiant est aussi cherché.',
                parameters: [
                    {
                        name: 'q',
                        in: 'query',
                        required: true,
                        description: 'Texte recherché.',
                        schema: { type: 'string', minLength: 1 },
                        example: 'liberte',
                    },
                    {
                        name: 'limit',
                        in: 'query',
                        description: 'Nombre maximal de résultats.',
                        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
                        example: 5,
                    },
                ],
                responses: {
                    200: ok('Les arrêts trouvés, les plus pertinents d’abord.', arrayOf(ref('StopSummary')), EX.stopsSearch),
                    400: response('BadRequest'),
                },
            },
        },
        '/api/stops/nearby': {
            get: {
                operationId: 'nearbyStops',
                tags: ['Arrêts'],
                summary: 'Arrêts à proximité',
                description:
                    'Les arrêts situés dans un rayon autour d’un point, **du plus proche au plus loin**, avec leur distance à vol d’oiseau en mètres (`distance`). ' +
                    'Pratique avec la géolocalisation du navigateur.',
                parameters: [
                    {
                        name: 'lat',
                        in: 'query',
                        required: true,
                        description: 'Latitude (WGS 84).',
                        schema: { type: 'number', minimum: -90, maximum: 90 },
                        example: 43.1242,
                    },
                    {
                        name: 'lon',
                        in: 'query',
                        required: true,
                        description: 'Longitude (WGS 84).',
                        schema: { type: 'number', minimum: -180, maximum: 180 },
                        example: 5.928,
                    },
                    {
                        name: 'radius',
                        in: 'query',
                        description: 'Rayon de recherche, en mètres.',
                        schema: { type: 'number', minimum: 1, maximum: 5000, default: 500 },
                        example: 300,
                    },
                    {
                        name: 'limit',
                        in: 'query',
                        description: 'Nombre maximal de résultats.',
                        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
                        example: 3,
                    },
                ],
                responses: {
                    200: ok('Les arrêts du rayon, avec leur distance.', arrayOf(ref('StopSummary')), EX.stopsNearby),
                    400: response('BadRequest'),
                },
            },
        },
        '/api/stops/{id}': {
            get: {
                operationId: 'getStop',
                tags: ['Arrêts'],
                summary: 'Détail d’un arrêt',
                description:
                    'Le point d’arrêt et, pour chaque ligne et chaque sens qui le desservent, **toutes les heures de passage** prévues sur la journée de service. ' +
                    'Le terminus d’une course n’est pas compté comme un passage.',
                parameters: [param('StopId'), param('ServiceDate')],
                responses: {
                    200: ok('L’arrêt et ses horaires (extrait).', ref('StopDetails'), EX.stop),
                    400: response('BadRequest'),
                    404: response('NotFound'),
                },
            },
        },
        '/api/stops/{id}/departures': {
            get: {
                operationId: 'getStopDepartures',
                tags: ['Arrêts'],
                summary: 'Prochains départs',
                description:
                    'Le tableau des prochains départs d’un arrêt, avec les prévisions **GTFS-RT** quand le véhicule est suivi : `realtime.time` est l’heure estimée et `realtime.delay` l’écart en secondes. ' +
                    '`cancelled` signale une course supprimée ou un arrêt non desservi.\n\n' +
                    'Par défaut (`area=true`), les départs des autres points d’arrêt du même lieu, de l’autre côté de la rue par exemple, sont inclus : `stopPointId` indique d’où part chaque véhicule. ' +
                    'Les départs sont triés par heure **estimée** : un bus en retard, prévu un peu avant `time`, peut encore apparaître.',
                'x-badges': [badge.live],
                parameters: [
                    param('StopId'),
                    param('ServiceDate'),
                    {
                        name: 'time',
                        in: 'query',
                        description: 'Heure à partir de laquelle chercher (`HH:MM`). Par défaut : maintenant.',
                        schema: { ...TIME, examples: ['08:00'] },
                    },
                    {
                        name: 'limit',
                        in: 'query',
                        description: 'Nombre de départs.',
                        schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
                        example: 5,
                    },
                    {
                        name: 'area',
                        in: 'query',
                        description: 'Inclure les autres points d’arrêt du même lieu (à moins de 150 m, même nom).',
                        schema: { type: 'boolean', default: true },
                    },
                ],
                responses: {
                    200: ok('Les prochains départs.', ref('DepartureBoard'), EX.departures),
                    400: response('BadRequest'),
                    404: response('NotFound'),
                },
            },
        },
        '/api/lines': {
            get: {
                operationId: 'listLines',
                tags: ['Lignes'],
                summary: 'Lister les lignes',
                description:
                    'Toutes les lignes en service le jour demandé (bus, bateaux-bus, téléphérique), **dans l’ordre officiel du réseau**, avec leurs couleurs et le nombre de courses de chaque sens.',
                'x-badges': [badge.cache],
                parameters: [param('ServiceDate')],
                responses: {
                    200: ok('Les lignes (extrait).', arrayOf(ref('LineSummary')), EX.lines, CACHED_HEADERS),
                    304: { description: 'Inchangé depuis l’`ETag` envoyé dans `If-None-Match`.' },
                    400: response('BadRequest'),
                },
            },
        },
        '/api/lines/search': {
            get: {
                operationId: 'searchLines',
                tags: ['Lignes'],
                summary: 'Rechercher une ligne',
                description: 'Par numéro exact (`87`, `8m`) ou par un morceau du nom (`brusc`), sans tenir compte des accents ni de la casse.',
                parameters: [
                    {
                        name: 'q',
                        in: 'query',
                        required: true,
                        description: 'Numéro ou nom de ligne.',
                        schema: { type: 'string', minLength: 1 },
                        example: 'brusc',
                    },
                    param('ServiceDate'),
                ],
                responses: {
                    200: ok('Les lignes trouvées.', arrayOf(ref('LineSummary')), EX.linesSearch),
                    400: response('BadRequest'),
                },
            },
        },
        '/api/lines/{id}': {
            get: {
                operationId: 'getLine',
                tags: ['Lignes'],
                summary: 'Détail d’une ligne',
                description:
                    'Les deux sens d’une ligne, la suite de leurs arrêts et toutes les heures de passage à chacun. ' +
                    'L’identifiant est le numéro commercial (`87`, `8M`, `u` : insensible à la casse) ; l’identifiant GTFS (`lineId`, ex. `0087`) est aussi accepté.',
                parameters: [param('LineId'), param('ServiceDate')],
                responses: {
                    200: ok('La ligne, ses arrêts et ses horaires (extrait).', ref('LineDetails'), EX.line),
                    400: response('BadRequest'),
                    404: response('NotFound'),
                },
            },
        },
        '/api/lines/{id}/shape': {
            get: {
                operationId: 'getLineShape',
                tags: ['Lignes'],
                summary: 'Tracé d’une ligne',
                description:
                    'Le tracé officiel le plus fréquent de chaque sens, en points `[lat, lon]`, et ses arrêts : prêt à dessiner sur une carte (Leaflet, MapLibre…). ' +
                    'Sans tracé publié, le chemin relie simplement les arrêts.',
                'x-badges': [badge.cache],
                'x-preview': 'shape',
                parameters: [{ ...lineIdParameter, example: '8M' }, param('ServiceDate')],
                responses: {
                    200: ok('Le tracé de chaque sens (points abrégés).', ref('LineShape'), EX.shape, CACHED_HEADERS),
                    304: { description: 'Inchangé depuis l’`ETag` envoyé dans `If-None-Match`.' },
                    400: response('BadRequest'),
                    404: response('NotFound'),
                },
            },
        },
        '/api/routes/calculate': {
            post: {
                operationId: 'calculateRoutes',
                tags: ['Itinéraires'],
                summary: 'Calculer un itinéraire',
                description: ITINERARY_DESCRIPTION,
                'x-badges': [badge.live, badge.limit],
                'x-preview': 'route',
                requestBody: {
                    required: true,
                    description: 'Le départ, l’arrivée et les préférences du voyageur.',
                    content: {
                        'application/json': {
                            schema: ref('RouteRequest'),
                            examples: {
                                stops: {
                                    summary: 'D’un arrêt à un autre',
                                    description: 'Du Brusc (Six-Fours) à Liberté (Toulon), à partir de 16 h 45.',
                                    value: { from: { stopId: 'SIBRUE' }, to: { stopId: 'TOLIBI' }, departureTime: '16:45', maxResults: 3 },
                                },
                                arriveBy: {
                                    summary: 'Depuis des coordonnées, arriver avant 9 h',
                                    description: 'Un point quelconque (le port de La Seyne) vers un arrêt, avec une heure d’arrivée.',
                                    value: {
                                        from: { lat: 43.1035, lon: 5.8805, name: 'Port de La Seyne' },
                                        to: { stopId: 'TOLIBI' },
                                        arrivalTime: '09:00',
                                        maxResults: 2,
                                    },
                                },
                                accessible: {
                                    summary: 'Accessible, sans bateau, une correspondance au plus',
                                    description: 'Arrêts accessibles en fauteuil roulant uniquement, ligne 8M exclue.',
                                    value: {
                                        from: { stopId: 'SECENN' },
                                        to: { stopId: 'TOLIBI' },
                                        departureTime: '08:00',
                                        wheelchair: true,
                                        excludedLines: ['8M'],
                                        maxTransfers: 1,
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Les itinéraires trouvés (extrait : arrêts intermédiaires et tracés abrégés).',
                        headers: { ...RATE_LIMIT_HEADERS, 'Server-Timing': header('ServerTiming') },
                        content: json(ref('RouteResult'), EX.route),
                    },
                    400: response('BadRequest'),
                    404: response('NotFound'),
                    429: response('TooManyRequests'),
                },
            },
        },
        '/api/isochrone': {
            get: {
                operationId: 'getIsochrone',
                tags: ['Explorer'],
                summary: 'Isochrone',
                description:
                    'Tous les arrêts atteignables depuis un lieu en moins de `maxDuration` minutes, avec la durée du trajet et le nombre de correspondances : de quoi colorer une **carte d’accessibilité**.\n\n' +
                    'Donnez soit `stopId`, soit `lat` et `lon`. Depuis des coordonnées, les arrêts à moins de 600 m à pied servent de point de départ. Limité à 120 requêtes par minute et par IP.',
                'x-badges': [badge.limit],
                'x-preview': 'isochrone',
                parameters: [
                    {
                        name: 'stopId',
                        in: 'query',
                        description: 'Arrêt de départ. Sinon, `lat` et `lon` sont requis.',
                        schema: { type: 'string' },
                        example: 'TOLIBI',
                    },
                    { name: 'lat', in: 'query', description: 'Latitude du départ.', schema: { type: 'number', minimum: -90, maximum: 90 } },
                    { name: 'lon', in: 'query', description: 'Longitude du départ.', schema: { type: 'number', minimum: -180, maximum: 180 } },
                    param('ServiceDate'),
                    {
                        name: 'time',
                        in: 'query',
                        description: 'Heure de départ (`HH:MM`). Par défaut : maintenant.',
                        schema: TIME,
                        example: '08:00',
                    },
                    {
                        name: 'maxDuration',
                        in: 'query',
                        description: 'Durée maximale du trajet, en minutes.',
                        schema: { type: 'integer', minimum: 5, maximum: 180, default: 45 },
                        example: 20,
                    },
                    {
                        name: 'maxTransfers',
                        in: 'query',
                        description: 'Nombre maximal de correspondances.',
                        schema: { type: 'integer', minimum: 0, maximum: 4, default: 2 },
                    },
                    {
                        name: 'wheelchair',
                        in: 'query',
                        description: 'Uniquement les arrêts accessibles en fauteuil roulant.',
                        schema: { type: 'boolean', default: false },
                    },
                ],
                responses: {
                    200: {
                        description: 'Les arrêts atteignables, du plus proche au plus lointain (extrait).',
                        headers: RATE_LIMIT_HEADERS,
                        content: json(ref('Isochrone'), EX.isochrone),
                    },
                    400: response('BadRequest'),
                    404: response('NotFound'),
                    429: response('TooManyRequests'),
                },
            },
        },
        '/api/realtime/vehicles': {
            get: {
                operationId: 'listVehicles',
                tags: ['Temps réel'],
                summary: 'Véhicules en circulation',
                description:
                    'La position des bus et bateaux en circulation, avec leur ligne, leur destination, leur retard et leur prochain arrêt. ' +
                    'Filtrez par zone (`bbox`) ou par lignes (`lines`). Les positions sont relues au plus toutes les 10 secondes.',
                'x-badges': [badge.live],
                'x-preview': 'vehicles',
                parameters: [
                    {
                        name: 'bbox',
                        in: 'query',
                        description: 'Zone géographique : `minLon,minLat,maxLon,maxLat`.',
                        schema: { type: 'string', examples: ['5.85,43.05,6.00,43.15'] },
                    },
                    {
                        name: 'lines',
                        in: 'query',
                        description: 'Lignes à garder (`bus_id`), séparées par des virgules.',
                        schema: { type: 'string', examples: ['87,8M'] },
                    },
                ],
                responses: {
                    200: ok('Les véhicules suivis (exemple avec `lines=87,8M`).', ref('VehicleList'), EX.vehicles),
                    400: response('BadRequest'),
                },
            },
        },
        '/api/realtime/alerts': {
            get: {
                operationId: 'listAlerts',
                tags: ['Temps réel'],
                summary: 'Perturbations',
                description:
                    'Les perturbations en cours (`active: true`) puis à venir : travaux, déviations, arrêts non desservis… avec les lignes et arrêts concernés. Les perturbations terminées sont écartées.',
                'x-badges': [badge.live],
                parameters: [
                    {
                        name: 'line',
                        in: 'query',
                        description: 'Ne garder que les perturbations d’une ligne (`bus_id`, sensible à la casse).',
                        schema: { type: 'string', examples: ['87', '11B'] },
                    },
                ],
                responses: {
                    200: {
                        description: 'Les perturbations (extrait).',
                        headers: { 'Cache-Control': header('CacheControl') },
                        content: json(ref('AlertList'), EX.alerts),
                    },
                },
            },
        },
        '/api/health': {
            get: {
                operationId: 'getHealth',
                tags: ['Données'],
                summary: 'État du service',
                description:
                    'Répond `ok` dès que des horaires sont chargés, `degraded` sinon. Idéal pour une sonde de disponibilité : la réponse n’est jamais mise en cache.',
                responses: { 200: ok('Le service répond.', ref('Health'), EX.health) },
            },
        },
        '/api/data/status': {
            get: {
                operationId: 'getDataStatus',
                tags: ['Données'],
                summary: 'État des données',
                description:
                    'La version des horaires chargés et leur période de validité, les volumes de la journée de service et la fraîcheur de chaque flux temps réel ' +
                    '(`fetchedAt` : dernière lecture, `feedTimestamp` : date du flux, `error` : dernier échec). Les flux sont lus à la demande : `null` tant que personne ne les a utilisés.',
                responses: { 200: ok('L’état des données.', ref('DataStatusResult'), EX.status) },
            },
        },
        '/api/data/refresh': {
            post: {
                operationId: 'refreshData',
                tags: ['Données'],
                summary: 'Recharger les horaires',
                description:
                    'Vérifie si une nouvelle version du GTFS a été publiée, la télécharge et la charge à chaud (requête conditionnelle : rien n’est téléchargé si elle n’a pas changé). ' +
                    'Le serveur le fait déjà de lui-même toutes les 12 heures.\n\n' +
                    'Réservé à l’administrateur. Sans `ADMIN_TOKEN` configuré sur le serveur, la route est désactivée et répond `403`.',
                'x-badges': [badge.admin],
                security: [{ adminToken: [] }],
                responses: {
                    200: ok('Les horaires sont à jour.', ref('DataStatusResult'), EX.status),
                    401: response('Unauthorized'),
                    403: response('Forbidden'),
                },
            },
        },
    },
    components: {
        securitySchemes: {
            adminToken: {
                type: 'http',
                scheme: 'bearer',
                description: 'Jeton d’administration défini par la variable d’environnement `ADMIN_TOKEN` du serveur.',
            },
        },
        parameters: {
            StopId: {
                name: 'id',
                in: 'path',
                required: true,
                description: 'Identifiant du point d’arrêt (`stopPointId`). Le préfixe `MISTRAL:` de la v1 est accepté.',
                schema: { type: 'string' },
                example: 'TOLIBI',
            },
            LineId: lineIdParameter,
            ServiceDate: {
                name: 'date',
                in: 'query',
                description:
                    'Journée de service (`YYYY-MM-DD`). Par défaut : aujourd’hui. Doit être couverte par les horaires publiés (voir `/api/data/status`), sinon `400`.',
                schema: { type: 'string', format: 'date', examples: ['2026-10-05'] },
            },
        },
        headers: {
            CacheControl: {
                description: 'Durée de mise en cache (`public, max-age=300, stale-while-revalidate=86400` pour les listes).',
                schema: { type: 'string' },
            },
            ETag: {
                description: 'Version de la réponse, à renvoyer dans `If-None-Match` pour obtenir un `304`.',
                schema: { type: 'string', examples: ['W/"4860b-VjD25kc1POKEPzkeKT4wo/tTDdw"'] },
            },
            RateLimitLimit: { description: 'Requêtes autorisées par minute.', schema: { type: 'integer', examples: [120] } },
            RateLimitRemaining: { description: 'Requêtes restantes dans la fenêtre en cours.', schema: { type: 'integer', examples: [115] } },
            RateLimitReset: { description: 'Secondes avant la nouvelle fenêtre.', schema: { type: 'integer', examples: [34] } },
            RetryAfter: { description: 'Secondes à attendre avant de réessayer.', schema: { type: 'integer', examples: [34] } },
            ServerTiming: { description: 'Durée du calcul en millisecondes.', schema: { type: 'string', examples: ['route;dur=12'] } },
        },
        responses: {
            BadRequest: {
                description: 'Paramètre absent ou invalide.',
                content: json(ref('Error'), { success: false, message: "Query parameter 'q' is required." }),
            },
            NotFound: {
                description: 'Arrêt ou ligne introuvable.',
                content: json(ref('Error'), { success: false, message: 'Stop not found: NOPE' }),
            },
            TooManyRequests: {
                description: 'Trop de requêtes : attendez `Retry-After` secondes.',
                headers: { ...RATE_LIMIT_HEADERS, 'Retry-After': header('RetryAfter') },
                content: json(ref('Error'), { success: false, message: 'Too many requests, try again in a minute.' }),
            },
            Unauthorized: {
                description: 'Jeton absent ou invalide.',
                content: json(ref('Error'), { success: false, message: 'Invalid or missing admin token.' }),
            },
            Forbidden: {
                description: 'Route désactivée : `ADMIN_TOKEN` n’est pas défini sur le serveur.',
                content: json(ref('Error'), { success: false, message: 'Data refresh is disabled: set ADMIN_TOKEN to enable it.' }),
            },
        },
        schemas: {
            Error: {
                type: 'object',
                description: 'Corps de toutes les réponses d’erreur.',
                required: ['success', 'message'],
                properties: {
                    success: { type: 'boolean', const: false },
                    message: { type: 'string', description: 'Description du problème (en anglais).', examples: ['Stop not found: NOPE'] },
                },
            },
            Mode: {
                type: 'string',
                description: 'Mode de transport : `bus`, `boat` (bateau-bus), `cable` (téléphérique), `tram`, `rail`.',
                enum: ['bus', 'boat', 'cable', 'tram', 'rail'],
            },
            Direction: {
                type: 'string',
                description: 'Sens de la ligne : `OUTWARD` (aller) ou `INWARD` (retour).',
                enum: ['OUTWARD', 'INWARD'],
            },
            StopSummary: {
                type: 'object',
                description: 'Un point d’arrêt.',
                required: ['stopPointId', 'name', 'city', 'latitude', 'longitude', 'accessible', 'lines'],
                properties: {
                    stopPointId: { type: 'string', description: 'Identifiant du point d’arrêt.', examples: ['TOLIBI'] },
                    name: { type: 'string', description: 'Nom affiché.', examples: ['Liberté'] },
                    city: nullable({ type: 'string', description: 'Commune.', examples: ['Toulon'] }),
                    latitude: { type: 'string', description: 'Latitude WGS 84, en texte décimal.', examples: ['43.125444'] },
                    longitude: { type: 'string', description: 'Longitude WGS 84, en texte décimal.', examples: ['5.930089'] },
                    accessible: { type: 'boolean', description: 'Accessible en fauteuil roulant.' },
                    lines: arrayOf({ type: 'string' }, { description: 'Lignes (`bus_id`) qui desservent ce point d’arrêt ce jour-là.', examples: [['1', '2', '9']] }),
                    distance: { type: 'integer', description: 'Distance au point demandé, en mètres. Uniquement avec `/api/stops/nearby`.', examples: [153] },
                },
            },
            StopDetails: {
                description: 'Un point d’arrêt et ses horaires de passage.',
                allOf: [
                    ref('StopSummary'),
                    {
                        type: 'object',
                        required: ['passingLines'],
                        properties: {
                            passingLines: arrayOf(ref('PassingLine'), { description: 'Une entrée par ligne et par sens.' }),
                        },
                    },
                ],
            },
            PassingLine: {
                type: 'object',
                description: 'Une ligne, dans un sens, à un arrêt.',
                required: ['bus_id', 'lineName', 'color', 'textColor', 'mode', 'direction', 'headsign', 'times'],
                properties: {
                    bus_id: { type: 'string', description: 'Numéro de la ligne.', examples: ['87'] },
                    lineName: { type: 'string', description: 'Nom de la ligne.' },
                    color: { ...COLOR, description: 'Couleur de la ligne.' },
                    textColor: { ...COLOR, description: 'Couleur du texte sur `color`.' },
                    mode: ref('Mode'),
                    direction: ref('Direction'),
                    headsign: { type: 'string', description: 'Destination affichée.' },
                    times: arrayOf(TIME, { description: 'Heures de passage, dans l’ordre (`HH:MM`).' }),
                },
            },
            RealtimeInfo: {
                type: 'object',
                description: 'Prévision temps réel d’un passage.',
                required: ['time', 'delay'],
                properties: {
                    time: { ...TIME, description: 'Heure estimée (`HH:MM`).', examples: ['16:39'] },
                    delay: { type: 'integer', description: 'Écart avec l’horaire prévu, en secondes : positif en retard, négatif en avance.', examples: [-154] },
                },
            },
            Departure: {
                type: 'object',
                description: 'Un départ prochain.',
                required: ['tripId', 'line', 'lineName', 'color', 'textColor', 'mode', 'direction', 'headsign', 'time', 'realtime', 'cancelled', 'stopPointId'],
                properties: {
                    tripId: { type: 'string', description: 'Identifiant GTFS de la course.' },
                    line: { type: 'string', description: 'Numéro de la ligne (`bus_id`).', examples: ['3'] },
                    lineName: { type: 'string', description: 'Nom de la ligne.' },
                    color: { ...COLOR, description: 'Couleur de la ligne.' },
                    textColor: { ...COLOR, description: 'Couleur du texte sur `color`.' },
                    mode: ref('Mode'),
                    direction: ref('Direction'),
                    headsign: { type: 'string', description: 'Destination.', examples: ['Mourillon'] },
                    time: { ...TIME, description: 'Heure prévue au départ de l’arrêt (`HH:MM`).' },
                    realtime: { oneOf: [ref('RealtimeInfo'), { type: 'null' }], description: 'Prévision temps réel, `null` si la course n’est pas suivie.' },
                    cancelled: { type: 'boolean', description: 'Course supprimée ou arrêt non desservi.' },
                    stopPointId: { type: 'string', description: 'Point d’arrêt de départ (avec `area=true`, il peut différer de celui demandé).', examples: ['TOLIBS'] },
                },
            },
            DepartureBoard: {
                type: 'object',
                description: 'Les prochains départs d’un arrêt.',
                required: ['stop', 'serviceDate', 'time', 'realtime', 'departures'],
                properties: {
                    stop: ref('StopSummary'),
                    serviceDate: { type: 'string', format: 'date', description: 'Journée de service.' },
                    time: { ...TIME, description: 'Heure de début de la recherche.' },
                    realtime: { type: 'boolean', description: 'Les prévisions temps réel étaient disponibles.' },
                    departures: arrayOf(ref('Departure'), { description: 'Triés par heure estimée.' }),
                },
            },
            LineDirectionSummary: {
                type: 'object',
                required: ['direction', 'headsign', 'trips'],
                properties: {
                    direction: ref('Direction'),
                    headsign: { type: 'string', description: 'Terminus.', examples: ['Le Brusc'] },
                    trips: { type: 'integer', description: 'Nombre de courses ce jour-là.', examples: [21] },
                },
            },
            LineSummary: {
                type: 'object',
                description: 'Une ligne du réseau.',
                required: ['bus_id', 'lineName', 'lineId', 'color', 'textColor', 'mode', 'directions'],
                properties: {
                    bus_id: { type: 'string', description: 'Numéro commercial, utilisé partout dans l’API.', examples: ['87'] },
                    lineName: { type: 'string', description: 'Nom de la ligne.', examples: ['Seyne Centre - Le Brusc'] },
                    lineId: { type: 'string', description: 'Identifiant GTFS de la ligne (`route_id`).', examples: ['0087'] },
                    color: { ...COLOR, description: 'Couleur officielle.', examples: ['#9aaad7'] },
                    textColor: { ...COLOR, description: 'Couleur du texte sur `color`.', examples: ['#ffffff'] },
                    mode: ref('Mode'),
                    directions: arrayOf(ref('LineDirectionSummary')),
                },
            },
            LineStop: {
                type: 'object',
                description: 'Un arrêt desservi par une ligne, avec ses heures de passage.',
                required: ['stopPointId', 'name', 'city', 'latitude', 'longitude', 'accessible', 'times'],
                properties: {
                    stopPointId: { type: 'string', examples: ['SECENN'] },
                    name: { type: 'string', examples: ['Seyne Centre'] },
                    city: nullable({ type: 'string' }),
                    latitude: { type: 'string' },
                    longitude: { type: 'string' },
                    accessible: { type: 'boolean' },
                    times: arrayOf(TIME, { description: 'Heures de passage des courses de ce sens.' }),
                },
            },
            LineDetails: {
                type: 'object',
                description: 'Une ligne, ses arrêts et ses horaires.',
                required: ['bus_id', 'lineName', 'lineId', 'color', 'textColor', 'mode', 'serviceDate', 'directions'],
                properties: {
                    bus_id: { type: 'string', examples: ['87'] },
                    lineName: { type: 'string' },
                    lineId: { type: 'string' },
                    color: COLOR,
                    textColor: COLOR,
                    mode: ref('Mode'),
                    serviceDate: { type: 'string', format: 'date', description: 'Journée de service décrite.' },
                    directions: arrayOf({
                        type: 'object',
                        required: ['direction', 'headsign', 'trips', 'stops'],
                        properties: {
                            direction: ref('Direction'),
                            headsign: { type: 'string', description: 'Terminus.' },
                            trips: { type: 'integer', description: 'Nombre de courses.' },
                            stops: arrayOf(ref('LineStop'), { description: 'Arrêts, dans l’ordre de passage.' }),
                        },
                    }),
                },
            },
            LatLon: {
                type: 'array',
                description: 'Un point `[latitude, longitude]`.',
                prefixItems: [{ type: 'number', description: 'Latitude' }, { type: 'number', description: 'Longitude' }],
                minItems: 2,
                maxItems: 2,
                examples: [[43.12032, 5.930997]],
            },
            LineShape: {
                type: 'object',
                description: 'Le tracé d’une ligne.',
                required: ['bus_id', 'color', 'directions'],
                properties: {
                    bus_id: { type: 'string', examples: ['8M'] },
                    color: COLOR,
                    directions: arrayOf({
                        type: 'object',
                        required: ['direction', 'headsign', 'coordinates', 'stops'],
                        properties: {
                            direction: ref('Direction'),
                            headsign: { type: 'string' },
                            coordinates: arrayOf(ref('LatLon'), { description: 'Points du tracé, dans l’ordre.' }),
                            stops: arrayOf({
                                type: 'object',
                                required: ['stopPointId', 'name', 'lat', 'lon'],
                                properties: {
                                    stopPointId: { type: 'string' },
                                    name: { type: 'string' },
                                    lat: { type: 'number' },
                                    lon: { type: 'number' },
                                },
                            }),
                        },
                    }),
                },
            },
            StopLocation: {
                type: 'object',
                title: 'Arrêt',
                description: 'Un point d’arrêt du réseau.',
                required: ['stopId'],
                properties: {
                    stopId: { type: 'string', description: 'Identifiant du point d’arrêt.', examples: ['SIBRUE'] },
                    name: { type: 'string', description: 'Libellé à renvoyer à la place du nom de l’arrêt.' },
                },
            },
            CoordinatesLocation: {
                type: 'object',
                title: 'Coordonnées',
                description: 'Un point quelconque : l’itinéraire commence ou finit à pied.',
                required: ['lat', 'lon'],
                properties: {
                    lat: { type: 'number', minimum: -90, maximum: 90, examples: [43.1035] },
                    lon: { type: 'number', minimum: -180, maximum: 180, examples: [5.8805] },
                    name: { type: 'string', description: 'Libellé du lieu, renvoyé tel quel.', examples: ['Port de La Seyne'] },
                },
            },
            Location: {
                description: 'Un arrêt (`stopId`) ou des coordonnées (`lat`, `lon`).',
                oneOf: [ref('StopLocation'), ref('CoordinatesLocation')],
            },
            RouteRequest: {
                type: 'object',
                description: 'Une demande d’itinéraire.',
                required: ['from', 'to'],
                properties: {
                    from: { ...ref('Location'), description: 'Départ.' },
                    to: { ...ref('Location'), description: 'Arrivée.' },
                    date: { type: 'string', format: 'date', description: 'Journée de service (`YYYY-MM-DD`). Par défaut : aujourd’hui.' },
                    departureTime: { ...TIME, description: 'Partir après cette heure (`HH:MM`). Par défaut : maintenant.', examples: ['08:00'] },
                    arrivalTime: { ...TIME, description: 'Arriver avant cette heure (`HH:MM`), à la place de `departureTime`.', examples: ['09:00'] },
                    wheelchair: { type: 'boolean', default: false, description: 'Uniquement des arrêts accessibles en fauteuil roulant.' },
                    maxTransfers: { type: 'integer', minimum: 0, maximum: 4, default: 2, description: 'Nombre maximal de correspondances.' },
                    maxWalkingDistance: {
                        type: 'number',
                        minimum: 0,
                        maximum: 3000,
                        default: 800,
                        description: 'Distance maximale à pied pour rejoindre le réseau et le quitter, en mètres.',
                    },
                    excludedLines: arrayOf({ type: 'string' }, { description: 'Lignes à éviter (`bus_id`).', examples: [['8M']] }),
                    maxResults: { type: 'integer', minimum: 1, maximum: 10, default: 5, description: 'Nombre d’itinéraires.' },
                    includeGeometry: {
                        type: 'boolean',
                        default: true,
                        description: 'Tracer les marches sur les rues (serveur OSRM). Sans lui, elles restent en ligne droite.',
                    },
                },
            },
            Place: {
                type: 'object',
                description: 'Un lieu résolu : arrêt ou coordonnées.',
                required: ['lat', 'lon'],
                properties: {
                    lat: { type: 'number' },
                    lon: { type: 'number' },
                    name: { type: 'string' },
                    stopId: { type: 'string', description: 'Présent quand le lieu est un arrêt.' },
                },
            },
            StopCall: {
                type: 'object',
                description: 'Un arrêt desservi pendant un trajet.',
                required: ['stopId', 'name', 'lat', 'lon', 'time'],
                properties: {
                    stopId: { type: 'string' },
                    name: { type: 'string' },
                    lat: { type: 'number' },
                    lon: { type: 'number' },
                    time: { ...TIME, description: 'Heure de passage prévue.' },
                },
            },
            WalkStep: {
                type: 'object',
                title: 'À pied',
                description: 'Une étape à pied.',
                required: ['type', 'from', 'to', 'departureTime', 'arrivalTime', 'duration', 'distance'],
                properties: {
                    type: { type: 'string', const: 'walk' },
                    from: ref('Place'),
                    to: ref('Place'),
                    departureTime: TIME,
                    arrivalTime: TIME,
                    duration: { type: 'integer', description: 'Minutes.' },
                    distance: { type: 'integer', description: 'Mètres.' },
                    geometry: arrayOf(ref('LatLon'), { description: 'Chemin à pied.' }),
                },
            },
            BusRealtime: {
                type: 'object',
                description: 'Prévision temps réel d’une étape.',
                required: ['departureTime', 'arrivalTime', 'departureDelay', 'arrivalDelay'],
                properties: {
                    departureTime: { ...TIME, description: 'Départ estimé.' },
                    arrivalTime: { ...TIME, description: 'Arrivée estimée.' },
                    departureDelay: { type: 'integer', description: 'Secondes, positif en retard.' },
                    arrivalDelay: { type: 'integer', description: 'Secondes, positif en retard.' },
                },
            },
            BusStep: {
                type: 'object',
                title: 'En véhicule',
                description: 'Un trajet à bord d’un bus, d’un bateau ou du téléphérique (voir `mode`).',
                required: [
                    'type', 'tripId', 'line', 'lineName', 'color', 'textColor', 'mode', 'headsign', 'from', 'to', 'departureTime',
                    'arrivalTime', 'stopsCount', 'intermediateStops', 'duration', 'distance', 'realtime', 'cancelled',
                ],
                properties: {
                    type: { type: 'string', const: 'bus' },
                    tripId: { type: 'string', description: 'Identifiant GTFS de la course.' },
                    line: { type: 'string', description: 'Numéro de la ligne.', examples: ['87'] },
                    lineName: { type: 'string' },
                    color: COLOR,
                    textColor: COLOR,
                    mode: ref('Mode'),
                    headsign: { type: 'string', description: 'Terminus de la course.' },
                    from: { type: 'object', description: 'Arrêt de montée.', properties: { stopId: { type: 'string' }, name: { type: 'string' }, lat: { type: 'number' }, lon: { type: 'number' } } },
                    to: { type: 'object', description: 'Arrêt de descente.', properties: { stopId: { type: 'string' }, name: { type: 'string' }, lat: { type: 'number' }, lon: { type: 'number' } } },
                    departureTime: { ...TIME, description: 'Départ prévu.' },
                    arrivalTime: { ...TIME, description: 'Arrivée prévue.' },
                    stopsCount: { type: 'integer', description: 'Nombre d’arrêts parcourus entre la montée et la descente.' },
                    intermediateStops: arrayOf(ref('StopCall'), { description: 'Arrêts desservis entre la montée et la descente (exclues).' }),
                    duration: { type: 'integer', description: 'Minutes.' },
                    distance: { type: 'integer', description: 'Mètres, le long du tracé.' },
                    realtime: { oneOf: [ref('BusRealtime'), { type: 'null' }], description: 'Prévision temps réel, `null` si la course n’est pas suivie.' },
                    cancelled: { type: 'boolean', description: 'Course annoncée supprimée.' },
                    geometry: arrayOf(ref('LatLon'), { description: 'Tracé officiel entre les deux arrêts.' }),
                },
            },
            RouteStep: {
                description: 'Une étape, selon `type`.',
                oneOf: [ref('BusStep'), ref('WalkStep')],
                discriminator: { propertyName: 'type', mapping: { bus: '#/components/schemas/BusStep', walk: '#/components/schemas/WalkStep' } },
            },
            RouteOption: {
                type: 'object',
                description: 'Un itinéraire.',
                required: ['departureTime', 'arrivalTime', 'duration', 'transfers', 'walkingDistance', 'steps', 'alerts', 'score'],
                properties: {
                    departureTime: { ...TIME, description: 'Heure à laquelle quitter le départ, juste à temps pour le premier véhicule.' },
                    arrivalTime: { ...TIME, description: 'Heure d’arrivée.' },
                    duration: { type: 'integer', description: 'Durée totale, en minutes.' },
                    transfers: { type: 'integer', description: 'Nombre de correspondances.' },
                    walkingDistance: { type: 'integer', description: 'Distance totale à pied, en mètres.' },
                    steps: arrayOf(ref('RouteStep')),
                    alerts: arrayOf({ type: 'string' }, { description: 'Identifiants des perturbations des lignes empruntées (voir `alerts` de la réponse).' }),
                    score: { type: 'number', description: 'Durée plus une pénalité de 10 min par correspondance : plus bas, c’est mieux.' },
                },
            },
            RouteResponse: {
                type: 'object',
                description: 'Les itinéraires trouvés.',
                required: ['from', 'to', 'serviceDate', 'departureTime', 'routes', 'alerts', 'warnings', 'calculationTime'],
                properties: {
                    from: ref('Place'),
                    to: ref('Place'),
                    serviceDate: { type: 'string', format: 'date' },
                    departureTime: { ...TIME, description: 'Heure demandée.' },
                    arrivalTime: { ...TIME, description: 'Heure d’arrivée demandée (recherches « arriver avant »).' },
                    routes: arrayOf(ref('RouteOption'), { description: 'Itinéraires, triés par heure d’arrivée.' }),
                    alerts: arrayOf(ref('ServiceAlert'), { description: 'Perturbations citées par les itinéraires.' }),
                    warnings: arrayOf({ type: 'string' }, { description: 'Avertissements lisibles (en français) : aucun arrêt proche, aucun résultat…' }),
                    calculationTime: { type: 'integer', description: 'Durée du calcul, en millisecondes.' },
                },
            },
            RouteResult: {
                type: 'object',
                required: ['success', 'data'],
                properties: { success: { type: 'boolean', const: true }, data: ref('RouteResponse') },
            },
            IsochroneStop: {
                type: 'object',
                required: ['stopPointId', 'name', 'lat', 'lon', 'duration', 'transfers'],
                properties: {
                    stopPointId: { type: 'string' },
                    name: { type: 'string' },
                    lat: { type: 'number' },
                    lon: { type: 'number' },
                    duration: { type: 'integer', description: 'Minutes depuis le départ.' },
                    transfers: { type: 'integer', description: 'Correspondances nécessaires.' },
                },
            },
            Isochrone: {
                type: 'object',
                description: 'Les arrêts atteignables depuis un lieu.',
                required: ['origin', 'serviceDate', 'departureTime', 'maxDuration', 'calculationTime', 'stops'],
                properties: {
                    origin: ref('Place'),
                    serviceDate: { type: 'string', format: 'date' },
                    departureTime: TIME,
                    maxDuration: { type: 'integer', description: 'Minutes.' },
                    calculationTime: { type: 'integer', description: 'Millisecondes.' },
                    stops: arrayOf(ref('IsochroneStop'), { description: 'Du plus proche au plus lointain.' }),
                },
            },
            Vehicle: {
                type: 'object',
                description: 'Un véhicule en circulation.',
                required: [
                    'id', 'label', 'tripId', 'line', 'lineName', 'color', 'textColor', 'mode', 'headsign', 'lat', 'lon', 'bearing', 'speed',
                    'delay', 'status', 'nextStop', 'updatedAt',
                ],
                properties: {
                    id: { type: 'string', description: 'Identifiant du véhicule.' },
                    label: nullable({ type: 'string', description: 'Numéro de parc.' }),
                    tripId: nullable({ type: 'string', description: 'Course effectuée.' }),
                    line: nullable({ type: 'string', description: 'Numéro de la ligne.', examples: ['87'] }),
                    lineName: nullable({ type: 'string' }),
                    color: { ...COLOR, description: 'Couleur de la ligne (gris si inconnue).' },
                    textColor: COLOR,
                    mode: ref('Mode'),
                    headsign: nullable({ type: 'string', description: 'Destination.' }),
                    lat: { type: 'number' },
                    lon: { type: 'number' },
                    bearing: nullable({ type: 'number', description: 'Cap en degrés, dans le sens horaire depuis le nord.' }),
                    speed: nullable({ type: 'number', description: 'Vitesse en km/h.' }),
                    delay: nullable({ type: 'integer', description: 'Retard en secondes, positif en retard.' }),
                    status: { type: ['string', 'null'], enum: ['INCOMING_AT', 'STOPPED_AT', 'IN_TRANSIT_TO', null], description: 'Position par rapport à `nextStop`.' },
                    nextStop: {
                        oneOf: [{ type: 'object', properties: { stopPointId: { type: 'string' }, name: { type: 'string' } } }, { type: 'null' }],
                        description: 'Prochain arrêt.',
                    },
                    updatedAt: nullable({ type: 'string', format: 'date-time', description: 'Date de la position.' }),
                },
            },
            VehicleList: {
                type: 'object',
                required: ['updatedAt', 'count', 'vehicles'],
                properties: {
                    updatedAt: nullable({ type: 'string', format: 'date-time', description: 'Date du flux de positions.' }),
                    count: { type: 'integer', description: 'Nombre de véhicules renvoyés.' },
                    vehicles: arrayOf(ref('Vehicle')),
                },
            },
            ServiceAlert: {
                type: 'object',
                description: 'Une perturbation.',
                required: ['id', 'title', 'description', 'url', 'cause', 'effect', 'start', 'end', 'active', 'lines', 'stops'],
                properties: {
                    id: { type: 'string' },
                    title: { type: 'string', description: 'Titre.' },
                    description: { type: 'string', description: 'Texte complet, avec des retours à la ligne.' },
                    url: nullable({ type: 'string', format: 'uri', description: 'Plan de déviation ou page d’information.' }),
                    cause: nullable({ type: 'string', description: 'Cause GTFS-RT.', examples: ['CONSTRUCTION'] }),
                    effect: nullable({ type: 'string', description: 'Effet GTFS-RT.', examples: ['REDUCED_SERVICE'] }),
                    start: nullable({ type: 'string', format: 'date-time', description: 'Début de la période en cours ou à venir.' }),
                    end: nullable({ type: 'string', format: 'date-time', description: 'Fin de cette période.' }),
                    active: { type: 'boolean', description: 'En cours (sinon à venir).' },
                    lines: arrayOf({
                        type: 'object',
                        properties: { id: { type: 'string', description: 'Numéro de la ligne.' }, color: COLOR, textColor: COLOR },
                    }),
                    stops: arrayOf({ type: 'object', properties: { stopPointId: { type: 'string' }, name: { type: 'string' } } }),
                },
            },
            AlertList: {
                type: 'object',
                required: ['alerts'],
                properties: { alerts: arrayOf(ref('ServiceAlert'), { description: 'En cours d’abord, puis à venir.' }) },
            },
            Health: {
                type: 'object',
                required: ['status', 'uptime', 'data'],
                properties: {
                    status: { type: 'string', enum: ['ok', 'degraded'], description: '`degraded` si aucun horaire n’est chargé.' },
                    uptime: { type: 'integer', description: 'Secondes depuis le démarrage.' },
                    data: {
                        type: 'object',
                        properties: {
                            serviceDate: { type: 'string', format: 'date', description: 'Journée de service en cours.' },
                            lines: { type: 'integer', description: 'Lignes en service.' },
                            stops: { type: 'integer', description: 'Points d’arrêt.' },
                            trips: { type: 'integer', description: 'Courses de la journée.' },
                        },
                    },
                },
            },
            FeedStatus: {
                type: 'object',
                description: 'Fraîcheur d’un flux temps réel.',
                required: ['fetchedAt', 'feedTimestamp', 'error'],
                properties: {
                    fetchedAt: nullable({ type: 'string', format: 'date-time', description: 'Dernière lecture réussie.' }),
                    feedTimestamp: nullable({ type: 'string', format: 'date-time', description: 'Date de génération du flux.' }),
                    error: nullable({ type: 'string', description: 'Dernière erreur de lecture.' }),
                },
            },
            DataStatus: {
                type: 'object',
                required: ['source', 'serviceDate', 'lines', 'stops', 'trips', 'realtime'],
                properties: {
                    source: {
                        type: 'object',
                        description: 'Le jeu d’horaires GTFS chargé.',
                        properties: {
                            name: { type: 'string' },
                            url: { type: 'string', format: 'uri' },
                            version: nullable({ type: 'string', description: 'Version publiée (`feed_info`).' }),
                            publisher: nullable({ type: 'string', examples: ['RATP Dev'] }),
                            downloadedAt: nullable({ type: 'string', format: 'date-time' }),
                            validity: {
                                type: 'object',
                                description: 'Période couverte par les horaires.',
                                properties: { from: nullable({ type: 'string', format: 'date' }), to: nullable({ type: 'string', format: 'date' }) },
                            },
                        },
                    },
                    serviceDate: { type: 'string', format: 'date' },
                    lines: { type: 'integer' },
                    stops: { type: 'integer' },
                    trips: { type: 'integer' },
                    realtime: {
                        type: 'object',
                        properties: {
                            enabled: { type: 'boolean' },
                            vehicles: ref('FeedStatus'),
                            tripUpdates: ref('FeedStatus'),
                            alerts: ref('FeedStatus'),
                        },
                    },
                },
            },
            DataStatusResult: {
                type: 'object',
                required: ['success', 'data'],
                properties: { success: { type: 'boolean', const: true }, data: ref('DataStatus') },
            },
        },
    },
};
