import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useModel } from '../lib/context';
import { mergeAllOf, refName, resolve, schemaAnchor, typesOf, type Json, type OpenApiSpec, type Schema } from '../lib/spec';
import { cn } from '../lib/utils';
import { InlineMarkdown } from './Markdown';

interface Described {
    /** Displayed type, e.g. "string", "array", "object". */
    label: string;
    /** Name of the referenced schema, linked to the models. */
    ref: string | null;
    array: boolean;
    nullable: boolean;
    /** Resolved schema (the items for arrays). */
    target: Schema;
    /** Object to expand. */
    object: Schema | null;
    /** Alternatives to expand (oneOf). */
    variants: { name: string | null; schema: Schema }[];
}

const isNull = (s: Schema) => s.type === 'null';

/** Type of a schema, following references, nullable variants, arrays and allOf. */
function describe(spec: OpenApiSpec, schema: Schema): Described {
    let nullable = false;
    let current = schema;
    let ref = refName(current.$ref);
    current = resolve(spec, current);

    const alternatives = current.oneOf ?? current.anyOf;
    if (alternatives) {
        const real = alternatives.filter(s => !isNull(s));
        nullable = real.length < alternatives.length;
        if (real.length === 1) {
            ref = refName(real[0].$ref) ?? ref;
            current = { ...resolve(spec, real[0]), description: current.description ?? resolve(spec, real[0]).description };
        }
    }
    current = mergeAllOf(spec, current);

    const types = typesOf(current);
    if (types.includes('null')) nullable = true;
    const main = types.find(t => t !== 'null') ?? (current.properties ? 'object' : current.oneOf ? 'object' : '');

    if (main === 'array' && current.items) {
        const item = describe(spec, current.items);
        return {
            label: item.ref ? item.ref : item.label,
            ref: item.ref,
            array: true,
            nullable,
            target: item.target,
            object: item.object,
            variants: item.variants,
        };
    }

    const variants = (current.oneOf ?? current.anyOf ?? [])
        .filter(s => !isNull(s))
        .map(s => ({ name: refName(s.$ref), schema: mergeAllOf(spec, resolve(spec, s)) }));

    return {
        label: main || (variants.length ? 'object' : 'any'),
        ref,
        array: false,
        nullable,
        target: current,
        object: current.properties ? current : null,
        variants: variants.length > 1 ? variants : [],
    };
}

const formatValue = (value: Json) => (typeof value === 'string' ? value : JSON.stringify(value));

function Constraints({ schema }: { schema: Schema }) {
    const items: { label: string; value: string }[] = [];
    if (schema.default !== undefined) items.push({ label: 'Défaut', value: formatValue(schema.default) });
    if (schema.minimum !== undefined && schema.maximum !== undefined) items.push({ label: 'Entre', value: `${schema.minimum} et ${schema.maximum}` });
    else if (schema.minimum !== undefined) items.push({ label: 'Min.', value: String(schema.minimum) });
    else if (schema.maximum !== undefined) items.push({ label: 'Max.', value: String(schema.maximum) });
    if (schema.pattern === '^\\d{2}:\\d{2}$') items.push({ label: 'Format', value: 'HH:MM' });
    else if (schema.format) items.push({ label: 'Format', value: schema.format === 'date' ? 'YYYY-MM-DD' : schema.format });
    else if (schema.pattern) items.push({ label: 'Motif', value: schema.pattern });
    if (schema.const !== undefined) items.push({ label: 'Valeur', value: formatValue(schema.const) });
    const example = schema.example ?? schema.examples?.[0];
    if (example !== undefined && typeof example !== 'object') items.push({ label: 'Exemple', value: formatValue(example) });
    else if (Array.isArray(example) && example.every(v => typeof v !== 'object')) items.push({ label: 'Exemple', value: JSON.stringify(example) });

    const values = schema.enum?.filter(v => v !== null);
    if (items.length === 0 && !values?.length) return null;
    return (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            {items.map(item => (
                <span key={item.label} className="inline-flex min-w-0 items-baseline gap-1">
                    <span>{item.label}</span>
                    <code className="break-all rounded bg-muted px-1 py-px font-mono text-[11px] text-foreground">{item.value}</code>
                </span>
            ))}
            {values && values.length > 0 && (
                <span className="inline-flex flex-wrap items-center gap-1">
                    <span>Valeurs</span>
                    {values.map(v => (
                        <code key={String(v)} className="rounded border bg-surface px-1.5 py-px font-mono text-[11px] text-foreground">
                            {formatValue(v)}
                        </code>
                    ))}
                </span>
            )}
        </div>
    );
}

function TypeLabel({ info }: { info: Described }) {
    const name = info.ref ? (
        <a href={`#${schemaAnchor(info.ref)}`} className="text-brand hover:underline">
            {info.ref}
        </a>
    ) : (
        info.label
    );
    return (
        <span className="font-mono text-xs text-muted-foreground">
            {info.array ? (
                <>
                    {info.ref ? null : 'array<'}
                    {name}
                    {info.ref ? '[]' : '>'}
                </>
            ) : (
                name
            )}
            {info.nullable && <span className="text-muted-foreground/80"> | null</span>}
        </span>
    );
}

