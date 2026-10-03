import { useEffect, useEffectEvent } from 'react';
import { Accessibility } from 'lucide-react';
import { DelayBadge, LiveDot } from '@/components/common/RealtimeBadge';
import { LineBadge, LineBadgeList } from '@/components/common/LineBadge';
import { useAsyncData } from '@/hooks/useAsyncData';
import { getDepartures } from '@/lib/api';
import { formatTime, isValidTime } from '@/lib/format';
import { sortLines } from '@/lib/text';
import { cn } from '@/lib/utils';
import type { LineSummary, StopSummary } from '@/types';
import { PopupActions } from './PopupActions';

const DEPARTURES_LIMIT = 8;

interface StopPopupContentProps {
    stop: StopSummary;
    /** "HH:MM" from which departures are listed. */
    time: string;
    linesById: ReadonlyMap<string, LineSummary>;
    onOrigin: () => void;
    onDestination: () => void;
    /** Called when the content size changed (so Leaflet can re-position the popup). */
    onLayoutChange: () => void;
}

export function StopPopupContent({
    stop,
    time,
    linesById,
    onOrigin,
    onDestination,
    onLayoutChange,
}: StopPopupContentProps) {
    const fromTime = isValidTime(time) ? time : undefined;
    const departures = useAsyncData(`${stop.stopPointId}@${fromTime ?? 'now'}`, (signal) =>
        getDepartures(stop.stopPointId, { time: fromTime, limit: DEPARTURES_LIMIT }, signal),
    );

    const notifyLayout = useEffectEvent(onLayoutChange);
    useEffect(() => {
        notifyLayout();
    }, [departures.status]);

    return (
        <div className="w-72 text-sm text-foreground">
            <div className="space-y-2 border-b p-3.5 pr-10">
                <div>
                    <div className="flex items-center gap-1.5">
                        <h3 className="text-[15px] font-semibold leading-tight">{stop.name}</h3>
                        {stop.accessible && (
                            <Accessibility className="h-3.5 w-3.5 shrink-0 text-muted-foreground" role="img" aria-label="Arrêt accessible" />
                        )}
                    </div>
                    {stop.city && <div className="text-xs text-muted-foreground">{stop.city}</div>}
                </div>
                <LineBadgeList lines={sortLines(stop.lines ?? [])} linesById={linesById} max={14} />
            </div>

            <div className="p-3.5 pt-3">
                <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {fromTime ? `Prochains départs dès ${formatTime(fromTime)}` : 'Prochains départs'}
                </h4>
                {departures.status === 'loading' && (
                    <ul className="space-y-1.5" aria-label="Chargement des départs">
                        {[0, 1, 2].map(i => (
                            <li key={i} className="skeleton h-5" />
                        ))}
                    </ul>
                )}
                {departures.status === 'error' && (
                    <p className="text-xs text-danger" title={departures.message}>
                        Horaires indisponibles pour cet arrêt.
                    </p>
                )}
                {departures.status === 'success' &&
                    (departures.data.departures.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Aucun départ prévu après cette heure.</p>
                    ) : (
                        <ul className="scrollbar-thin -mx-1 max-h-44 overflow-y-auto">
                            {departures.data.departures.map((d, i) => (
                                <li key={`${d.tripId}-${i}`} className={cn('flex items-center gap-2 rounded-md px-1 py-1', d.cancelled && 'opacity-60')}>
                                    <time className={cn('w-10 shrink-0 text-[13px] font-medium tnum', d.cancelled && 'line-through')}>
                                        {formatTime(d.realtime?.time ?? d.time)}
                                    </time>
                                    <LineBadge line={d.line} color={d.color} textColor={d.textColor} title={d.lineName} />
                                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={d.headsign}>
                                        {d.headsign}
                                    </span>
                                    {d.cancelled ? (
                                        <span className="text-2xs font-medium text-danger">supprimé</span>
                                    ) : (
                                        d.realtime && (
                                            <span className="flex items-center gap-1">
                                                <LiveDot />
                                                <DelayBadge delay={d.realtime.delay} />
                                            </span>
                                        )
                                    )}
                                </li>
                            ))}
                        </ul>
                    ))}
                <div className="mt-3">
                    <PopupActions onOrigin={onOrigin} onDestination={onDestination} />
                </div>
            </div>
        </div>
    );
}
