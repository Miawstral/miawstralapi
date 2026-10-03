/**
 * The subset of OpenAPI 3.1 used by the documentation page, and the model the
 * page is built from (operations grouped by tag, guides, schemas).
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface Schema {
    $ref?: string;
    type?: string | string[];
    title?: string;
    description?: string;
    format?: string;
    pattern?: string;
    enum?: Json[];
    const?: Json;
    default?: Json;
    example?: Json;
    examples?: Json[];
    minimum?: number;
    maximum?: number;
    minLength?: number;
    minItems?: number;
    maxItems?: number;
    properties?: Record<string, Schema>;
    required?: string[];
    items?: Schema;
    prefixItems?: Schema[];
    oneOf?: Schema[];
    anyOf?: Schema[];
    allOf?: Schema[];
    discriminator?: { propertyName: string; mapping?: Record<string, string> };
}

export interface Parameter {
    $ref?: string;
    name: string;
    in: 'path' | 'query' | 'header' | 'cookie';
    required?: boolean;
    description?: string;
    schema?: Schema;
    example?: Json;
}

export interface Example {
    summary?: string;
    description?: string;
    value: Json;
}

export interface MediaType {
    schema?: Schema;
    example?: Json;
    examples?: Record<string, Example>;
}

export interface Header {
    $ref?: string;
    description?: string;
    schema?: Schema;
}

export interface ResponseObject {
    $ref?: string;
    description?: string;
    headers?: Record<string, Header>;
    content?: Record<string, MediaType>;
}

export interface RequestBody {
    required?: boolean;
    description?: string;
    content?: Record<string, MediaType>;
}

export interface Badge {
    label: string;
    tone: 'live' | 'limit' | 'cache' | 'admin';
}

export type PreviewKind = 'vehicles' | 'isochrone' | 'shape' | 'route';

export interface OperationObject {
    operationId?: string;
    tags?: string[];
    summary?: string;
    description?: string;
    parameters?: Parameter[];
    requestBody?: RequestBody;
    responses?: Record<string, ResponseObject>;
    security?: Record<string, string[]>[];
    'x-badges'?: Badge[];
    'x-preview'?: PreviewKind;
}

export interface Feature {
    icon: string;
    title: string;
    text: string;
}

export interface OpenApiSpec {
    openapi: string;
    info: {
        title: string;
        version: string;
        summary?: string;
        description?: string;
        license?: { name: string; identifier?: string; url?: string };
        contact?: { name?: string; url?: string };
        'x-features'?: Feature[];
        'x-quickstart'?: { operationId: string };
    };
    servers?: { url: string; description?: string }[];
    tags?: { name: string; description?: string; externalDocs?: { description?: string; url: string } }[];
    paths: Record<string, Partial<Record<HttpMethod, OperationObject>>>;
    components?: {
        schemas?: Record<string, Schema>;
        parameters?: Record<string, Parameter>;
        responses?: Record<string, ResponseObject>;
        headers?: Record<string, Header>;
        securitySchemes?: Record<string, { type: string; scheme?: string; description?: string }>;
    };
}

export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface Operation {
    /** Anchor of the section, e.g. "get-api-stops-id-departures". */
    id: string;
    operationId: string;
    method: HttpMethod;
    path: string;
    tag: string;
    summary: string;
    description: string;
    parameters: Parameter[];
    requestBody?: RequestBody;
    responses: { status: string; response: ResponseObject }[];
    badges: Badge[];
    preview?: PreviewKind;
    /** Name of the bearer security scheme, when the operation needs one. */
    security: string | null;
}

export interface TagGroup {
    name: string;
    id: string;
    description: string;
    externalDocs?: { description?: string; url: string };
    operations: Operation[];
}

export interface GuideSection {
    id: string;
    title: string;
    /** Markdown body (without its title). */
    body: string;
}

export interface DocsModel {
    spec: OpenApiSpec;
    /** Markdown before the first "## " heading of the description. */
    intro: string;
    guides: GuideSection[];
    tags: TagGroup[];
    operations: Operation[];
    schemas: { name: string; id: string; schema: Schema }[];
}

