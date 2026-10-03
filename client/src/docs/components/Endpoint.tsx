import { ChevronRight, KeyRound, Link2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { buildRequest, type RequestValues } from '../lib/codegen';
import { initialValues, missingValues, sendRequest, type LiveResult } from '../lib/console';
import { jsonContent, resolve, type Header, type Operation, type ResponseObject } from '../lib/spec';
import { BASE_URL, useModel } from '../lib/context';
import { cn } from '../lib/utils';
import { RequestCard, ResponseCard } from './Console';
import { InlineMarkdown, Markdown } from './Markdown';
import { ParamList } from './ParamList';
import { Chip, CopyButton, MethodPill, PathText, StatusPill } from './primitives';
import { SchemaView } from './SchemaTree';

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
    return (
        <div className="mb-3 flex items-center gap-3">
            <h4 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-foreground">{children}</h4>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            {aside}
        </div>
    );
}

function HeadersTable({ headers }: { headers: Record<string, Header> }) {
    const { spec } = useModel();
    return (
        <div className="border-b px-4 py-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">En-têtes</p>
            <dl className="space-y-1.5">
                {Object.entries(headers).map(([name, header]) => {
                    const resolved = resolve(spec, header);
                    return (
                        <div key={name} className="grid gap-x-3 gap-y-0.5 text-sm sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
                            <dt className="break-all font-mono text-[12.5px] font-semibold text-foreground">{name}</dt>
                            <dd className="text-[13px] leading-5 text-muted-foreground">
                                <InlineMarkdown text={resolved.description ?? ''} />
                            </dd>
                        </div>
                    );
                })}
            </dl>
        </div>
    );
}

