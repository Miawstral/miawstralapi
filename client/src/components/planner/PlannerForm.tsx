import { useMemo, useState } from 'react';
import { Accessibility, ArrowDownUp, ChevronDown, Clock3, LoaderCircle, LocateFixed, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover } from '@/components/ui/popover';
import { Segmented } from '@/components/ui/segmented';
import { useGeolocation } from '@/hooks/useGeolocation';
import type { NetworkData } from '@/hooks/useNetwork';
import { currentTime, formatDistance, isValidTime } from '@/lib/format';
import { fieldFromPlace, MY_POSITION_LABEL, pointPlace, type PlaceField } from '@/lib/places';
import { DEFAULT_OPTIONS, TRANSFER_CHOICES, WALKING_CHOICES, type SearchOptions } from '@/lib/searchOptions';
import { cn } from '@/lib/utils';
import { PlaceCombobox, type ExtraOption } from './PlaceCombobox';

export type TimeMode = 'now' | 'at' | 'arrive';

interface PlannerFormProps {
    from: PlaceField;
    to: PlaceField;
    onFromChange: (field: PlaceField) => void;
    onToChange: (field: PlaceField) => void;
    onSwap: () => void;
    timeMode: TimeMode;
    time: string;
    onTimeModeChange: (mode: TimeMode) => void;
    onTimeChange: (time: string) => void;
    /** Service day YYYY-MM-DD, null for today. */
    date: string | null;
    onDateChange: (date: string | null) => void;
    /** Days covered by the timetables. */
    dateRange: { from: string | null; to: string | null };
    options: SearchOptions;
    onOptionsChange: (options: SearchOptions) => void;
    network: NetworkData;
    /** Called when a field gets the focus (the mobile sheet expands). */
    onFieldFocus?: () => void;
}

export function PlannerForm({
    from,
    to,
    onFromChange,
    onToChange,
    onSwap,
    timeMode,
    time,
    onTimeModeChange,
    onTimeChange,
    date,
    onDateChange,
    dateRange,
    options,
    onOptionsChange,
    network,
    onFieldFocus,
}: PlannerFormProps) {
    const { locate, locating } = useGeolocation();
    const [geoError, setGeoError] = useState<string | null>(null);

    const stopsStatus =
        network.stopsState.status === 'error' ? 'error' : network.stopsState.status === 'success' ? 'ready' : 'loading';

    const myPosition = useMemo<ExtraOption[]>(
        () => [
            {
                id: 'my-position',
                icon: locating ? (
                    <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                ) : (
                    <LocateFixed className="h-4 w-4" aria-hidden="true" />
                ),
                label: MY_POSITION_LABEL,
                description: 'Partir de là où vous êtes',
                onSelect: () => {
                    setGeoError(null);
                    locate().then(
                        ({ lat, lon }) => onFromChange(fieldFromPlace(pointPlace(lat, lon, MY_POSITION_LABEL))),
                        (error: Error) => setGeoError(error.message),
                    );
                },
            },
        ],
        [locate, locating, onFromChange],
    );

    const combobox = {
        stopsIndex: network.stopsIndex,
        stopsStatus,
        linesById: network.linesById,
        onFocus: onFieldFocus,
    } as const;

    return (
        <form role="search" aria-label="Rechercher un itinéraire" onSubmit={event => event.preventDefault()} className="space-y-2.5">
            <div className="flex items-center gap-1.5">
                <div className="relative min-w-0 flex-1 rounded-xl bg-surface shadow-control transition-shadow focus-within:shadow-[0_0_0_1px_hsl(var(--foreground)/0.35),0_1px_2px_rgb(0_0_0/0.06)]">
                    {/* Origin → destination rail */}
                    <span aria-hidden="true" className="pointer-events-none absolute bottom-[22px] left-[19px] top-[22px] z-10 flex flex-col items-center">
                        <span className="-mt-[5px] h-2.5 w-2.5 rounded-full border-2 border-foreground bg-surface" />
                        <span className="my-1 w-0 flex-1 border-l-2 border-dotted border-muted-foreground/50" />
                        <span className="-mb-[5px] h-2.5 w-2.5 rounded-[3px] bg-foreground" />
                    </span>
                    <PlaceCombobox
                        {...combobox}
                        label="Départ"
                        placeholder="Départ"
                        field={from}
                        onTextChange={text => onFromChange({ text, place: null })}
                        onSelect={place => onFromChange(fieldFromPlace(place))}
                        extraOptions={myPosition}
                    />
                    <div className="ml-10 border-t" />
                    <PlaceCombobox
                        {...combobox}
                        label="Arrivée"
                        placeholder="Arrivée"
                        field={to}
                        onTextChange={text => onToChange({ text, place: null })}
                        onSelect={place => onToChange(fieldFromPlace(place))}
                    />
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onSwap}
                    aria-label="Inverser départ et arrivée"
                    title="Inverser"
                    disabled={!from.text && !to.text}
                >
                    <ArrowDownUp aria-hidden="true" />
                </Button>
            </div>

            {geoError && (
                <p role="alert" className="px-1 text-xs text-danger">
                    {geoError}
                </p>
            )}

            <div className="relative flex items-center gap-1.5">
                <TimeControl
                    mode={timeMode}
                    time={time}
                    onModeChange={onTimeModeChange}
                    onTimeChange={onTimeChange}
                    date={date}
                    onDateChange={onDateChange}
                    dateRange={dateRange}
                />
                <OptionsControl options={options} onChange={onOptionsChange} />
            </div>
        </form>
    );
}

const dayFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

function dayLabel(date: string | null): string {
    if (!date || date === todayIso()) return '';
    if (date === addDays(todayIso(), 1)) return 'demain';
    return dayFormatter.format(new Date(`${date}T12:00:00`));
}

function TimeControl({
    mode,
    time,
    onModeChange,
    onTimeChange,
    date,
    onDateChange,
    dateRange,
}: {
    mode: TimeMode;
    time: string;
    onModeChange: (mode: TimeMode) => void;
    onTimeChange: (time: string) => void;
    date: string | null;
    onDateChange: (date: string | null) => void;
    dateRange: { from: string | null; to: string | null };
}) {
    const day = dayLabel(date);
    const label =
        mode === 'now' ? (
            day ? `Partir ${day}` : 'Partir maintenant'
        ) : (
            <span>
                {mode === 'arrive' ? 'Arriver à' : 'Départ à'} <span className="tnum">{time}</span>
                {day && ` · ${day}`}
            </span>
        );
    const today = todayIso();
    const quickDays = [today, addDays(today, 1), addDays(today, 2)];
    return (
        <Popover
            label="Date et heure"
            fullWidth
            trigger={props => (
                <Button {...props} size="sm" variant="subtle" className="pl-2 pr-1.5">
                    <Clock3 aria-hidden="true" className="text-muted-foreground" />
                    {label}
                    <ChevronDown aria-hidden="true" className="text-muted-foreground" />
                </Button>
            )}
        >
            <div className="space-y-3">
                <Segmented
                    label="Moment"
                    value={mode}
                    onChange={next => {
                        if (next !== 'now' && !isValidTime(time)) onTimeChange(currentTime());
                        onModeChange(next);
                    }}
                    options={[
                        { value: 'now', label: 'Maintenant' },
                        { value: 'at', label: 'Partir à' },
                        { value: 'arrive', label: 'Arriver à' },
                    ]}
                />
                <div className="grid grid-cols-[1fr_auto] gap-2">
                    <label className="block space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Jour</span>
                        <input
                            type="date"
                            value={date ?? today}
                            min={dateRange.from ?? undefined}
                            max={dateRange.to ?? undefined}
                            onChange={event => onDateChange(event.target.value && event.target.value !== today ? event.target.value : null)}
                            className="h-9 w-full rounded-lg bg-surface px-2.5 text-sm tnum shadow-control outline-none focus:shadow-[0_0_0_1px_hsl(var(--foreground)/0.4)]"
                        />
                    </label>
                    <label className={cn('block space-y-1', mode === 'now' && 'opacity-50')}>
                        <span className="text-xs font-medium text-muted-foreground">Heure</span>
                        <input
                            type="time"
                            step={60}
                            value={mode === 'now' ? currentTime() : time}
                            disabled={mode === 'now'}
                            onChange={event => {
                                if (isValidTime(event.target.value)) onTimeChange(event.target.value);
                            }}
                            className="h-9 w-28 rounded-lg bg-surface px-2.5 text-sm tnum shadow-control outline-none focus:shadow-[0_0_0_1px_hsl(var(--foreground)/0.4)]"
                        />
                    </label>
                </div>
                <div className="flex gap-1.5">
                    {quickDays.map((d, i) => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => onDateChange(i === 0 ? null : d)}
                            className={cn(
                                'h-7 rounded-full px-2.5 text-xs font-medium transition-colors',
                                (date ?? today) === d ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {i === 0 ? 'Aujourd’hui' : i === 1 ? 'Demain' : dayFormatter.format(new Date(`${d}T12:00:00`))}
                        </button>
                    ))}
                </div>
            </div>
        </Popover>
    );
}

