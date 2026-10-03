/**
 * Code samples generated from an operation and the values of the console
 * (parameters and body), so that what is shown is what "Envoyer" sends.
 */
import type { Language } from './highlight';
import { type Json, type Operation, responseTypeName } from './spec';

export type SampleLanguage = 'curl' | 'javascript' | 'python' | 'typescript';

export const SAMPLE_LANGUAGES: { id: SampleLanguage; label: string; highlight: Language }[] = [
    { id: 'curl', label: 'cURL', highlight: 'bash' },
    { id: 'javascript', label: 'JavaScript', highlight: 'javascript' },
    { id: 'python', label: 'Python', highlight: 'python' },
    { id: 'typescript', label: 'TypeScript', highlight: 'typescript' },
];

export interface RequestValues {
    /** Parameter values as typed, by name ('' = not sent). */
    params: Record<string, string>;
    /** JSON text of the body. */
    body: string;
    /** Bearer token of protected operations. */
    token: string;
}

export interface BuiltRequest {
    url: string;
    path: string;
    query: [string, string][];
    body: Json | undefined;
    bodyError: string | null;
}

/** The request described by the values: URL, query string and parsed body. */
export function buildRequest(op: Operation, values: RequestValues, baseUrl: string): BuiltRequest {
    let path = op.path;
    const query: [string, string][] = [];
    for (const param of op.parameters) {
        const value = (values.params[param.name] ?? '').trim();
        if (param.in === 'path') {
            path = path.replace(`{${param.name}}`, value ? encodeURIComponent(value) : `{${param.name}}`);
        } else if (param.in === 'query' && value !== '') {
            query.push([param.name, value]);
        }
    }
    let body: Json | undefined;
    let bodyError: string | null = null;
    if (op.requestBody && values.body.trim() !== '') {
        try {
            body = JSON.parse(values.body) as Json;
        } catch (error) {
            bodyError = error instanceof Error ? error.message : 'JSON invalide';
        }
    }
    // Commas and colons are kept readable (lines=87,8M, time=08:00).
    const encode = (text: string) => encodeURIComponent(text).replace(/%2C/gi, ',').replace(/%3A/gi, ':');
    const search = query.length ? `?${query.map(([k, v]) => `${encode(k)}=${encode(v)}`).join('&')}` : '';
    return { url: `${baseUrl}${path}${search}`, path, query, body, bodyError };
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Value as a JavaScript or Python literal, on one line when short. */
function literal(value: Json, style: 'js' | 'py', indent: string, width = 64): string {
    const inline = (v: Json): string => {
        if (v === null) return style === 'py' ? 'None' : 'null';
        if (typeof v === 'boolean') return style === 'py' ? (v ? 'True' : 'False') : String(v);
        if (typeof v === 'number') return String(v);
        if (typeof v === 'string') return style === 'py' ? JSON.stringify(v) : `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
        if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
        const entries = Object.entries(v);
        if (entries.length === 0) return '{}';
        const key = (k: string) => (style === 'js' && IDENTIFIER.test(k) ? k : JSON.stringify(k));
        const pairs = entries.map(([k, x]) => `${key(k)}: ${inline(x)}`).join(', ');
        return style === 'py' ? `{${pairs}}` : `{ ${pairs} }`;
    };
    const one = inline(value);
    if (one.length + indent.length <= width || value === null || typeof value !== 'object') return one;
    const inner = `${indent}  `;
    if (Array.isArray(value)) {
        return `[\n${value.map(v => `${inner}${literal(v, style, inner, width)},`).join('\n')}\n${indent}]`;
    }
    const key = (k: string) => (style === 'js' && IDENTIFIER.test(k) ? k : JSON.stringify(k));
    return `{\n${Object.entries(value)
        .map(([k, v]) => `${inner}${key(k)}: ${literal(v, style, inner, width)},`)
        .join('\n')}\n${indent}}`;
}

/** JSON on one line, with spaces. */
function flatJson(value: Json): string {
    if (Array.isArray(value)) return `[${value.map(flatJson).join(', ')}]`;
    if (value !== null && typeof value === 'object') {
        const entries = Object.entries(value);
        return entries.length ? `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${flatJson(v)}`).join(', ')} }` : '{}';
    }
    return JSON.stringify(value);
}

/** Pretty JSON, short objects and arrays kept on one line. */
export function prettyJson(value: Json, indent = '', width = 72): string {
    const flat = flatJson(value);
    if (value === null || typeof value !== 'object' || flat.length + indent.length <= width) return flat;
    const inner = `${indent}  `;
    if (Array.isArray(value)) {
        return `[\n${value.map(v => `${inner}${prettyJson(v, inner, width)}`).join(',\n')}\n${indent}]`;
    }
    return `{\n${Object.entries(value)
        .map(([k, v]) => `${inner}${JSON.stringify(k)}: ${prettyJson(v, inner, width)}`)
        .join(',\n')}\n${indent}}`;
}

const shellQuote = (text: string) => `'${text.replace(/'/g, `'\\''`)}'`;

export function generateSample(language: SampleLanguage, op: Operation, values: RequestValues, baseUrl: string): string {
    const request = buildRequest(op, values, baseUrl);
    const method = op.method.toUpperCase();
    const body = request.body;
    const auth = op.security !== null;
    const typeName = responseTypeName(op);

    switch (language) {
        case 'curl': {
            const lines = [`curl ${method === 'GET' ? '' : `-X ${method} `}"${request.url}"`];
            if (auth) lines.push(`-H "Authorization: Bearer $ADMIN_TOKEN"`);
            if (body !== undefined) {
                lines.push(`-H "Content-Type: application/json"`);
                lines.push(`-d ${shellQuote(prettyJson(body, '  ', 60))}`);
            }
            return lines.join(' \\\n  ');
        }
        case 'javascript': {
            const url = `'${request.url}'`;
            const options: string[] = [];
            if (method !== 'GET') options.push(`  method: '${method}',`);
            const headers: string[] = [];
            if (body !== undefined) headers.push(`'Content-Type': 'application/json'`);
            if (auth) headers.push('Authorization: `Bearer ${ADMIN_TOKEN}`');
            if (headers.length) options.push(`  headers: { ${headers.join(', ')} },`);
            if (body !== undefined) options.push(`  body: JSON.stringify(${literal(body, 'js', '  ', 56)}),`);
            const call = options.length ? `fetch(${url}, {\n${options.join('\n')}\n})` : `fetch(${url})`;
            const result = typeName && !typeName.endsWith('[]') && /Result$/.test(typeName) ? 'const { data } = await response.json();' : 'const data = await response.json();';
            return [`const response = await ${call};`, result, '', 'console.log(data);'].join('\n');
        }
        case 'python': {
            const url = `"${baseUrl}${request.path}"`;
            const args = [`    ${url},`];
            if (request.query.length) {
                const params = Object.fromEntries(request.query.map(([k, v]) => [k, /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v])) as Json;
                args.push(`    params=${literal(params, 'py', '    ', 64)},`);
            }
            if (auth) args.push('    headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},');
            if (body !== undefined) args.push(`    json=${literal(body, 'py', '    ', 64)},`);
            const call = args.length === 1 ? `requests.${op.method}(${url})` : `requests.${op.method}(\n${args.join('\n')}\n)`;
            return ['import requests', '', `response = ${call}`, 'response.raise_for_status()', 'data = response.json()'].join('\n');
        }
        case 'typescript': {
            const lines: string[] = [];
            const type = typeName?.replace(/\[\]$/, '');
            if (type) {
                lines.push(`// Types : npx openapi-typescript ${baseUrl}/api/openapi.json -o miawstral.d.ts`);
                lines.push(`import type { components } from './miawstral';`);
                lines.push(`type ${type} = components['schemas']['${type}'];`, '');
            }
            lines.push(`const url = new URL('${request.path}', '${baseUrl}');`);
            for (const [k, v] of request.query) lines.push(`url.searchParams.set('${k}', '${v.replace(/'/g, "\\'")}');`);
            lines.push('');
            const options: string[] = [];
            if (method !== 'GET') options.push(`  method: '${method}',`);
            const headers: string[] = [];
            if (body !== undefined) headers.push(`'Content-Type': 'application/json'`);
            if (auth) headers.push('Authorization: `Bearer ${process.env.ADMIN_TOKEN}`');
            if (headers.length) options.push(`  headers: { ${headers.join(', ')} },`);
            if (body !== undefined) options.push(`  body: JSON.stringify(${literal(body, 'js', '  ', 56)}),`);
            lines.push(options.length ? `const response = await fetch(url, {\n${options.join('\n')}\n});` : 'const response = await fetch(url);');
            lines.push('if (!response.ok) {');
            lines.push('  const { message } = (await response.json()) as { message: string };');
            lines.push('  throw new Error(message);');
            lines.push('}');
            lines.push(type ? `const data: ${typeName} = await response.json();` : 'const data = await response.json();');
            return lines.join('\n');
        }
    }
}
