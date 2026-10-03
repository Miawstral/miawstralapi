import { memo, useMemo } from 'react';
import { Accessibility } from 'lucide-react';
import { ModeIcon } from '@/components/common/ModeIcon';
import { MODE_LABELS } from '@/lib/modes';
import { DelayBadge } from '@/components/common/RealtimeBadge';
import { lineColor, strokeColor, textColorOn } from '@/lib/colors';
import { formatDelay } from '@/lib/realtime';
import { cn } from '@/lib/utils';
import type { LineStop, TransitMode, Vehicle } from '@/types';
import { minutesToTime, nextPassageIndex, serviceMinutes } from './lineUtils';

export interface SelectedStop {
    stopPointId: string;
    name: string;
    lat: number;
    lon: number;
}

interface LineStopsTimelineProps {
    stops: LineStop[];
    color: string;
    textColor: string;
    mode: TransitMode;
    dark: boolean;
    /** Live vehicles of this direction, by the stop they are heading to. */
    vehiclesByStop: ReadonlyMap<string, Vehicle[]>;
    /** Minutes since midnight to look the next passage from; null to show the first passage of the day. */
    fromMinutes: number | null;
    onSelectStop: (stop: SelectedStop) => void;
}

/** Distance from the top of a row to the center of its stop node. */
const NODE_Y = 18;

/** Stops of a direction on the line's colored rail, with the next passage and the approaching vehicles. */
export function LineStopsTimeline({
    stops,
    color,
    textColor,
    mode,
    dark,
    vehiclesByStop,
    fromMinutes,
    onSelectStop,
}: LineStopsTimelineProps) {
    const rail = strokeColor(color, dark);
    const passages = useMemo(() => stops.map(stop => serviceMinutes(stop.times)), [stops]);

    return (
        <ol className="px-2">
            {stops.map((stop, index) => {
                const times = passages[index];
                const next = fromMinutes === null ? (times.length ? 0 : -1) : nextPassageIndex(times, Math.floor(fromMinutes));
                const minutes = next >= 0 ? times[next] : null;
                const wait = minutes !== null && fromMinutes !== null ? minutes - fromMinutes : null;
                return (
                    <StopRow
                        key={`${stop.stopPointId}-${index}`}
                        stop={stop}
                        position={index === 0 ? 'first' : index === stops.length - 1 ? 'last' : 'middle'}
                        showCity={Boolean(stop.city) && stop.city !== stops[index - 1]?.city}
                        rail={rail}
                        badgeColor={lineColor(color)}
                        badgeText={textColor || textColorOn(color)}
                        mode={mode}
                        passage={minutes === null ? null : minutesToTime(minutes)}
                        wait={wait === null ? null : Math.floor(wait)}
                        later={next >= 0 ? times.slice(next + 1, next + 4).map(minutesToTime).join(', ') : ''}
                        vehicles={vehiclesByStop.get(stop.stopPointId)}
                        onSelectStop={onSelectStop}
                    />
                );
            })}
        </ol>
    );
}

interface StopRowProps {
    stop: LineStop;
    position: 'first' | 'middle' | 'last';
    showCity: boolean;
    rail: string;
    badgeColor: string;
    badgeText: string;
    mode: TransitMode;
    /** Next passage "HH:MM", null when there is none left today. */
    passage: string | null;
    /** Minutes until it (null when showing first passages). */
    wait: number | null;
    /** Following passages, "HH:MM, HH:MM". */
    later: string;
    vehicles: Vehicle[] | undefined;
    onSelectStop: (stop: SelectedStop) => void;
}

const SOON_MINUTES = 30;

