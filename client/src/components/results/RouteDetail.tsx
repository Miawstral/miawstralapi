import { useState, type ReactNode } from 'react';
import { ArrowLeft, CalendarPlus, Check, ChevronDown, Footprints, Share2, TriangleAlert } from 'lucide-react';
import { LineBadge } from '@/components/common/LineBadge';
import { ModeIcon } from '@/components/common/ModeIcon';
import { Notice } from '@/components/common/Notice';
import { DelayBadge, LiveDot } from '@/components/common/RealtimeBadge';
import { downloadRouteEvent, shareCurrentPage } from '@/lib/share';
import type { ServiceAlert } from '@/types';
import { Button } from '@/components/ui/button';
import { strokeColor } from '@/lib/colors';
import { usePrefersDark } from '@/hooks/useMediaQuery';
import { formatDistance, formatDuration, formatTime, formatTransfers, minutesBetween, plural } from '@/lib/format';
import { isWalkOnly } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { BusStep, RouteOption, WalkStep } from '@/types';

interface RouteDetailProps {
    route: RouteOption;
    serviceDate: string;
    alerts: ServiceAlert[];
    originLabel: string;
    destinationLabel: string;
    onBack: () => void;
}

export function RouteDetail({ route, serviceDate, alerts, originLabel, destinationLabel, onBack }: RouteDetailProps) {
    const [shared, setShared] = useState<string | null>(null);
    const routeAlerts = alerts.filter(a => route.alerts.includes(a.id));
    const share = async () => {
        const result = await shareCurrentPage(`${originLabel} → ${destinationLabel}`, `Itinéraire ${formatTime(route.departureTime)} → ${formatTime(route.arrivalTime)}`);
        setShared(result === 'copied' ? 'Lien copié' : result === 'shared' ? 'Partagé' : null);
        if (result !== 'failed') setTimeout(() => setShared(null), 2500);
    };
    const summary = [
        formatDuration(route.duration),
        isWalkOnly(route) ? 'à pied' : formatTransfers(route.transfers),
        route.walkingDistance > 0 && !isWalkOnly(route) ? `${formatDistance(route.walkingDistance)} à pied` : null,
    ].filter(Boolean);

    return (
        <section aria-label="Détail de l’itinéraire" className="motion-safe:animate-slide-in">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-surface/95 px-2 py-2 backdrop-blur">
                <Button variant="ghost" size="sm" onClick={onBack} className="text-foreground">
                    <ArrowLeft aria-hidden="true" />
                    Itinéraires
                </Button>
                <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="sm" onClick={share} aria-live="polite">
                        {shared ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
                        {shared ?? 'Partager'}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        title="Ajouter au calendrier"
                        aria-label="Ajouter au calendrier"
                        onClick={() => downloadRouteEvent(route, serviceDate, originLabel, destinationLabel)}
                    >
                        <CalendarPlus aria-hidden="true" />
                    </Button>
                </div>
            </div>

            <div className="px-4 pb-1 pt-4">
                <div className="text-[22px] font-semibold tracking-tight tnum">
                    {formatTime(route.departureTime)}
                    <span className="mx-2 font-normal text-muted-foreground">→</span>
                    {formatTime(route.arrivalTime)}
                </div>
                <div className="mt-0.5 text-[13px] text-muted-foreground">{summary.join(' · ')}</div>
                {routeAlerts.map(alert => (
                    <Notice key={alert.id} tone="warning" className="mt-3" title={alert.title}>
                        <span className="line-clamp-3 whitespace-pre-line">{alert.description}</span>
                    </Notice>
                ))}
            </div>

            <Timeline route={route} originLabel={originLabel} destinationLabel={destinationLabel} />
        </section>
    );
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

type Rail = { kind: 'line'; color: string } | { kind: 'walk' } | null;
type NodeVariant = 'origin' | 'destination' | 'stop';

type Live = { time: string; delay: number } | null;
type Entry =
    | { kind: 'node'; time: string; live: Live; title: string; note?: string; variant: NodeVariant; color?: string; above: Rail; below: Rail }
    | { kind: 'walk'; step: WalkStep }
    | { kind: 'ride'; step: BusStep };

const WALK_RAIL: Rail = { kind: 'walk' };

/** Turns the steps into alternating stop nodes and travel segments. */
function buildEntries(route: RouteOption, originLabel: string, destinationLabel: string, dark: boolean): Entry[] {
    const lineColor = (color: string) => strokeColor(color, dark);
    const entries: Entry[] = [];
    const steps = route.steps;
    const railOf = (index: number): Rail => {
        const step = steps[index];
        if (!step) return null;
        return step.type === 'bus' ? { kind: 'line', color: lineColor(step.color) } : WALK_RAIL;
    };

    const first = steps[0];
    entries.push({
        kind: 'node',
        variant: 'origin',
        time: route.departureTime,
        live: first?.type === 'bus' && first.realtime ? { time: first.realtime.departureTime, delay: first.realtime.departureDelay } : null,
        title: originLabel,
        above: null,
        below: railOf(0),
    });

    steps.forEach((step, index) => {
        const next = steps[index + 1];
        if (step.type === 'walk') entries.push({ kind: 'walk', step });
        else entries.push({ kind: 'ride', step });

        if (!next) return;
        // Stop between this step and the next one.
        const arrival = step.arrivalTime;
        const departure = next.departureTime;
        const wait = minutesBetween(arrival, departure) ?? 0;
        const name = step.type === 'bus' ? step.to.name : next.type === 'bus' ? next.from.name : (step.to.name ?? '');
        const color = next.type === 'bus' ? lineColor(next.color) : step.type === 'bus' ? lineColor(step.color) : undefined;
        const transfer = step.type === 'bus' && next.type === 'bus';
        const live: Live =
            next.type === 'bus' && next.realtime
                ? { time: next.realtime.departureTime, delay: next.realtime.departureDelay }
                : step.type === 'bus' && step.realtime
                  ? { time: step.realtime.arrivalTime, delay: step.realtime.arrivalDelay }
                  : null;
        entries.push({
            kind: 'node',
            variant: 'stop',
            live,
            time: next.type === 'bus' ? departure : arrival,
            title: name,
            note:
                wait > 0
                    ? `${transfer ? 'Correspondance · ' : ''}${formatDuration(wait)} d’attente${next.type === 'bus' ? ` (arrivée ${formatTime(arrival)})` : ''}`
                    : transfer
                      ? 'Correspondance'
                      : undefined,
            color,
            above: railOf(index),
            below: railOf(index + 1),
        });
    });

    const last = steps[steps.length - 1];
    entries.push({
        kind: 'node',
        variant: 'destination',
        live: last?.type === 'bus' && last.realtime ? { time: last.realtime.arrivalTime, delay: last.realtime.arrivalDelay } : null,
        time: route.arrivalTime,
        title: destinationLabel,
        above: railOf(steps.length - 1),
        below: null,
    });
    return entries;
}

function Timeline({ route, originLabel, destinationLabel }: { route: RouteOption; originLabel: string; destinationLabel: string }) {
    const dark = usePrefersDark();
    const entries = buildEntries(route, originLabel, destinationLabel, dark);
    return (
        <ol className="px-3 pb-5 pt-3">
            {entries.map((entry, index) => (
                <li key={index}>
                    {entry.kind === 'node' ? (
                        <NodeRow entry={entry} />
                    ) : entry.kind === 'walk' ? (
                        <WalkRow step={entry.step} />
                    ) : (
                        <RideRow step={entry.step} dark={dark} />
                    )}
                </li>
            ))}
        </ol>
    );
}

/** Grid shared by every row: time | rail | content. */
function Row({ time, rail, children, className }: { time?: ReactNode; rail: ReactNode; children: ReactNode; className?: string }) {
    return (
        <div className={cn('grid grid-cols-[2.75rem_1.5rem_minmax(0,1fr)] gap-x-2', className)}>
            <div className="pt-2 text-right text-[13px] font-medium tnum">{time}</div>
            <div className="relative">{rail}</div>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

function RailLine({ rail, className }: { rail: Rail; className?: string }) {
    if (!rail) return null;
    if (rail.kind === 'walk') {
        return <span className={cn('absolute left-1/2 w-0 -translate-x-1/2 border-l-2 border-dotted border-muted-foreground/45', className)} />;
    }
    return <span className={cn('absolute left-1/2 w-[3px] -translate-x-1/2', className)} style={{ backgroundColor: rail.color }} />;
}

const NODE_CENTER = 'top-[18px]';

function NodeRow({ entry }: { entry: Extract<Entry, { kind: 'node' }> }) {
    const marker =
        entry.variant === 'origin' ? (
            <span className="h-3 w-3 rounded-full border-[2.5px] border-foreground bg-surface" />
        ) : entry.variant === 'destination' ? (
            <span className="h-3 w-3 rounded-[3px] bg-foreground" />
        ) : (
            <span
                className="h-2.5 w-2.5 rounded-full border-[2.5px] bg-surface"
                style={{ borderColor: entry.color ?? 'hsl(var(--muted-foreground))' }}
            />
        );
    return (
        <Row
            time={
                entry.live && entry.live.time !== formatTime(entry.time) ? (
                    <span className="flex flex-col items-end leading-tight">
                        <span className={entry.live.delay > 60 ? 'text-warning' : 'text-emerald-600 dark:text-emerald-400'}>{entry.live.time}</span>
                        <span className="text-2xs font-normal text-muted-foreground line-through">{formatTime(entry.time)}</span>
                    </span>
                ) : (
                    formatTime(entry.time)
                )
            }
            rail={
                <>
                    <RailLine rail={entry.above} className="top-0 h-[18px]" />
                    <RailLine rail={entry.below} className={cn(NODE_CENTER, 'bottom-0')} />
                    <span className={cn('absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center', NODE_CENTER)}>{marker}</span>
                </>
            }
        >
            <div className="py-2">
                <div className={cn('text-sm leading-5', entry.variant === 'stop' ? 'font-medium' : 'font-semibold')}>{entry.title}</div>
                {entry.note && <div className="text-xs text-muted-foreground">{entry.note}</div>}
            </div>
        </Row>
    );
}

function WalkRow({ step }: { step: WalkStep }) {
    return (
        <Row rail={<RailLine rail={WALK_RAIL} className="inset-y-0" />}>
            <div className="flex items-center gap-2 py-2.5 text-[13px] text-muted-foreground">
                <Footprints className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                    Marcher <span className="font-medium text-foreground tnum">{formatDuration(step.duration)}</span>
                    <span className="tnum"> · {formatDistance(step.distance)}</span>
                </span>
            </div>
        </Row>
    );
}

function RideRow({ step, dark }: { step: BusStep; dark: boolean }) {
    const [expanded, setExpanded] = useState(false);
    const color = strokeColor(step.color, dark);
    const rail: Rail = { kind: 'line', color };
    const calls = step.intermediateStops ?? [];
    return (
        <>
            <Row rail={<RailLine rail={rail} className="inset-y-0" />}>
                <div className="space-y-1.5 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                        <LineBadge line={step.line} color={step.color} textColor={step.textColor} title={step.lineName} size="md" />
                        {step.mode !== 'bus' && <ModeIcon mode={step.mode} className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className="min-w-0 truncate text-[13px]">
                            <span className="text-muted-foreground">Direction </span>
                            <span className="font-medium">{step.headsign}</span>
                        </span>
                    </div>
                    {(step.realtime || step.cancelled) && (
                        <div className="flex items-center gap-1.5 text-xs">
                            {step.cancelled ? (
                                <span className="inline-flex items-center gap-1 font-medium text-danger">
                                    <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                                    Course supprimée
                                </span>
                            ) : (
                                <>
                                    <LiveDot />
                                    <span className="text-muted-foreground">Bus suivi en temps réel ·</span>
                                    <DelayBadge delay={step.realtime!.departureDelay} />
                                </>
                            )}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => setExpanded(e => !e)}
                        disabled={calls.length === 0}
                        aria-expanded={expanded}
                        className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs text-muted-foreground transition-colors enabled:hover:bg-muted enabled:hover:text-foreground"
                    >
                        {plural(step.stopsCount, 'arrêt')} · {formatDuration(step.duration)}
                        {calls.length > 0 && (
                            <ChevronDown
                                className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
                                aria-hidden="true"
                            />
                        )}
                    </button>
                </div>
            </Row>
            {expanded &&
                calls.map(call => (
                    <Row
                        key={`${call.stopId}-${call.time}`}
                        className="motion-safe:animate-fade-in"
                        time={<span className="text-xs font-normal text-muted-foreground">{formatTime(call.time)}</span>}
                        rail={
                            <>
                                <RailLine rail={rail} className="inset-y-0" />
                                <span
                                    className="absolute left-1/2 top-[15px] h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-surface"
                                    style={{ borderColor: color }}
                                />
                            </>
                        }
                    >
                        <div className="truncate py-1.5 text-xs text-muted-foreground">{call.name}</div>
                    </Row>
                ))}
        </>
    );
}
