import { ArrowRight, BadgeCheck, Braces, FileJson, KeyRound, Radio, Route, Sparkles } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { tabPanelProps, useStableId } from '../lib/a11y';
import { generateSample, SAMPLE_LANGUAGES } from '../lib/codegen';
import { initialValues } from '../lib/console';
import { BASE_URL, useModel, useSampleLanguage } from '../lib/context';
import { CodeLines, Tabs } from './code';
import { InlineMarkdown, Markdown } from './Markdown';
import { CopyButton, MethodPill } from './primitives';
import { StatusCard } from './StatusCard';

const ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
    radio: Radio,
    route: Route,
    'badge-check': BadgeCheck,
    key: KeyRound,
};

/** The quickstart operation, ready to paste. */
function QuickstartCard() {
    const { spec, operations } = useModel();
    const { language, setLanguage } = useSampleLanguage();
    const idBase = useStableId('quickstart');
    const op = operations.find(o => o.operationId === spec.info['x-quickstart']?.operationId) ?? operations[0];
    if (!op) return null;
    const code = generateSample(language, op, initialValues(op), BASE_URL);
    const highlight = SAMPLE_LANGUAGES.find(l => l.id === language)?.highlight ?? 'bash';
    return (
        <div className="code-panel overflow-hidden rounded-2xl">
            <div className="flex h-11 items-center gap-2.5 border-b border-[hsl(var(--code-border))] bg-[hsl(var(--code-header))] pl-4 pr-2">
                <Sparkles className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-300">Première requête · {op.summary.toLowerCase()}</span>
                <a
                    href={`#${op.id}`}
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-zinc-50"
                >
                    Essayer <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
            </div>
            <div className="flex h-10 items-center gap-2 border-b border-[hsl(var(--code-border))] pl-2 pr-1.5">
                <Tabs
                    idBase={idBase}
                    label="Langage de l’exemple"
                    items={SAMPLE_LANGUAGES.map(l => ({ id: l.id, label: l.label }))}
                    value={language}
                    onChange={setLanguage}
                    onDark
                    className="flex-1"
                />
                <CopyButton text={code} onDark label="Copier l’exemple" />
            </div>
            <div {...tabPanelProps(idBase, language)}>
                <CodeLines code={code} language={highlight} className="max-h-72" wrap />
            </div>
            <div className="flex items-center gap-2 border-t border-[hsl(var(--code-border))] px-4 py-2.5 text-[11.5px] text-zinc-500">
                <MethodPill method={op.method} onDark size="xs" />
                <span className="truncate font-mono">{op.path}</span>
            </div>
        </div>
    );
}

export function Hero() {
    const { spec, intro, guides, operations } = useModel();
    const { info } = spec;
    const features = info['x-features'] ?? [];
    const firstGuide = guides[0];
    const firstOp = operations[0];

    return (
        <section id="introduction" aria-labelledby="hero-title" className="relative scroll-mt-20">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-50vw] -top-px h-[38rem] overflow-hidden">
                <div className="hero-glow absolute inset-0" />
                <div className="hero-grid absolute inset-0" />
            </div>

            <div className="relative grid gap-10 pb-14 pt-12 sm:pt-16 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] xl:gap-12">
                <div className="reveal min-w-0">
                    <p className="inline-flex h-7 items-center gap-2 rounded-full bg-surface/80 px-3 text-xs font-medium text-muted-foreground shadow-control backdrop-blur">
                        <span className="live-dot h-1.5 w-1.5 text-emerald-500" aria-hidden="true" />
                        {info.title}
                        <span className="h-3 w-px bg-border" aria-hidden="true" />
                        <span className="font-mono">v{info.version}</span>
                        <span className="h-3 w-px bg-border" aria-hidden="true" />
                        <span>OpenAPI {spec.openapi}</span>
                    </p>
                    <h1
                        id="hero-title"
                        className="mt-6 max-w-[42rem] text-balance text-[2rem] font-semibold leading-[1.1] tracking-[-0.032em] text-foreground sm:text-[2.6rem]"
                    >
                        {info.summary ?? info.title}
                    </h1>
                    <Markdown source={intro} className="mt-5 max-w-[38rem] [&_p]:text-[16.5px] [&_p]:leading-[1.7]" />

                    <div className="mt-7 flex max-w-[34rem] items-center gap-3 rounded-xl bg-surface/90 py-1.5 pl-4 pr-1.5 shadow-control backdrop-blur">
                        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">URL de base</span>
                        <span className="h-4 w-px bg-border" aria-hidden="true" />
                        <code className="min-w-0 flex-1 truncate font-mono text-[13.5px] font-medium text-foreground">{BASE_URL}/api</code>
                        <CopyButton text={`${BASE_URL}/api`} label="Copier l’URL de base" />
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2.5">
                        {firstGuide && (
                            <a
                                href={`#${firstGuide.id}`}
                                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.98]"
                            >
                                {firstGuide.title}
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </a>
                        )}
                        {firstOp && (
                            <a
                                href={`#${firstOp.id}`}
                                className="inline-flex h-10 items-center gap-2 rounded-lg bg-surface px-4 text-sm font-medium text-foreground shadow-control transition-colors hover:bg-subtle"
                            >
                                <Braces className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                Référence des endpoints
                            </a>
                        )}
                        <a
                            href="/api/openapi.json"
                            download="miawstral-openapi.json"
                            className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <FileJson className="h-4 w-4" aria-hidden="true" />
                            openapi.json
                        </a>
                    </div>
                </div>

                <div className="reveal min-w-0 space-y-4 [animation-delay:80ms]">
                    <StatusCard />
                    <QuickstartCard />
                </div>
            </div>

            {features.length > 0 && (
                <ul className="relative grid gap-3 pb-6 sm:grid-cols-2 xl:grid-cols-4">
                    {features.map((feature, i) => {
                        const Icon = ICONS[feature.icon] ?? Sparkles;
                        return (
                            <li
                                key={feature.title}
                                className="reveal group rounded-2xl bg-surface p-5 shadow-control transition-shadow hover:shadow-pop"
                                style={{ animationDelay: `${120 + i * 50}ms` }}
                            >
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-b from-brand/15 to-brand/5 text-brand ring-1 ring-inset ring-brand/20">
                                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                                </span>
                                <h3 className="mt-4 text-[15px] font-semibold text-foreground">{feature.title}</h3>
                                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                                    <InlineMarkdown text={feature.text} />
                                </p>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
