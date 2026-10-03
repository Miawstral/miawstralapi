import { useMemo, useState } from 'react';
import { ArrowDownUp, ChevronDown, Clock3, LoaderCircle, LocateFixed, SlidersHorizontal } from 'lucide-react';
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

export type TimeMode = 'now' | 'at';

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
                <TimeControl mode={timeMode} time={time} onModeChange={onTimeModeChange} onTimeChange={onTimeChange} />
                <OptionsControl options={options} onChange={onOptionsChange} />
            </div>
        </form>
    );
}

function TimeControl({
    mode,
    time,
    onModeChange,
    onTimeChange,
}: {
    mode: TimeMode;
    time: string;
    onModeChange: (mode: TimeMode) => void;
    onTimeChange: (time: string) => void;
}) {
    return (
        <Popover
            label="Heure de départ"
            fullWidth
            trigger={props => (
                <Button {...props} size="sm" variant="subtle" className="pl-2 pr-1.5">
                    <Clock3 aria-hidden="true" className="text-muted-foreground" />
                    {mode === 'now' ? 'Partir maintenant' : <span>Départ à <span className="tnum">{time}</span></span>}
                    <ChevronDown aria-hidden="true" className="text-muted-foreground" />
                </Button>
            )}
        >
            <div className="space-y-3">
                <Segmented
                    label="Moment du départ"
                    value={mode}
                    onChange={next => {
                        if (next === 'at' && !isValidTime(time)) onTimeChange(currentTime());
                        onModeChange(next);
                    }}
                    options={[
                        { value: 'now', label: 'Maintenant' },
                        { value: 'at', label: 'Partir à' },
                    ]}
                />
                <label className={cn('block space-y-1', mode === 'now' && 'opacity-50')}>
                    <span className="text-xs font-medium text-muted-foreground">Heure de départ (aujourd’hui)</span>
                    <input
                        type="time"
                        step={60}
                        value={mode === 'now' ? currentTime() : time}
                        disabled={mode === 'now'}
                        onChange={event => {
                            if (isValidTime(event.target.value)) onTimeChange(event.target.value);
                        }}
                        className="h-9 w-full rounded-lg bg-surface px-2.5 text-sm tnum shadow-control outline-none focus:shadow-[0_0_0_1px_hsl(var(--foreground)/0.4)]"
                    />
                </label>
            </div>
        </Popover>
    );
}

function OptionsControl({ options, onChange }: { options: SearchOptions; onChange: (options: SearchOptions) => void }) {
    const modified =
        options.maxTransfers !== DEFAULT_OPTIONS.maxTransfers ||
        options.maxWalkingDistance !== DEFAULT_OPTIONS.maxWalkingDistance;
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
                {modified && (
                    <Button size="sm" variant="ghost" className="-ml-2" onClick={() => onChange(DEFAULT_OPTIONS)}>
                        Réinitialiser
                    </Button>
                )}
            </div>
        </Popover>
    );
}