/** "Limites et bonnes pratiques" → "limites-et-bonnes-pratiques". */
export function slugify(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[’']/g, '-')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export const operationAnchor = (method: string, path: string) => slugify(`${method} ${path.replace(/[{}]/g, '')}`);
export const schemaAnchor = (name: string) => `schema-${name}`;
export const tagAnchor = (name: string) => `tag-${slugify(name)}`;

/** Text without accents, lowercase: for searches. */
export const normalize = (text: string) =>
    text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();

function lookup(spec: OpenApiSpec, ref: string): unknown {
    if (!ref.startsWith('#/')) return undefined;
    let current: unknown = spec;
    for (const part of ref.slice(2).split('/')) {
        if (current === null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part.replace(/~1/g, '/').replace(/~0/g, '~')];
    }
    return current;
}

/** Follows `$ref`s; sibling keys of the reference (description, example…) win, as in OpenAPI 3.1. */
export function resolve<T extends { $ref?: string }>(spec: OpenApiSpec, value: T): T {
    let current = value;
    const seen = new Set<string>();
    while (current?.$ref && !seen.has(current.$ref)) {
        seen.add(current.$ref);
        const { $ref, ...siblings } = current;
        const target = lookup(spec, $ref) as T | undefined;
        if (!target) break;
        current = { ...target, ...siblings } as T;
    }
    return current;
}

export const refName = (ref: string | undefined) => (ref ? ref.slice(ref.lastIndexOf('/') + 1) : null);

/** Splits Markdown into its intro and its "## " sections. */
export function splitSections(markdown: string): { intro: string; sections: GuideSection[] } {
    const lines = markdown.split('\n');
    const intro: string[] = [];
    const sections: GuideSection[] = [];
    let inFence = false;
    for (const line of lines) {
        if (line.startsWith('```')) inFence = !inFence;
        const heading = !inFence && /^## (.+)$/.exec(line);
        if (heading) {
            sections.push({ id: slugify(heading[1]), title: heading[1].trim(), body: '' });
        } else if (sections.length > 0) {
            sections[sections.length - 1].body += `${line}\n`;
        } else {
            intro.push(line);
        }
    }
    return { intro: intro.join('\n').trim(), sections: sections.map(s => ({ ...s, body: s.body.trim() })) };
}

export function buildModel(spec: OpenApiSpec): DocsModel {
    const { intro, sections } = splitSections(spec.info.description ?? '');
    const operations: Operation[] = [];
    for (const [path, item] of Object.entries(spec.paths)) {
        for (const method of HTTP_METHODS) {
            const op = item[method];
            if (!op) continue;
            const security = op.security?.flatMap(s => Object.keys(s))[0] ?? null;
            operations.push({
                id: operationAnchor(method, path),
                operationId: op.operationId ?? operationAnchor(method, path),
                method,
                path,
                tag: op.tags?.[0] ?? 'Autres',
                summary: op.summary ?? `${method.toUpperCase()} ${path}`,
                description: op.description ?? '',
                parameters: (op.parameters ?? []).map(p => resolve(spec, p)),
                requestBody: op.requestBody,
                responses: Object.entries(op.responses ?? {}).map(([status, response]) => ({
                    status,
                    response: resolve(spec, response),
                })),
                badges: op['x-badges'] ?? [],
                preview: op['x-preview'],
                security,
            });
        }
    }

    const tagNames = [...(spec.tags ?? []).map(t => t.name)];
    for (const op of operations) if (!tagNames.includes(op.tag)) tagNames.push(op.tag);
    const tags = tagNames
        .map(name => {
            const tag = spec.tags?.find(t => t.name === name);
            return {
                name,
                id: tagAnchor(name),
                description: tag?.description ?? '',
                externalDocs: tag?.externalDocs,
                operations: operations.filter(op => op.tag === name),
            };
        })
        .filter(t => t.operations.length > 0);

    return {
        spec,
        intro,
        guides: sections,
        tags,
        // In the order of the page.
        operations: tags.flatMap(t => t.operations),
        schemas: Object.entries(spec.components?.schemas ?? {}).map(([name, schema]) => ({ name, id: schemaAnchor(name), schema })),
    };
}

/** Content of the JSON media type of a request body or response. */
export function jsonContent(content: Record<string, MediaType> | undefined): MediaType | undefined {
    if (!content) return undefined;
    return content['application/json'] ?? Object.values(content)[0];
}

/** Name of the schema of a successful response: "DepartureBoard", "StopSummary[]"… */
export function responseTypeName(op: Operation): string | null {
    const success = op.responses.find(r => r.status.startsWith('2'));
    const schema = jsonContent(success?.response.content)?.schema;
    if (!schema) return null;
    if (schema.$ref) return refName(schema.$ref);
    if (schema.type === 'array' && schema.items?.$ref) return `${refName(schema.items.$ref)}[]`;
    return null;
}

/** First example of a schema, if any. */
export function schemaExample(schema: Schema | undefined): Json | undefined {
    if (!schema) return undefined;
    if (schema.example !== undefined) return schema.example;
    if (schema.examples && schema.examples.length > 0) return schema.examples[0];
    return undefined;
}

export const typesOf = (schema: Schema): string[] => (Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : []);

/** Merges `allOf` members into one object schema. */
export function mergeAllOf(spec: OpenApiSpec, schema: Schema): Schema {
    if (!schema.allOf) return schema;
    const { allOf, ...rest } = schema;
    const merged: Schema = { ...rest, type: 'object', properties: {}, required: [...(rest.required ?? [])] };
    for (const part of allOf) {
        const resolved = mergeAllOf(spec, resolve(spec, part));
        Object.assign(merged.properties!, resolved.properties);
        merged.required!.push(...(resolved.required ?? []));
        if (!merged.description && resolved.description) merged.description = resolved.description;
    }
    return merged;
}