const StopRow = memo(function StopRow({
    stop,
    position,
    showCity,
    rail,
    badgeColor,
    badgeText,
    mode,
    passage,
    wait,
    later,
    vehicles,
    onSelectStop,
}: StopRowProps) {
    const terminus = position !== 'middle';
    const vehicle = vehicles?.[0];
    const stopped = vehicle?.status === 'STOPPED_AT';
    const vehicleLabel = vehicle
        ? `${MODE_LABELS[mode]} ${stopped ? 'à l’arrêt' : 'en approche'}${vehicle.delay !== null ? ` (${formatDelay(vehicle.delay)})` : ''}${
              vehicles && vehicles.length > 1 ? `, et ${vehicles.length - 1} autre${vehicles.length > 2 ? 's' : ''}` : ''
          }`
        : null;

    const timeLabel =
        passage === null ? '—' : wait === null || wait >= SOON_MINUTES ? passage : wait < 1 ? 'à l’approche' : `dans ${wait} min`;
    const timeTitle =
        passage === null ? 'Plus de passage aujourd’hui' : `Passages : ${passage}${later ? `, ${later}…` : ''}`;

    const select = () => {
        const lat = Number.parseFloat(stop.latitude);
        const lon = Number.parseFloat(stop.longitude);
        onSelectStop({ stopPointId: stop.stopPointId, name: stop.name, lat, lon });
    };

    return (
        <li>
            <button
                type="button"
                onClick={select}
                className="grid w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] gap-x-2 rounded-lg pr-2 text-left transition-colors hover:bg-subtle focus-visible:bg-subtle"
            >
                {/* Rail, stop node and approaching vehicle. */}
                <span aria-hidden="true" className="relative">
                    {position !== 'first' && (
                        <span className="absolute left-1/2 top-0 w-1 -translate-x-1/2" style={{ height: NODE_Y, backgroundColor: rail }} />
                    )}
                    {position !== 'last' && (
                        <span className="absolute bottom-0 left-1/2 w-1 -translate-x-1/2" style={{ top: NODE_Y, backgroundColor: rail }} />
                    )}
                    <span
                        className={cn(
                            'absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface',
                            terminus ? 'h-3.5 w-3.5 border-[3px]' : 'h-2.5 w-2.5 border-[2.5px]',
                        )}
                        style={{ top: NODE_Y, borderColor: rail }}
                    />
                    {vehicle && (
                        <span
                            className="absolute left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-[0_0_0_2px_hsl(var(--surface)),0_1px_4px_rgb(0_0_0/0.35)]"
                            style={{ top: stopped ? NODE_Y : position === 'first' ? 3 : 0, backgroundColor: badgeColor, color: badgeText }}
                        >
                            <ModeIcon mode={mode} className="h-3 w-3" />
                        </span>
                    )}
                </span>

                <span className="min-w-0 py-2">
                    <span className="flex items-center gap-1">
                        <span className={cn('truncate text-sm leading-5', terminus ? 'font-semibold' : 'text-foreground/90')}>{stop.name}</span>
                        {stop.accessible && (
                            <Accessibility className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" role="img" aria-label="Arrêt accessible" />
                        )}
                    </span>
                    {showCity && <span className="block truncate text-2xs text-muted-foreground">{stop.city}</span>}
                </span>

                <span className="flex h-9 items-center gap-2">
                    {vehicle && vehicleLabel && (
                        <span
                            title={vehicleLabel}
                            className="inline-flex h-5 items-center gap-1 rounded-full bg-surface pl-1.5 pr-2 shadow-control motion-safe:animate-fade-in"
                        >
                            <span aria-hidden="true" className="contents">
                                <ModeIcon mode={mode} className="h-3 w-3 shrink-0 text-muted-foreground" />
                                {vehicle.delay !== null ? (
                                    <DelayBadge delay={vehicle.delay} />
                                ) : (
                                    <span className="text-2xs font-medium text-muted-foreground">en approche</span>
                                )}
                                {vehicles && vehicles.length > 1 && (
                                    <span className="text-2xs font-medium text-muted-foreground">×{vehicles.length}</span>
                                )}
                            </span>
                            <span className="sr-only">{vehicleLabel}</span>
                        </span>
                    )}
                    <span
                        title={timeTitle}
                        className={cn(
                            'min-w-[3.25rem] text-right text-[13px] tnum',
                            passage === null
                                ? 'text-muted-foreground/70'
                                : wait !== null && wait < 1
                                  ? 'font-semibold text-foreground'
                                  : wait !== null && wait < SOON_MINUTES
                                    ? 'font-medium text-foreground'
                                    : 'text-foreground/80',
                        )}
                    >
                        {timeLabel}
                        {passage === null && <span className="sr-only">Plus de passage aujourd’hui</span>}
                    </span>
                </span>
            </button>
        </li>
    );
});