function ResponseRow({ status, response, defaultOpen }: { status: string; response: ResponseObject; defaultOpen: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    const schema = jsonContent(response.content)?.schema;
    const hasDetails = Boolean(schema || response.headers);
    return (
        <li>
            <button
                type="button"
                disabled={!hasDetails}
                aria-expanded={hasDetails ? open : undefined}
                onClick={() => setOpen(o => !o)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors enabled:hover:bg-subtle"
            >
                <StatusPill status={status} className="mt-px" />
                <span className="min-w-0 flex-1 text-sm leading-6 text-muted-foreground">
                    <InlineMarkdown text={response.description ?? ''} />
                </span>
                {hasDetails && (
                    <ChevronRight className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} aria-hidden="true" />
                )}
            </button>
            {open && hasDetails && (
                <div className="border-t bg-subtle/50">
                    {response.headers && <HeadersTable headers={response.headers} />}
                    {schema && <SchemaView schema={schema} className="m-3 sm:m-4" />}
                </div>
            )}
        </li>
    );
}

/** One operation: documentation on the left, code and console on the right. */
export function Endpoint({ op }: { op: Operation }) {
    const { spec } = useModel();
    const [values, setValues] = useState<RequestValues>(() => initialValues(op));
    const [consoleOpen, setConsoleOpen] = useState(false);
    const [live, setLive] = useState<LiveResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [responseTab, setResponseTab] = useState(() => op.responses.find(r => r.status.startsWith('2'))?.status ?? 'live');
    const controller = useRef<AbortController | null>(null);
    useEffect(() => () => controller.current?.abort(), []);

    const bodyError = buildRequest(op, values, BASE_URL).bodyError;
    const missing = missingValues(op, values);

    const send = async () => {
        if (missing.length > 0) {
            setLive({ kind: 'error', message: `À renseigner : ${missing.join(', ')}.` });
            setResponseTab('live');
            return;
        }
        controller.current?.abort();
        const current = new AbortController();
        controller.current = current;
        setLoading(true);
        setResponseTab('live');
        const result = await sendRequest(op, values, BASE_URL, current.signal);
        if (controller.current !== current) return;
        setLive(result);
        setLoading(false);
    };

    const body = op.requestBody;
    const bodySchema = jsonContent(body?.content)?.schema;
    const securityScheme = op.security ? spec.components?.securitySchemes?.[op.security] : undefined;
    const sticky = !consoleOpen && !live && !loading;

    return (
        <section id={op.id} aria-labelledby={`${op.id}-title`} className="scroll-mt-20 border-t py-14 first:border-t-0 sm:py-16">
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] xl:gap-12">
                <div className="min-w-0 space-y-8">
                    <header className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 id={`${op.id}-title`} className="group text-2xl font-semibold tracking-tight text-foreground">
                                {op.summary}
                                <a
                                    href={`#${op.id}`}
                                    aria-label={`Lien vers ${op.summary}`}
                                    className="ml-2 inline-flex translate-y-[-2px] align-middle text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                                >
                                    <Link2 className="h-4 w-4" aria-hidden="true" />
                                </a>
                            </h3>
                        </div>
                        {op.badges.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {op.badges.map(b => (
                                    <Chip key={b.label} badge={b} />
                                ))}
                            </div>
                        )}
                        <div className="flex min-w-0 items-center gap-2.5 rounded-xl border bg-subtle py-1.5 pl-2 pr-1.5 shadow-[inset_0_1px_0_hsl(var(--surface))]">
                            <MethodPill method={op.method} size="md" />
                            <PathText path={op.path} className="min-w-0 flex-1 break-all text-[13.5px] font-medium text-foreground" />
                            <CopyButton text={op.path} label="Copier le chemin" />
                        </div>
                    </header>

                    <Markdown source={op.description} />

                    {securityScheme && (
                        <div className="flex gap-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
                            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                            <div className="text-sm leading-6 text-muted-foreground">
                                <p className="font-medium text-foreground">Authentification requise</p>
                                <p>
                                    <InlineMarkdown text={securityScheme.description ?? ''} /> À envoyer dans l’en-tête{' '}
                                    <code className="rounded-[5px] bg-muted px-[0.38em] py-[0.12em] font-mono text-[0.85em] text-foreground">
                                        Authorization: Bearer &lt;jeton&gt;
                                    </code>
                                    .
                                </p>
                            </div>
                        </div>
                    )}

                    {op.parameters.length > 0 && (
                        <div>
                            <SectionTitle>Paramètres</SectionTitle>
                            <ParamList parameters={op.parameters} />
                        </div>
                    )}

                    {body && bodySchema && (
                        <div>
                            <SectionTitle
                                aside={
                                    <span className="font-mono text-xs text-muted-foreground">
                                        application/json{body.required ? ' · requis' : ''}
                                    </span>
                                }
                            >
                                Corps de la requête
                            </SectionTitle>
                            {body.description && (
                                <p className="mb-3 text-sm text-muted-foreground">
                                    <InlineMarkdown text={body.description} />
                                </p>
                            )}
                            <SchemaView schema={bodySchema} />
                        </div>
                    )}

                    <div>
                        <SectionTitle>Réponses</SectionTitle>
                        <ul className="divide-y overflow-hidden rounded-xl border bg-surface">
                            {op.responses.map((r, i) => (
                                <ResponseRow key={r.status} status={r.status} response={r.response} defaultOpen={i === 0 && r.status.startsWith('2')} />
                            ))}
                        </ul>
                    </div>
                </div>

                <div className={cn('min-w-0 space-y-4 self-start', sticky && 'xl:sticky xl:top-[4.75rem]')}>
                    <RequestCard
                        op={op}
                        values={values}
                        onChange={setValues}
                        open={consoleOpen}
                        onOpenChange={setConsoleOpen}
                        onSend={() => void send()}
                        onReset={() => {
                            setValues(initialValues(op));
                        }}
                        loading={loading}
                        bodyError={bodyError}
                    />
                    <ResponseCard op={op} live={live} loading={loading} selected={responseTab} onSelect={setResponseTab} />
                </div>
            </div>
        </section>
    );
}
