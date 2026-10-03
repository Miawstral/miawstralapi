import type { Parameter, Schema } from '../lib/spec';
import { typesOf } from '../lib/spec';
import { InlineMarkdown } from './Markdown';

const LOCATION_TITLES: Record<string, string> = {
    path: 'Paramètres de chemin',
    query: 'Paramètres de requête',
    header: 'En-têtes',
    cookie: 'Cookies',
};

function typeOf(schema: Schema | undefined): string {
    if (!schema) return 'string';
    const main = typesOf(schema).find(t => t !== 'null') ?? 'string';
    return main;
}

function Meta({ param }: { param: Parameter }) {
    const schema = param.schema ?? {};
    const items: { label: string; value: string }[] = [];
    if (schema.default !== undefined) items.push({ label: 'Défaut', value: String(schema.default) });
    if (schema.minimum !== undefined && schema.maximum !== undefined) items.push({ label: 'Entre', value: `${schema.minimum} et ${schema.maximum}` });
    if (schema.pattern === '^\\d{2}:\\d{2}$') items.push({ label: 'Format', value: 'HH:MM' });
    else if (schema.format === 'date') items.push({ label: 'Format', value: 'YYYY-MM-DD' });
    const example = param.example ?? schema.example ?? schema.examples?.[0];
    if (example !== undefined) items.push({ label: 'Exemple', value: String(example) });
    if (items.length === 0) return null;
    return (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            {items.map(item => (
                <span key={item.label} className="inline-flex items-baseline gap-1">
                    <span>{item.label}</span>
                    <code className="break-all rounded bg-muted px-1 py-px font-mono text-[11px] text-foreground">{item.value}</code>
                </span>
            ))}
        </div>
    );
}

/** The parameters of an operation, grouped by location. */
export function ParamList({ parameters }: { parameters: Parameter[] }) {
    const groups = ['path', 'query', 'header', 'cookie']
        .map(location => ({ location, params: parameters.filter(p => p.in === location) }))
        .filter(g => g.params.length > 0);
    return (
        <div className="space-y-6">
            {groups.map(group => (
                <div key={group.location}>
                    <h4 className="mb-2 text-[13px] font-semibold text-foreground">{LOCATION_TITLES[group.location]}</h4>
                    <ul className="divide-y overflow-hidden rounded-xl border bg-surface">
                        {group.params.map(param => (
                            <li key={param.name} className="px-4 py-3.5">
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                    <span className="font-mono text-[13px] font-semibold text-foreground">{param.name}</span>
                                    <span className="font-mono text-xs text-muted-foreground">{typeOf(param.schema)}</span>
                                    {param.required ? (
                                        <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">requis</span>
                                    ) : (
                                        <span className="text-[11px] text-muted-foreground/80">facultatif</span>
                                    )}
                                </div>
                                {param.description && (
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                        <InlineMarkdown text={param.description} />
                                    </p>
                                )}
                                <Meta param={param} />
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}
