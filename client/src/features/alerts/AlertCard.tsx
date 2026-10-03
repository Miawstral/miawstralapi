import { useId, useMemo, useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { useNow } from '@/hooks/useNow';
import { cn } from '@/lib/utils';
import type { ServiceAlert } from '@/types';
import { LineBadgeButton } from '@/features/lines/LineBadgeButton';
import { AlertDescription } from './AlertDescription';
import { AlertEffectIcon } from './AlertEffectIcon';
import {
    alertStatus,
    alertTitle,
    blocksPreview,
    descriptionBlocks,
    effectInfo,
    formatAlertPeriod,
    formatAlertRange,
    isCourtesyBlock,
    type AlertStatus,
    type AlertTone,
} from './alertFormat';

interface AlertCardProps {
    alert: ServiceAlert;
    /** One-line summary that expands in place (for use inside other panels). */
    compact?: boolean;
    onSelectLine?: (lineId: string) => void;
}

/** A service alert: effect, title, period, status, lines, description and link. */
export function AlertCard({ alert, compact = false, onSelectLine }: AlertCardProps) {
    const now = useNow(60_000);
    const view = useMemo(() => {
        const blocks = descriptionBlocks(alert);
        return {
            title: alertTitle(alert),
            status: alertStatus(alert, now),
            period: formatAlertPeriod(alert, now),
            range: formatAlertRange(alert) ?? undefined,
            tone: effectInfo(alert.effect).tone,
            blocks,
            preview: blocksPreview(blocks),
        };
    }, [alert, now]);

    return compact ? (
        <CompactAlert alert={alert} view={view} onSelectLine={onSelectLine} />
    ) : (
        <FullAlert alert={alert} view={view} onSelectLine={onSelectLine} />
    );
}

type AlertView = {
    title: string;
    status: AlertStatus;
    period: string | null;
    range: string | undefined;
    tone: AlertTone;
    blocks: ReturnType<typeof descriptionBlocks>;
    preview: string;
};

interface ViewProps {
    alert: ServiceAlert;
    view: AlertView;
    onSelectLine?: (lineId: string) => void;
}

const PREVIEW_LIMIT = 150;

function FullAlert({ alert, view, onSelectLine }: ViewProps) {
    const id = useId();
    const [expanded, setExpanded] = useState(false);
    const expandable = view.blocks.filter(block => !isCourtesyBlock(block)).length > 1 || view.preview.length > PREVIEW_LIMIT;

    return (
        <article aria-labelledby={`${id}-title`} className="rounded-xl bg-surface p-3.5 shadow-control">
            <div className="flex gap-3">
                <AlertEffectIcon effect={alert.effect} />
                <div className="min-w-0 flex-1">
                    <h3 id={`${id}-title`} className="text-sm font-semibold leading-5 tracking-tight text-foreground">
                        {view.title}
                    </h3>
                    <AlertMeta view={view} className="mt-1" />
                    <AlertLines alert={alert} onSelectLine={onSelectLine} className="mt-2.5" />

                    {view.blocks.length > 0 && (
                        <div className="mt-2.5">
                            {expanded || !expandable ? (
                                <AlertDescription id={`${id}-description`} blocks={view.blocks} />
                            ) : (
                                <p id={`${id}-description`} className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                                    {view.preview}
                                </p>
                            )}
                            {expandable && (
                                <button
                                    type="button"
                                    aria-expanded={expanded}
                                    aria-controls={`${id}-description`}
                                    onClick={() => setExpanded(e => !e)}
                                    className="-ml-1 mt-1 inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                                >
                                    {expanded ? 'Réduire' : 'Lire la suite'}
                                    <ChevronDown
                                        className={cn('h-3.5 w-3.5 transition-transform motion-reduce:transition-none', expanded && 'rotate-180')}
                                        aria-hidden="true"
                                    />
                                </button>
                            )}
                        </div>
                    )}

                    <AlertLink url={alert.url} className="mt-2" />
                </div>
            </div>
        </article>
    );
}

function CompactAlert({ alert, view, onSelectLine }: ViewProps) {
    const id = useId();
    const [expanded, setExpanded] = useState(false);
    const summary = view.period ?? (view.status === 'upcoming' ? 'À venir' : 'En cours');

    return (
        <div className={cn('overflow-hidden rounded-lg bg-surface shadow-control', expanded && 'bg-subtle')}>
            <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`${id}-body`}
                onClick={() => setExpanded(e => !e)}
                className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-subtle"
            >
                <AlertEffectIcon effect={alert.effect} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{view.title}</span>
                <span
                    className={cn(
                        'shrink-0 text-2xs font-medium tnum',
                        view.status === 'ongoing' ? (view.tone === 'danger' ? 'text-danger' : 'text-warning') : 'text-muted-foreground',
                    )}
                >
                    {summary}
                </span>
                <ChevronDown
                    className={cn(
                        'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
                        expanded && 'rotate-180',
                    )}
                    aria-hidden="true"
                />
            </button>
            {expanded && (
                <div id={`${id}-body`} className="space-y-2.5 border-t px-3 pb-3 pt-2.5 motion-safe:animate-fade-in">
                    <AlertMeta view={view} />
                    {alert.lines.length > 1 && <AlertLines alert={alert} onSelectLine={onSelectLine} />}
                    {view.blocks.length > 0 && <AlertDescription blocks={view.blocks} />}
                    <AlertLink url={alert.url} />
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

function StatusPill({ status, tone }: { status: AlertStatus; tone: AlertTone }) {
    const label = status === 'ongoing' ? 'En cours' : status === 'upcoming' ? 'À venir' : 'Terminée';
    return (
        <span
            className={cn(
                'inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-2xs font-medium',
                status === 'ongoing'
                    ? tone === 'danger'
                        ? 'bg-danger/10 text-danger'
                        : 'bg-warning/10 text-warning'
                    : 'bg-muted text-muted-foreground',
            )}
        >
            {status === 'ongoing' && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
            {label}
        </span>
    );
}

function AlertMeta({ view, className }: { view: AlertView; className?: string }) {
    return (
        <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground', className)}>
            <StatusPill status={view.status} tone={view.tone} />
            {view.period && (
                <span title={view.range} className="tnum">
                    {view.period}
                </span>
            )}
        </div>
    );
}

function AlertLines({ alert, onSelectLine, className }: { alert: ServiceAlert; onSelectLine?: (lineId: string) => void; className?: string }) {
    if (alert.lines.length === 0) return null;
    return (
        <div className={cn('flex flex-wrap items-center gap-1', className)}>
            <span className="sr-only">Lignes concernées :</span>
            {alert.lines.map(line => (
                <LineBadgeButton key={line.id} line={line.id} color={line.color} textColor={line.textColor} onSelect={onSelectLine} />
            ))}
        </div>
    );
}

function AlertLink({ url, className }: { url: string | null; className?: string }) {
    if (!url) return null;
    const pdf = /\.pdf($|\?)/i.test(url);
    const label = pdf ? (/d[ée]viation/i.test(url) ? 'Plan de déviation (PDF)' : 'Document (PDF)') : 'Plus d’informations';
    return (
        <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(
                '-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-foreground underline-offset-2 transition-colors hover:bg-muted hover:underline',
                className,
            )}
        >
            {label}
            <ExternalLink className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only"> (nouvel onglet)</span>
        </a>
    );
}
