import type {
    ApiErrorBody,
    DeparturesResponse,
    LineSummary,
    RouteRequest,
    RouteResponse,
    StopSummary,
} from '@/types';

/** Base URL of the backend. Empty string = same origin (the Vite dev server proxies `/api`). */
const API_BASE_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
    /** HTTP status, or 0 when the server could not be reached. */
    readonly status: number;
    readonly details?: unknown;

    constructor(message: string, status: number, details?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.details = details;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isErrorBody(value: unknown): value is ApiErrorBody {
    return isRecord(value) && value.success === false && typeof value.message === 'string';
}

export function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
}

/** Human readable (French) message for any thrown value. */
export function getErrorMessage(error: unknown): string {
    if (error instanceof ApiError) return error.message;
    if (error instanceof Error && error.message) return error.message;
    return 'Une erreur inattendue est survenue.';
}

type Query = Record<string, string | number | undefined>;

function buildUrl(path: string, query?: Query): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString();
    return `${API_BASE_URL}${path}${qs ? `?${qs}` : ''}`;
}

async function readBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
}

async function request<T>(path: string, init: RequestInit & { query?: Query } = {}): Promise<T> {
    const { query, headers, ...rest } = init;
    let response: Response;
    try {
        response = await fetch(buildUrl(path, query), {
            ...rest,
            headers: { Accept: 'application/json', ...headers },
        });
    } catch (error) {
        if (isAbortError(error)) throw error;
        throw new ApiError('Impossible de joindre le serveur. Vérifiez votre connexion.', 0);
    }

    const body = await readBody(response);

    if (!response.ok) {
        if (isErrorBody(body)) throw new ApiError(body.message, response.status, body.details);
        if (isRecord(body) && typeof body.message === 'string') {
            throw new ApiError(body.message, response.status);
        }
        const fallback =
            response.status >= 500
                ? `Le serveur a rencontré une erreur (${response.status}).`
                : `Requête refusée par le serveur (${response.status}).`;
        throw new ApiError(fallback, response.status);
    }

    if (isErrorBody(body)) throw new ApiError(body.message, response.status, body.details);
    return body as T;
}

/** Unwraps a `{ success: true, data }` envelope. */
function unwrap<T>(body: unknown): T {
    if (isRecord(body) && body.success === true && 'data' in body) return body.data as T;
    throw new ApiError('Réponse inattendue du serveur.', 200);
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export function getStops(signal?: AbortSignal): Promise<StopSummary[]> {
    return request<StopSummary[]>('/api/stops', { signal });
}

export function searchStops(q: string, limit = 10, signal?: AbortSignal): Promise<StopSummary[]> {
    return request<StopSummary[]>('/api/stops/search', { query: { q, limit }, signal });
}

export function getNearbyStops(
    lat: number,
    lon: number,
    radius: number,
    signal?: AbortSignal,
): Promise<StopSummary[]> {
    return request<StopSummary[]>('/api/stops/nearby', {
        query: { lat: lat.toFixed(6), lon: lon.toFixed(6), radius },
        signal,
    });
}

/** Next departures at a stop from `time` ("HH:MM", the server defaults to now). */
export function getDepartures(
    stopId: string,
    time: string | undefined,
    limit = 10,
    signal?: AbortSignal,
): Promise<DeparturesResponse> {
    return request<DeparturesResponse>(`/api/stops/${encodeURIComponent(stopId)}/departures`, {
        query: { time, limit },
        signal,
    });
}

export function getLines(signal?: AbortSignal): Promise<LineSummary[]> {
    return request<LineSummary[]>('/api/lines', { signal });
}

export async function calculateRoutes(body: RouteRequest, signal?: AbortSignal): Promise<RouteResponse> {
    const envelope = await request<unknown>('/api/routes/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
    });
    return unwrap<RouteResponse>(envelope);
}

export interface DataStatus {
    loadedAt: string;
    lines: number;
    stops: number;
    newestTimetable: string | null;
}

export async function getDataStatus(signal?: AbortSignal): Promise<DataStatus> {
    return unwrap<DataStatus>(await request<unknown>('/api/data/status', { signal }));
}
