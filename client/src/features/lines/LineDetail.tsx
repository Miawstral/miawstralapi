import { useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, RotateCw } from 'lucide-react';
import { LineBadge } from '@/components/common/LineBadge';
import { ModeIcon } from '@/components/common/ModeIcon';
import { MODE_LABELS } from '@/lib/modes';
import { Notice } from '@/components/common/Notice';
import { LiveDot } from '@/components/common/RealtimeBadge';
import { Button } from '@/components/ui/button';
import { useAsyncData } from '@/hooks/useAsyncData';
import { usePrefersDark } from '@/hooks/useMediaQuery';
import { useNow } from '@/hooks/useNow';
import { getLine } from '@/lib/api';
import { plural } from '@/lib/format';
import type { Direction, LineSummary, ServiceAlert, Vehicle } from '@/types';
import { AlertCard } from '@/features/alerts/AlertCard';
import { alertsByLine } from '@/features/alerts/alertFormat';
import { DirectionSwitch } from './DirectionSwitch';
import { LineStopsTimeline, type SelectedStop } from './LineStopsTimeline';
import { countVehiclesByLine, directionOf, localIsoDate, vehiclesByNextStop } from './lineUtils';
import { useRevealOnMount } from './scroll';

interface LineDetailProps {
    lineId: string;
    /** From the lines list, to show the header before the details arrive. */
    summary: LineSummary | undefined;
    date?: string;
    direction: Direction;
    onDirectionChange: (direction: Direction) => void;
    alerts: ServiceAlert[];
    vehicles: Vehicle[] | null;
    onBack: () => void;
    /** Another line, from an alert concerning several lines. */
    onSelectLine: (lineId: string) => void;
    onSelectStop: (stop: SelectedStop) => void;
}

const dayFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export function LineDetail({
    lineId,
    summary,
    date,
    direction,
    onDirectionChange,
    alerts,
    vehicles,
    onBack,
    onSelectLine,
    onSelectStop,
}: LineDetailProps) {
    const titleId = useId();
    const rootRef = useRef<HTMLElement>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    useRevealOnMount(rootRef, headingRef);
    const dark = usePrefersDark();
    const now = useNow(20_000);
    const [attempt, setAttempt] = useState(0);
    const state = useAsyncData(`${lineId}@${date ?? 'today'}#${attempt}`, signal => getLine(lineId, date, signal));
    const details = state.status === 'success' ? state.data : null;

    const header = details ?? summary;
    const current = details ? directionOf(details.directions, direction) : undefined;
    const other = details?.directions.find(d => d !== current);
    const today = localIsoDate(now);
    const serviceDate = details?.serviceDate ?? date ?? today;
    const isToday = serviceDate === today;
    const fromMinutes = isToday ? now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 : null;

    // Live positions only make sense for today's timetable.
    const liveVehicles = isToday ? vehicles : null;
    const vehiclesByStop = useMemo(
        () => (current ? vehiclesByNextStop(liveVehicles, lineId, current, other) : new Map<string, Vehicle[]>()),
        [liveVehicles, lineId, current, other],
    );
    const lineAlerts = useMemo(() => alertsByLine(alerts, now).get(lineId) ?? [], [alerts, now, lineId]);
    const running = liveVehicles ? (countVehiclesByLine(liveVehicles).get(lineId) ?? 0) : null;

    return (
        <section ref={rootRef} aria-labelledby={titleId} className="pb-4 motion-safe:animate-slide-in">
            <div className="sticky top-0 z-20 border-b bg-surface/95 px-2 py-2 backdrop-blur">
                <Button variant="ghost" size="sm" onClick={onBack} className="text-foreground">
                    <ArrowLeft aria-hidden="true" />
                    Lignes
                </Button>
            </div>

            {/* Identity */}
            <div className="flex items-start gap-3 px-4 pb-3 pt-4">
                {header ? (
                    <LineBadge
                        line={lineId}
                        color={header.color}
                        textColor={header.textColor}
                        size="lg"
                        className="h-10 min-w-[3rem] rounded-lg px-2.5 text-base"
                    />
                ) : (
                    <span className="skeleton h-10 w-12 shrink-0 rounded-lg" />
                )}
                <div className="min-w-0 flex-1 pt-0.5">
                    <h2 id={titleId} ref={headingRef} tabIndex={-1} className="text-[17px] font-semibold leading-snug tracking-tight outline-none">
                        <span className="sr-only">Ligne {lineId} : </span>
                        {header ? header.lineName : <span className="skeleton mt-1 block h-5 w-3/4" />}
                    </h2>
                    <p className="mt-0.5 flex h-5 items-center gap-1.5 text-[13px] text-muted-foreground">
                        {header && (
                            <>
                                <ModeIcon mode={header.mode} className="h-3.5 w-3.5" />
                                {MODE_LABELS[header.mode]}
                            </>
                        )}
                        {running !== null && (
                            <>
                                <span aria-hidden="true">·</span>
                                {running > 0 ? (
                                    <span className="inline-flex items-center gap-1.5 text-foreground/80">
                                        <LiveDot />
                                        {running} en service
                                    </span>
                                ) : (
                                    <span>Aucun véhicule en ligne</span>
                                )}
                            </>
                        )}
                    </p>
                </div>
            </div>

            {lineAlerts.length > 0 && (
                <section aria-label="Perturbations sur la ligne" className="space-y-1.5 px-3 pb-3">
                    {lineAlerts.map(({ alert }) => (
                        <AlertCard key={alert.id} alert={alert} compact onSelectLine={onSelectLine} />
                    ))}
                </section>
            )}

            {state.status === 'error' && (
                <div className="px-3">
                    <Notice
                        tone="error"
                        title="Impossible de charger la ligne"
                        action={
                            <Button size="sm" onClick={() => setAttempt(n => n + 1)}>
                                <RotateCw aria-hidden="true" />
                                Réessayer
                            </Button>
                        }
                    >
                        {state.message}
                    </Notice>
                </div>
            )}

            {state.status === 'loading' && <DetailSkeleton />}

            {details && current && (
                <>
                    <div className="px-3">
                        <DirectionSwitch directions={details.directions} value={current.direction} onChange={onDirectionChange} />
                    </div>

                    {!isToday && (
                        <p className="mx-4 mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                            Horaires du {dayFormatter.format(new Date(`${serviceDate}T12:00:00`))}
                        </p>
                    )}

                    <div className="mb-1 mt-4 flex items-baseline justify-between px-4 text-xs font-medium text-muted-foreground">
                        <span>{plural(current.stops.length, 'arrêt')}</span>
                        <span>{isToday ? 'Prochain passage' : 'Premier passage'}</span>
                    </div>

                    {current.stops.length === 0 ? (
                        <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">Aucun arrêt desservi ce jour dans ce sens.</p>
                    ) : (
                        <LineStopsTimeline
                            stops={current.stops}
                            color={details.color}
                            textColor={details.textColor}
                            mode={details.mode}
                            dark={dark}
                            vehiclesByStop={vehiclesByStop}
                            fromMinutes={fromMinutes}
                            onSelectStop={onSelectStop}
                        />
                    )}
                </>
            )}
        </section>
    );
}

function DetailSkeleton() {
    return (
        <div aria-label="Chargement des arrêts" role="status">
            <div className="px-3">
                <div className="skeleton h-9 rounded-lg" />
            </div>
            <div className="mb-1 mt-4 flex justify-between px-4">
                <span className="skeleton h-3 w-14" />
                <span className="skeleton h-3 w-24" />
            </div>
            <ol className="px-2">
                {Array.from({ length: 9 }, (_, i) => (
                    <li key={i} className="grid h-9 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-2 pr-2">
                        <span className="relative h-full">
                            <span className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-muted" />
                            <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-muted bg-surface" />
                        </span>
                        <span className="skeleton h-3.5" style={{ width: `${45 + ((i * 37) % 40)}%` }} />
                        <span className="skeleton h-3.5 w-12" />
                    </li>
                ))}
            </ol>
        </div>
    );
}
