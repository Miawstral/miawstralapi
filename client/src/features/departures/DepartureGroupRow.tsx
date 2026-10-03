import { memo } from 'react';
import { DelayBadge, LiveDot } from '@/components/common/RealtimeBadge';
import { formatTime } from '@/lib/format';
import { formatCountdown, formatDelay } from '@/lib/realtime';
import { cn } from '@/lib/utils';
import { LineBadgeButton } from '@/features/lines/LineBadgeButton';
import type { DepartureGroup, TimedDeparture } from './departuresUtils';

interface DepartureGroupRowProps {
    group: DepartureGroup;
    onSelectLine: (lineId: string) => void;
}

/** One line + headsign of the board, with its next departures as countdowns. */
export const DepartureGroupRow = memo(function DepartureGroupRow({ group, onSelectLine }: DepartureGroupRowProps) {
    return (
        <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 py-3">
            <LineBadgeButton
                line={group.line}
                color={group.color}
                textColor={group.textColor}
                lineName={group.lineName}
                size="lg"
                onSelect={onSelectLine}
                className="self-start"
            />
            <div className="min-w-0">
                <p className="flex h-8 min-w-0 items-center gap-1.5 text-sm font-medium" title={group.headsign}>
                    <span className="text-muted-foreground" aria-hidden="true">
                        →
                    </span>
                    <span className="sr-only">Direction </span>
                    <span className="truncate">{group.headsign}</span>
                </p>
                <ol className="mt-0.5 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-2">
                    {group.departures.map((item, index) => (
                        <DepartureCell key={`${item.departure.tripId}-${item.departure.time}-${index}`} item={item} first={index === 0} />
                    ))}
                </ol>
            </div>
        </li>
    );
});

function DepartureCell({ item, first }: { item: TimedDeparture; first: boolean }) {
    const { departure, minutes } = item;
    const time = formatTime(item.time);
    const label = formatCountdown(minutes, time);
    const approaching = minutes !== null && minutes < 1;
    const realtime = departure.realtime;
    const cancelled = departure.cancelled;

    const spoken = cancelled
        ? `${time}, supprimé`
        : `${minutes !== null && minutes < 60 ? (approaching ? 'à l’approche' : `dans ${label}`) : `à ${time}`}${
              realtime ? `, temps réel, ${formatDelay(realtime.delay)}` : ', horaire théorique'
          }`;

    return (
        <li className="min-w-0" title={realtime && !cancelled ? `Prévu à ${formatTime(departure.time)}, attendu à ${time}` : `Prévu à ${formatTime(departure.time)}`}>
            <span
                aria-hidden="true"
                className={cn(
                    'block whitespace-nowrap leading-6 tracking-tight tnum',
                    first ? (approaching ? 'text-[15px] font-semibold' : 'text-[17px] font-semibold') : approaching ? 'text-[13px] font-medium' : 'text-[15px] font-medium',
                    !first && !cancelled && 'text-foreground/75',
                    cancelled && 'text-muted-foreground line-through decoration-muted-foreground/70',
                )}
            >
                {label}
            </span>
            <span aria-hidden="true" className="flex h-4 items-center gap-1 whitespace-nowrap text-2xs">
                {cancelled ? (
                    <span className="font-medium text-danger">supprimé</span>
                ) : realtime ? (
                    <>
                        {first ? <LiveDot /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />}
                        <DelayBadge delay={realtime.delay} />
                    </>
                ) : (
                    <span className="text-muted-foreground">théorique</span>
                )}
            </span>
            <span className="sr-only">{spoken}</span>
        </li>
    );
}
