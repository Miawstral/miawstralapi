import { useId, useMemo, useRef } from 'react';
import { Accessibility, ArrowLeft, CalendarClock, MoonStar, Star, WifiOff } from 'lucide-react';
import { Notice } from '@/components/common/Notice';
import { LiveDot } from '@/components/common/RealtimeBadge';
import { Button } from '@/components/ui/button';
import { useNow } from '@/hooks/useNow';
import { usePolling } from '@/hooks/usePolling';
import { getDepartures } from '@/lib/api';
import { useFavorites } from '@/lib/favorites';
import { sortLines } from '@/lib/text';
import { cn } from '@/lib/utils';
import type { LineSummary, ServiceAlert, StopSummary } from '@/types';
import { AlertCard } from '@/features/alerts/AlertCard';
import { alertStatus } from '@/features/alerts/alertFormat';
import { LineBadgeButton } from '@/features/lines/LineBadgeButton';
import { useRevealOnMount } from '@/features/lines/scroll';
import { DepartureGroupRow } from './DepartureGroupRow';
import { groupDepartures } from './departuresUtils';
import { UpdatedAgo } from './UpdatedAgo';

interface StopBoardProps {
    stop: StopSummary;
    onBack: () => void;
    linesById: ReadonlyMap<string, LineSummary>;
    alerts: ServiceAlert[] | null;
    onPlanFrom: (stop: StopSummary) => void;
    onPlanTo: (stop: StopSummary) => void;
    onSelectLine: (lineId: string) => void;
}

const REFRESH_MS = 30_000;
const LIMIT = 30;