function OptionsControl({ options, onChange }: { options: SearchOptions; onChange: (options: SearchOptions) => void }) {
    const modified =
        options.maxTransfers !== DEFAULT_OPTIONS.maxTransfers ||
        options.maxWalkingDistance !== DEFAULT_OPTIONS.maxWalkingDistance ||
        options.wheelchair !== DEFAULT_OPTIONS.wheelchair;
    return (
        <Popover
            label="Options de recherche"
            fullWidth
            trigger={props => (
                <Button {...props} size="sm" variant="subtle" className="pl-2 pr-2.5">
                    <SlidersHorizontal aria-hidden="true" className="text-muted-foreground" />
                    Options
                    {modified && <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-label="modifiées" />}
                </Button>
            )}
        >
            <div className="space-y-3.5">
                <div className="space-y-1.5">
                    <div className="text-xs font-medium text-muted-foreground">Correspondances maximum</div>
                    <Segmented
                        label="Correspondances maximum"
                        value={options.maxTransfers}
                        onChange={maxTransfers => onChange({ ...options, maxTransfers })}
                        options={TRANSFER_CHOICES.map(n => ({ value: n, label: n === 0 ? 'Direct' : String(n) }))}
                    />
                </div>
                <div className="space-y-1.5">
                    <div className="text-xs font-medium text-muted-foreground">Marche maximum jusqu’à un arrêt</div>
                    <Segmented
                        label="Marche maximum"
                        value={options.maxWalkingDistance}
                        onChange={maxWalkingDistance => onChange({ ...options, maxWalkingDistance })}
                        options={WALKING_CHOICES.map(m => ({ value: m, label: formatDistance(m) }))}
                    />
                </div>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-subtle px-3 py-2.5 shadow-control">
                    <span className="flex items-center gap-2 text-[13px]">
                        <Accessibility className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        Accessible en fauteuil roulant
                    </span>
                    <input
                        type="checkbox"
                        role="switch"
                        checked={options.wheelchair}
                        onChange={event => onChange({ ...options, wheelchair: event.target.checked })}
                        className="peer sr-only"
                    />
                    <span
                        aria-hidden="true"
                        className="relative h-5 w-9 rounded-full bg-border transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-surface after:shadow after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                    />
                </label>
                {modified && (
                    <Button size="sm" variant="ghost" className="-ml-2" onClick={() => onChange(DEFAULT_OPTIONS)}>
                        Réinitialiser
                    </Button>
                )}
            </div>
        </Popover>
    );
}