function Variants({ variants, depth, trail }: { variants: Described['variants']; depth: number; trail: string[] }) {
    const [index, setIndex] = useState(0);
    const current = variants[Math.min(index, variants.length - 1)];
    return (
        <div>
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
                <span className="text-xs text-muted-foreground">Une des formes</span>
                <div className="flex gap-1 rounded-lg bg-muted p-0.5" role="group" aria-label="Formes possibles">
                    {variants.map((variant, i) => (
                        <button
                            key={i}
                            type="button"
                            aria-pressed={i === index}
                            onClick={() => setIndex(i)}
                            className={cn(
                                'h-6 rounded-md px-2 text-xs font-medium transition-colors',
                                i === index ? 'bg-surface text-foreground shadow-control' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {variant.schema.title ?? variant.name ?? `Forme ${i + 1}`}
                        </button>
                    ))}
                </div>
            </div>
            {current.schema.description && (
                <p className="px-4 pt-3 text-xs text-muted-foreground">
                    <InlineMarkdown text={current.schema.description} />
                </p>
            )}
            <PropertyList schema={current.schema} depth={depth} trail={current.name ? [...trail, current.name] : trail} />
        </div>
    );
}

function Property({
    name,
    schema,
    required,
    depth,
    trail,
}: {
    name: string;
    schema: Schema;
    required: boolean;
    depth: number;
    trail: string[];
}) {
    const { spec } = useModel();
    const [open, setOpen] = useState(false);
    const info = describe(spec, schema);
    const own = resolve(spec, schema);
    const description = schema.description ?? own.description ?? info.target.description;
    const looping = info.ref !== null && trail.includes(info.ref);
    const childCount = info.object ? Object.keys(info.object.properties ?? {}).length : 0;
    const expandable = !looping && depth < 6 && (childCount > 0 || info.variants.length > 1);
    const constraintSource: Schema = { ...info.target, ...own, enum: info.target.enum ?? own.enum };

    return (
        <li className="px-4 py-3.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="break-all font-mono text-[13px] font-semibold text-foreground">{name}</span>
                <TypeLabel info={info} />
                {required && <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">requis</span>}
            </div>
            {description && (
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    <InlineMarkdown text={description} />
                </p>
            )}
            <Constraints schema={constraintSource} />
            {expandable && (
                <div className="mt-2.5">
                    <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpen(o => !o)}
                        className={cn(
                            'inline-flex h-7 items-center gap-1.5 rounded-full border bg-surface px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground',
                            open && 'rounded-b-none rounded-t-lg border-b-0 bg-subtle text-foreground',
                        )}
                    >
                        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} aria-hidden="true" />
                        {open ? 'Masquer' : 'Afficher'}{' '}
                        {info.variants.length > 1 ? `les ${info.variants.length} formes` : `les ${childCount} propriétés`}
                    </button>
                    {open && (
                        <div className="overflow-hidden rounded-b-xl rounded-tr-xl border bg-subtle/60">
                            {info.variants.length > 1 ? (
                                <Variants variants={info.variants} depth={depth + 1} trail={info.ref ? [...trail, info.ref] : trail} />
                            ) : (
                                <PropertyList schema={info.object!} depth={depth + 1} trail={info.ref ? [...trail, info.ref] : trail} />
                            )}
                        </div>
                    )}
                </div>
            )}
        </li>
    );
}

function PropertyList({ schema, depth, trail }: { schema: Schema; depth: number; trail: string[] }) {
    const properties = Object.entries(schema.properties ?? {});
    const required = new Set(schema.required ?? []);
    if (properties.length === 0) return <p className="px-4 py-3 text-sm text-muted-foreground">Aucune propriété.</p>;
    return (
        <ul className="divide-y">
            {properties.map(([name, property]) => (
                <Property key={name} name={name} schema={property} required={required.has(name)} depth={depth} trail={trail} />
            ))}
        </ul>
    );
}

/** A schema as an explorable list of properties. */
export function SchemaView({ schema, className, name }: { schema: Schema; className?: string; name?: string }) {
    const { spec } = useModel();
    const info = describe(spec, schema);
    const trail = [name, info.ref].filter((n): n is string => Boolean(n));
    const header =
        info.array || info.ref ? (
            <div className="flex flex-wrap items-center gap-2 border-b bg-subtle px-4 py-2.5 text-xs text-muted-foreground">
                <span>{info.array ? 'Tableau de' : 'Objet'}</span>
                <TypeLabel info={{ ...info, array: false }} />
            </div>
        ) : null;

    let body;
    if (info.variants.length > 1) body = <Variants variants={info.variants} depth={1} trail={trail} />;
    else if (info.object) body = <PropertyList schema={info.object} depth={1} trail={trail} />;
    else
        body = (
            <div className="px-4 py-3">
                <div className="flex items-baseline gap-2">
                    <TypeLabel info={info} />
                </div>
                <Constraints schema={info.target} />
            </div>
        );

    return (
        <div className={cn('overflow-hidden rounded-xl border bg-surface', className)}>
            {header}
            {body}
        </div>
    );
}