/** A stop: identity, favorite, shortcuts to the planner and its live departures board. */
export function StopBoard({ stop, onBack, linesById, alerts, onPlanFrom, onPlanTo, onSelectLine }: StopBoardProps) {
    const titleId = useId();
    const boardId = useId();
    const rootRef = useRef<HTMLElement>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    useRevealOnMount(rootRef, headingRef);
    const { isFavorite, toggle } = useFavorites();
    const favorite = isFavorite(stop.stopPointId);
    const now = useNow(15_000);

    const polling = usePolling(
        `departures:${stop.stopPointId}`,
        signal => getDepartures(stop.stopPointId, { limit: LIMIT }, signal),
        REFRESH_MS,
    );
    const data = polling.data;
    const groups = useMemo(() => (data ? groupDepartures(data.departures, now) : null), [data, now]);

    const lines = useMemo(() => sortLines(stop.lines ?? []), [stop.lines]);
    const stopAlerts = useMemo(() => {
        if (!alerts) return [];
        const served = new Set([...lines, ...(data?.departures.map(d => d.line) ?? [])]);
        return alerts.filter(
            alert =>
                alertStatus(alert, now) === 'ongoing' &&
                (alert.stops.some(s => s.stopPointId === stop.stopPointId) || alert.lines.some(l => served.has(l.id))),
        );
    }, [alerts, lines, data, now, stop.stopPointId]);

    return (
        <section ref={rootRef} aria-labelledby={titleId} className="pb-4 motion-safe:animate-slide-in">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-surface/95 px-2 py-2 backdrop-blur">
                <Button variant="ghost" size="sm" onClick={onBack} className="text-foreground">
                    <ArrowLeft aria-hidden="true" />
                    Arrêts
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-pressed={favorite}
                    aria-label={`Arrêt favori : ${stop.name}`}
                    title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    onClick={() => toggle(stop)}
                    className={cn(favorite && 'text-foreground')}
                >
                    <Star className={cn('transition-transform motion-safe:active:scale-90', favorite && 'fill-current')} aria-hidden="true" />
                </Button>
            </div>

            <div className="px-4 pt-4">
                <div className="flex items-center gap-1.5">
                    <h2 id={titleId} ref={headingRef} tabIndex={-1} className="min-w-0 truncate text-[20px] font-semibold leading-tight tracking-tight outline-none">
                        {stop.name}
                    </h2>
                    {stop.accessible && (
                        <Accessibility className="h-4 w-4 shrink-0 text-muted-foreground" role="img" aria-label="Arrêt accessible" />
                    )}
                </div>
                {stop.city && <p className="mt-0.5 text-[13px] text-muted-foreground">{stop.city}</p>}

                {lines.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                        <span className="sr-only">Lignes desservies :</span>
                        {lines.map(id => {
                            const line = linesById.get(id);
                            return (
                                <LineBadgeButton
                                    key={id}
                                    line={id}
                                    color={line?.color}
                                    textColor={line?.textColor}
                                    lineName={line?.lineName}
                                    size="md"
                                    onSelect={onSelectLine}
                                />
                            );
                        })}
                    </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={() => onPlanFrom(stop)}>
                        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-2 border-current" />
                        Partir d’ici
                    </Button>
                    <Button variant="primary" onClick={() => onPlanTo(stop)}>
                        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-current" />
                        Y aller
                    </Button>
                </div>
            </div>

            {stopAlerts.length > 0 && (
                <section aria-label="Perturbations sur les lignes de l’arrêt" className="mt-4 space-y-1.5 px-3">
                    {stopAlerts.map(alert => (
                        <AlertCard key={alert.id} alert={alert} compact onSelectLine={onSelectLine} />
                    ))}
                </section>
            )}

            <section aria-labelledby={boardId} aria-busy={polling.loading && !data} className="mt-5">
                <div className="flex h-6 items-center justify-between gap-3 border-b px-4 pb-2">
                    <h3 id={boardId} className="text-xs font-medium text-muted-foreground">
                        Prochains départs
                    </h3>
                    <BoardStatus
                        mode={!data ? null : data.departures.some(d => d.realtime) ? 'live' : data.departures.length === 0 ? 'empty' : 'scheduled'}
                        updatedAt={polling.updatedAt}
                        failing={Boolean(polling.error)}
                    />
                </div>

                {!data && polling.error ? (
                    <div className="px-3 pt-3">
                        <Notice tone="error" title="Départs indisponibles">
                            {polling.error} Nouvel essai automatique dans quelques secondes.
                        </Notice>
                    </div>
                ) : !groups ? (
                    <BoardSkeleton />
                ) : groups.length === 0 ? (
                    <NoMoreDepartures />
                ) : (
                    <ul className="divide-y px-4">
                        {groups.map(group => (
                            <DepartureGroupRow key={group.key} group={group} onSelectLine={onSelectLine} />
                        ))}
                    </ul>
                )}
            </section>
        </section>
    );
}

function BoardStatus({
    mode,
    updatedAt,
    failing,
}: {
    /** live: real-time data in the board; scheduled: timetables only. */
    mode: 'live' | 'scheduled' | 'empty' | null;
    updatedAt: number | null;
    failing: boolean;
}) {
    if (mode === null || updatedAt === null) return null;
    if (failing) {
        return (
            <span className="flex items-center gap-1.5 text-2xs font-medium text-warning">
                <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                Hors ligne · <UpdatedAgo updatedAt={updatedAt} />
            </span>
        );
    }
    if (mode === 'empty') {
        return (
            <span className="text-2xs text-muted-foreground">
                Mis à jour <UpdatedAgo updatedAt={updatedAt} />
            </span>
        );
    }
    if (mode === 'scheduled') {
        return (
            <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                Horaires théoriques
            </span>
        );
    }
    return (
        <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <LiveDot />
            <span>
                Mis à jour <UpdatedAgo updatedAt={updatedAt} />
            </span>
        </span>
    );
}

function NoMoreDepartures() {
    return (
        <div className="flex flex-col items-center px-6 py-10 text-center motion-safe:animate-fade-in">
            <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <MoonStar className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <p className="mt-3 text-sm font-semibold">Plus de départ aujourd’hui</p>
            <p className="mt-1 max-w-[16rem] text-[13px] leading-relaxed text-muted-foreground">
                Aucun autre passage n’est prévu à cet arrêt d’ici la fin du service.
            </p>
        </div>
    );
}

function BoardSkeleton() {
    return (
        <ul className="divide-y px-4" aria-label="Chargement des départs">
            {Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 py-3">
                    <span className="skeleton h-8 w-10 rounded-[5px]" />
                    <span className="min-w-0">
                        <span className="flex h-8 items-center">
                            <span className="skeleton block h-4" style={{ width: `${40 + ((i * 23) % 35)}%` }} />
                        </span>
                        <span className="mt-0.5 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-2">
                            {[0, 1, 2].map(j => (
                                <span key={j} className="space-y-1.5 py-0.5">
                                    <span className={cn('skeleton block h-5', j === 0 ? 'w-14' : 'w-11')} />
                                    <span className="skeleton block h-2.5 w-10" />
                                </span>
                            ))}
                        </span>
                    </span>
                </li>
            ))}
        </ul>
    );
}
