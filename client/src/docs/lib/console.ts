/** State and requests of the "Essayer" console. */
import { buildRequest, type RequestValues } from './codegen';
import { jsonContent, type Json, type Operation } from './spec';

export interface LiveResponse {
    kind: 'response';
    method: string;
    url: string;
    status: number;
    statusText: string;
    durationMs: number;
    /** Decoded body size, in bytes. */
    size: number;
    headers: [string, string][];
    json: Json | undefined;
    text: string;
}

export interface LiveError {
    kind: 'error';
    message: string;
}

export type LiveResult = LiveResponse | LiveError;

/** Named examples of the request body ("stops", "arriveBy"…). */
export function bodyExamples(op: Operation): { id: string; label: string; description?: string; value: Json }[] {
    const media = jsonContent(op.requestBody?.content);
    if (!media) return [];
    if (media.examples) {
        return Object.entries(media.examples).map(([id, example]) => ({
            id,
            label: example.summary ?? id,
            description: example.description,
            value: example.value,
        }));
    }
    return media.example !== undefined ? [{ id: 'default', label: 'Exemple', value: media.example }] : [];
}

/** Console pre-filled with the parameter examples and the first body example. */
export function initialValues(op: Operation): RequestValues {
    const params: Record<string, string> = {};
    for (const param of op.parameters) params[param.name] = param.example === undefined || param.example === null ? '' : String(param.example);
    const [example] = bodyExamples(op);
    return { params, body: example ? JSON.stringify(example.value, null, 2) : '', token: '' };
}

/** Missing required values, to warn before sending. */
export function missingValues(op: Operation, values: RequestValues): string[] {
    const missing = op.parameters.filter(p => p.required && !(values.params[p.name] ?? '').trim()).map(p => p.name);
    if (op.requestBody?.required && !values.body.trim()) missing.push('corps');
    return missing;
}

export async function sendRequest(op: Operation, values: RequestValues, baseUrl: string, signal: AbortSignal): Promise<LiveResult> {
    const request = buildRequest(op, values, baseUrl);
    if (request.bodyError) return { kind: 'error', message: `Le corps n’est pas un JSON valide : ${request.bodyError}` };
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (request.body !== undefined) headers['Content-Type'] = 'application/json';
    if (op.security && values.token.trim()) headers.Authorization = `Bearer ${values.token.trim()}`;
    const started = performance.now();
    try {
        const response = await fetch(request.url, {
            method: op.method.toUpperCase(),
            headers,
            body: request.body === undefined ? undefined : JSON.stringify(request.body),
            signal,
            cache: 'no-store',
        });
        const text = await response.text();
        const durationMs = performance.now() - started;
        let json: Json | undefined;
        try {
            json = text ? (JSON.parse(text) as Json) : undefined;
        } catch {
            json = undefined;
        }
        return {
            kind: 'response',
            method: op.method.toUpperCase(),
            url: request.url,
            status: response.status,
            statusText: response.statusText,
            durationMs,
            size: new Blob([text]).size,
            headers: [...response.headers.entries()],
            json,
            text,
        };
    } catch (error) {
        if (signal.aborted) return { kind: 'error', message: 'Requête annulée.' };
        return { kind: 'error', message: `Le serveur n’a pas répondu (${error instanceof Error ? error.message : String(error)}).` };
    }
}
