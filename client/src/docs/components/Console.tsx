import { ChevronDown, CornerDownLeft, Loader2, Play, RotateCcw, X } from 'lucide-react';
import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { tabPanelProps, useStableId } from '../lib/a11y';
import { generateSample, SAMPLE_LANGUAGES, type RequestValues } from '../lib/codegen';
import { bodyExamples, type LiveResult } from '../lib/console';
import { BASE_URL, useSampleLanguage } from '../lib/context';
import { formatBytes, formatDuration, STATUS_TEXT } from '../lib/format';
import { jsonContent, typesOf, type Json, type Operation, type Parameter } from '../lib/spec';
import { cn } from '../lib/utils';
import { CodeLines, Highlighted, Tabs } from './code';
import { GeoPreview } from './GeoPreview';
import { JsonViewer } from './JsonViewer';
import { CopyButton, MethodPill, PathText, StatusDot } from './primitives';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const inputClass =
    'h-8 w-full min-w-0 rounded-md border border-white/10 bg-white/[0.04] px-2.5 font-mono text-[12.5px] text-zinc-100 placeholder:text-zinc-600 transition-colors hover:border-white/20 focus:border-sky-400/60 focus:bg-white/[0.06] focus:outline-none';

function ParamInput({ param, value, onChange, id }: { param: Parameter; value: string; onChange: (value: string) => void; id: string }) {
    const schema = param.schema ?? {};
    const types = typesOf(schema);
    const placeholder =
        schema.default !== undefined ? `défaut : ${String(schema.default)}` : schema.format === 'date' ? 'AAAA-MM-JJ' : schema.pattern ? 'HH:MM' : '';
    if (types.includes('boolean') || schema.enum) {
        const options = types.includes('boolean') ? ['true', 'false'] : (schema.enum ?? []).filter(v => v !== null).map(String);
        return (
            <div className="relative">
                <select id={id} value={value} onChange={e => onChange(e.target.value)} className={cn(inputClass, 'appearance-none pr-8')}>
                    <option value="">{schema.default !== undefined ? `défaut (${String(schema.default)})` : '—'}</option>
                    {options.map(o => (
                        <option key={o} value={o}>
                            {o}
                        </option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-zinc-500" aria-hidden="true" />
            </div>
        );
    }
    return (
        <input
            id={id}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            inputMode={types.includes('integer') || types.includes('number') ? 'decimal' : undefined}
            autoComplete="off"
            spellCheck={false}
            className={inputClass}
        />
    );
}

/** Textarea over a highlighted copy of its text. */
function JsonEditor({ value, onChange, id, invalid }: { value: string; onChange: (value: string) => void; id: string; invalid: boolean }) {
    return (
        <div
            className={cn(
                'relative rounded-md border bg-white/[0.03] font-mono text-[12.5px] leading-[1.7] transition-colors focus-within:border-sky-400/60',
                invalid ? 'border-rose-400/50' : 'border-white/10 hover:border-white/20',
            )}
        >
            <pre aria-hidden="true" className="pointer-events-none m-0 min-h-[96px] whitespace-pre-wrap break-words px-3 py-2.5">
                <Highlighted code={`${value}\n`} language="json" />
            </pre>
            <textarea
                id={id}
                value={value}
                onChange={e => onChange(e.target.value)}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                className="absolute inset-0 h-full w-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent px-3 py-2.5 text-transparent caret-zinc-100 selection:bg-sky-400/30 focus:outline-none"
                style={{ WebkitTextFillColor: 'transparent' }}
            />
        </div>
    );
}

function ConsoleForm({
    op,
    values,
    onChange,
    onSend,
    onReset,
    loading,
    bodyError,
}: {
    op: Operation;
    values: RequestValues;
    onChange: (values: RequestValues) => void;
    onSend: () => void;
    onReset: () => void;
    loading: boolean;
    bodyError: string | null;
}) {
    const idBase = useStableId('console');
    const examples = bodyExamples(op);
    const [example, setExample] = useState(examples[0]?.id ?? '');
    const setParam = (name: string, value: string) => onChange({ ...values, params: { ...values.params, [name]: value } });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        onSend();
    };
    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onSend();
        }
    };

    return (
        <form onSubmit={submit} onKeyDown={onKeyDown} className="space-y-4 border-b border-[hsl(var(--code-border))] px-4 py-4">
            {op.security && (
                <div className="space-y-1.5">
                    <label htmlFor={`${idBase}-token`} className="flex items-baseline gap-2 text-xs">
                        <span className="font-mono font-semibold text-zinc-200">Authorization</span>
                        <span className="text-zinc-500">Bearer</span>
                    </label>
                    <input
                        id={`${idBase}-token`}
                        type="password"
                        value={values.token}
                        onChange={e => onChange({ ...values, token: e.target.value })}
                        placeholder="ADMIN_TOKEN"
                        autoComplete="off"
                        className={inputClass}
                    />
                </div>
            )}
            {op.parameters.length > 0 && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                    {op.parameters.map(param => (
                        <div key={param.name} className="min-w-0 space-y-1.5">
                            <label htmlFor={`${idBase}-${param.name}`} className="flex items-baseline gap-1.5 text-xs">
                                <span className="font-mono font-semibold text-zinc-200">{param.name}</span>
                                <span className="text-[10.5px] text-zinc-500">{param.in === 'path' ? 'chemin' : 'requête'}</span>
                                {param.required && <span className="text-[10.5px] text-rose-300">requis</span>}
                            </label>
                            <ParamInput
                                id={`${idBase}-${param.name}`}
                                param={param}
                                value={values.params[param.name] ?? ''}
                                onChange={value => setParam(param.name, value)}
                            />
                        </div>
                    ))}
                </div>
            )}
            {op.requestBody && (
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <label htmlFor={`${idBase}-body`} className="text-xs font-semibold text-zinc-200">
                            Corps <span className="font-normal text-zinc-500">application/json</span>
                        </label>
                        {examples.length > 1 && (
                            <div className="relative">
                                <select
                                    aria-label="Exemple de corps"
                                    value={example}
                                    onChange={e => {
                                        const next = examples.find(x => x.id === e.target.value);
                                        setExample(e.target.value);
                                        if (next) onChange({ ...values, body: JSON.stringify(next.value, null, 2) });
                                    }}
                                    className="h-7 max-w-[15rem] appearance-none truncate rounded-md border border-white/10 bg-white/[0.04] pl-2 pr-7 text-xs text-zinc-200 hover:border-white/20 focus:border-sky-400/60 focus:outline-none"
                                >
                                    {examples.map(x => (
                                        <option key={x.id} value={x.id}>
                                            {x.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-1.5 top-1.5 h-4 w-4 text-zinc-500" aria-hidden="true" />
                            </div>
                        )}
                    </div>
                    <JsonEditor id={`${idBase}-body`} value={values.body} onChange={body => onChange({ ...values, body })} invalid={Boolean(bodyError)} />
                    {bodyError && <p className="text-xs text-rose-300">JSON invalide : {bodyError}</p>}
                </div>
            )}
            <div className="flex items-center gap-2">
                <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-50 px-4 text-sm font-semibold text-zinc-900 shadow-sm transition-[background-color,transform] hover:bg-white active:scale-[0.99] disabled:opacity-70"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />}
                    {loading ? 'Envoi…' : 'Envoyer la requête'}
                    <span className="ml-1 hidden items-center gap-0.5 text-[11px] font-medium text-zinc-500 sm:inline-flex" aria-hidden="true">
                        {isMac ? '⌘' : 'Ctrl'}
                        <CornerDownLeft className="h-3 w-3" />
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setExample(examples[0]?.id ?? '');
                        onReset();
                    }}
                    title="Revenir à l’exemple"
                    aria-label="Revenir à l’exemple"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
                >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>
        </form>
    );
}

/** Request panel: path, "Essayer" console and code samples. */
export function RequestCard({
    op,
    values,
    onChange,
    open,
    onOpenChange,
    onSend,
    onReset,
    loading,
    bodyError,
}: {
    op: Operation;
    values: RequestValues;
    onChange: (values: RequestValues) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSend: () => void;
    onReset: () => void;
    loading: boolean;
    bodyError: string | null;
}) {
    const { language, setLanguage } = useSampleLanguage();
    const idBase = useStableId('samples');
    const sample = generateSample(language, op, values, BASE_URL);
    const highlight = SAMPLE_LANGUAGES.find(l => l.id === language)?.highlight ?? 'bash';

    return (
        <div className="code-panel overflow-hidden rounded-xl">
            <div className="flex h-12 items-center gap-2.5 border-b border-[hsl(var(--code-border))] bg-[hsl(var(--code-header))] pl-4 pr-2">
                <MethodPill method={op.method} onDark size="xs" />
                <PathText path={op.path} className="min-w-0 flex-1 truncate text-[12.5px] text-zinc-300 [&_.text-brand]:text-sky-300" />
                <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => onOpenChange(!open)}
                    className={cn(
                        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors',
                        open ? 'text-zinc-300 hover:bg-white/10 hover:text-zinc-50' : 'bg-zinc-50 text-zinc-900 shadow-sm hover:bg-white',
                    )}
                >
                    {open ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3 w-3 fill-current" aria-hidden="true" />}
                    {open ? 'Fermer' : 'Essayer'}
                </button>
            </div>
            {open && (
                <ConsoleForm op={op} values={values} onChange={onChange} onSend={onSend} onReset={onReset} loading={loading} bodyError={bodyError} />
            )}
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
                <CopyButton text={sample} onDark label="Copier l’exemple" />
            </div>
            <div {...tabPanelProps(idBase, language)}>
                <CodeLines code={sample} language={highlight} className="max-h-[22rem]" wrap />
            </div>
        </div>
    );
}

/** Response panel: documented examples per status, and the live response. */
export function ResponseCard({
    op,
    live,
    loading,
    selected,
    onSelect,
}: {
    op: Operation;
    live: LiveResult | null;
    loading: boolean;
    /** "live" or a status code. */
    selected: string;
    onSelect: (tab: string) => void;
}) {
    const idBase = useStableId('responses');
    const examples = op.responses
        .map(r => ({ status: r.status, description: r.response.description ?? '', example: jsonContent(r.response.content)?.example }))
        .filter(r => r.example !== undefined || r.status.startsWith('2'));
    const [view, setView] = useState<'preview' | 'json'>('preview');
    const [headersOpen, setHeadersOpen] = useState(false);
    const tab = selected === 'live' && !live && !loading ? (examples[0]?.status ?? 'live') : selected;

    const items = [
        ...(live || loading
            ? [
                  {
                      id: 'live',
                      label: (
                          <>
                              {loading ? (
                                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                              ) : (
                                  <StatusDot status={live?.kind === 'response' ? live.status : 500} />
                              )}
                              En direct
                          </>
                      ),
                  },
              ]
            : []),
        ...examples.map(r => ({ id: r.status, label: <span className="font-mono">{r.status}</span> })),
    ];

    const current = examples.find(r => r.status === tab);
    let copyText = '';
    let body: ReactNode = null;

    if (tab === 'live') {
        if (loading && !live) {
            body = (
                <div className="flex items-center gap-2 px-4 py-10 text-xs text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Requête en cours…
                </div>
            );
        } else if (live?.kind === 'error') {
            body = <p className="px-4 py-6 text-sm text-rose-300">{live.message}</p>;
        } else if (live?.kind === 'response') {
            copyText = live.json === undefined ? live.text : JSON.stringify(live.json, null, 2);
            const preview = op.preview && live.status < 300 && live.json !== undefined ? op.preview : null;
            const shown = preview ? view : 'json';
            body = (
                <div className={cn(loading && 'opacity-60 transition-opacity')}>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[hsl(var(--code-border))] px-4 py-2.5 text-xs text-zinc-400">
                        <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-zinc-100">
                            <StatusDot status={live.status} />
                            {live.status} {live.statusText || STATUS_TEXT[String(live.status)] || ''}
                        </span>
                        <span className="tnum">{formatDuration(live.durationMs)}</span>
                        <span className="tnum">{formatBytes(live.size)}</span>
                        <button
                            type="button"
                            aria-expanded={headersOpen}
                            onClick={() => setHeadersOpen(o => !o)}
                            className="ml-auto inline-flex items-center gap-1 rounded px-1 text-zinc-400 hover:text-zinc-100"
                        >
                            En-têtes ({live.headers.length})
                            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', headersOpen && 'rotate-180')} aria-hidden="true" />
                        </button>
                    </div>
                    {headersOpen && (
                        <dl className="code-scroll max-h-56 overflow-auto border-b border-[hsl(var(--code-border))] px-4 py-2.5 font-mono text-[11.5px] leading-6">
                            {live.headers.map(([name, value]) => (
                                <div key={name} className="flex gap-2">
                                    <dt className="shrink-0 text-sky-300">{name}</dt>
                                    <dd className="min-w-0 break-all text-zinc-300">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                    {preview && (
                        <div className="flex items-center gap-1 px-4 pt-3" role="group" aria-label="Affichage de la réponse">
                            {(['preview', 'json'] as const).map(v => (
                                <button
                                    key={v}
                                    type="button"
                                    aria-pressed={shown === v}
                                    onClick={() => setView(v)}
                                    className={cn(
                                        'h-6 rounded-md px-2 text-[11px] font-medium transition-colors',
                                        shown === v ? 'bg-white/10 text-zinc-50' : 'text-zinc-400 hover:text-zinc-100',
                                    )}
                                >
                                    {v === 'preview' ? 'Aperçu' : 'JSON'}
                                </button>
                            ))}
                        </div>
                    )}
                    {preview && shown === 'preview' ? (
                        <GeoPreview kind={preview} data={live.json as Json} className="px-4 pb-4 pt-3" />
                    ) : live.json !== undefined ? (
                        <JsonViewer value={live.json} className="max-h-[30rem]" />
                    ) : (
                        <pre className="code-scroll max-h-[30rem] overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-[12.5px] text-zinc-300">
                            {live.text || 'Réponse vide.'}
                        </pre>
                    )}
                </div>
            );
        }
    } else if (current) {
        copyText = current.example === undefined ? '' : JSON.stringify(current.example, null, 2);
        body = (
            <>
                {current.description && <p className="border-b border-[hsl(var(--code-border))] px-4 py-2 text-xs text-zinc-400">{current.description.replace(/`/g, '')}</p>}
                {current.example === undefined ? (
                    <p className="px-4 py-6 text-xs text-zinc-500">Pas d’exemple pour cette réponse.</p>
                ) : (
                    <JsonViewer value={current.example as Json} className="max-h-[26rem]" />
                )}
            </>
        );
    }

    return (
        <div className="code-panel overflow-hidden rounded-xl">
            <div className="flex h-10 items-center gap-2 border-b border-[hsl(var(--code-border))] bg-[hsl(var(--code-header))] pl-4 pr-1.5">
                <span className="shrink-0 text-xs font-medium text-zinc-400">Réponse</span>
                <Tabs idBase={idBase} label="Réponses" items={items} value={tab} onChange={onSelect} onDark size="xs" className="flex-1" />
                {copyText && <CopyButton text={copyText} onDark label="Copier la réponse" />}
            </div>
            <div {...tabPanelProps(idBase, tab)}>{body}</div>
        </div>
    );
}
