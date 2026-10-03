import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useModel } from '../lib/context';
import type { Schema, TagGroup } from '../lib/spec';
import { mergeAllOf, resolve } from '../lib/spec';
import { cn } from '../lib/utils';
import { Endpoint } from './Endpoint';
import { InlineMarkdown } from './Markdown';
import { MethodPill, PathText } from './primitives';
import { SchemaView } from './SchemaTree';

/** A tag: its introduction, the list of its endpoints, then each endpoint. */
export function TagSection({ tag }: { tag: TagGroup }) {
    return (
        <div>
            <section id={tag.id} aria-labelledby={`${tag.id}-title`} className="scroll-mt-20 border-t pb-2 pt-16 sm:pt-20">
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] xl:gap-12">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand">Référence</p>
                        <h2 id={`${tag.id}-title`} className="mt-2 text-[2rem] font-semibold tracking-tight text-foreground">
                            {tag.name}
                        </h2>
                        {tag.description && (
                            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">
                                <InlineMarkdown text={tag.description} />
                            </p>
                        )}
                        {tag.externalDocs && (
                            <a
                                href={tag.externalDocs.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
                            >
                                {tag.externalDocs.description ?? 'En savoir plus'}
                                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
                        )}
                    </div>
                    <nav aria-label={`Endpoints : ${tag.name}`} className="code-panel min-w-0 self-start overflow-hidden rounded-xl">
                        <p className="border-b border-[hsl(var(--code-border))] bg-[hsl(var(--code-header))] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                            Endpoints
                        </p>
                        <ul className="py-1.5">
                            {tag.operations.map(op => (
                                <li key={op.id}>
                                    <a
                                        href={`#${op.id}`}
                                        className="group flex items-center gap-3 px-4 py-1.5 text-[12.5px] transition-colors hover:bg-white/5"
                                    >
                                        <MethodPill method={op.method} onDark size="xs" />
                                        <PathText
                                            path={op.path}
                                            className="min-w-0 flex-1 truncate text-zinc-300 group-hover:text-zinc-50 [&_.text-brand]:text-sky-300"
                                        />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>
            </section>
            {tag.operations.map(op => (
                <Endpoint key={op.id} op={op} />
            ))}
        </div>
    );
}

function summaryOf(schema: Schema): string {
    if (schema.oneOf) return `${schema.oneOf.length} formes`;
    if (schema.enum) return `enum · ${schema.enum.length} valeurs`;
    const count = Object.keys(schema.properties ?? {}).length;
    if (count) return `${count} propriété${count > 1 ? 's' : ''}`;
    return Array.isArray(schema.type) ? schema.type.join(' | ') : (schema.type ?? 'objet');
}

function ModelCard({ name, id, schema }: { name: string; id: string; schema: Schema }) {
    const { spec } = useModel();
    const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.location.hash === `#${id}`);
    useEffect(() => {
        const onHash = () => {
            if (window.location.hash === `#${id}`) setOpen(true);
        };
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, [id]);
    const merged = mergeAllOf(spec, resolve(spec, schema));

    return (
        <li id={id} className="scroll-mt-20">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen(o => !o)}
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-subtle sm:px-5"
            >
                <ChevronRight className={cn('mt-[3px] h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                        <span className="font-mono text-sm font-semibold text-foreground">{name}</span>
                        <span className="text-xs text-muted-foreground">{summaryOf(merged)}</span>
                    </span>
                    {merged.description && (
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                            <InlineMarkdown text={merged.description} />
                        </span>
                    )}
                </span>
            </button>
            {open && (
                <div className="max-w-4xl px-4 pb-4 sm:px-5 sm:pl-12">
                    <SchemaView schema={schema} name={name} />
                </div>
            )}
        </li>
    );
}

export function Models() {
    const { schemas } = useModel();
    return (
        <section id="modeles" aria-labelledby="modeles-title" className="scroll-mt-20 border-t py-16 sm:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand">Référence</p>
            <h2 id="modeles-title" className="mt-2 text-[2rem] font-semibold tracking-tight text-foreground">
                Modèles
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">
                Les objets échangés avec l’API, tels que décrits dans la spécification OpenAPI. Les types et propriétés des réponses ci-dessus
                renvoient ici.
            </p>
            <ul className="mt-8 divide-y overflow-hidden rounded-2xl bg-surface shadow-control">
                {schemas.map(s => (
                    <ModelCard key={s.name} name={s.name} id={s.id} schema={s.schema} />
                ))}
            </ul>
        </section>
    );
}
