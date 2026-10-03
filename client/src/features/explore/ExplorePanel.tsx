import { useMemo, useState } from 'react';
import { Compass, LoaderCircle, LocateFixed } from 'lucide-react';
import { Notice } from '@/components/common/Notice';
import { PlaceCombobox, type ExtraOption } from '@/components/planner/PlaceCombobox';
import { Segmented } from '@/components/ui/segmented';
import type { AsyncState } from '@/hooks/useAsyncData';
import { useGeolocation } from '@/hooks/useGeolocation';
import type { NetworkData } from '@/hooks/useNetwork';
import { fieldFromPlace, MY_POSITION_LABEL, pointPlace, type PlaceField } from '@/lib/places';
import type { IsochroneResponse, StopSummary } from '@/types';
import { DURATION_CHOICES, ISOCHRONE_STEPS } from './isochrone';

interface ExplorePanelProps {
    origin: PlaceField;
    onOriginChange: (field: PlaceField) => void;
    maxDuration: number;
    onMaxDurationChange: (minutes: number) => void;
    result: AsyncState<IsochroneResponse>;
    network: NetworkData;
}

/** "Jusqu'où aller en 30 min ?": travel times to every stop from a place. */
export function ExplorePanel({ origin, onOriginChange, maxDuration, onMaxDurationChange, result, network }: ExplorePanelProps) {
    const { locate, locating } = useGeolocation();
    const [geoError, setGeoError] = useState<string | null>(null);

    const myPosition = useMemo<ExtraOption[]>(
        () => [
            {
                id: 'my-position',
                icon: locating ? <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" /> : <LocateFixed className="h-4 w-4" />,
                label: MY_POSITION_LABEL,
                description: 'Explorer depuis là où vous êtes',
                onSelect: () => {
                    setGeoError(null);
                    locate().then(
                        ({ lat, lon }) => onOriginChange(fieldFromPlace(pointPlace(lat, lon, MY_POSITION_LABEL))),
                        (error: Error) => setGeoError(error.message),
                    );
                },
            },
        ],
        [locate, locating, onOriginChange],
    );

    const stopsById = useMemo(() => new Map<string, StopSummary>(network.stops.map(s => [s.stopPointId, s])), [network.stops]);
    const data = result.status === 'success' ? result.data : null;

    // Fastest time to reach each town.
    const towns = useMemo(() => {
        if (!data) return [];
        const best = new Map<string, number>();
        for (const stop of data.stops) {
            const city = stopsById.get(stop.stopPointId)?.city;
            if (city && (best.get(city) ?? Infinity) > stop.duration) best.set(city, stop.duration);
        }
        return [...best.entries()].sort((a, b) => a[1] - b[1]);
    }, [data, stopsById]);

    return (
        <div className="space-y-4 p-3">
            <div className="space-y-2.5">
                <div className="relative rounded-xl bg-surface shadow-control">
                    <Compass className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <PlaceCombobox
                        label="Point de départ de l’exploration"
                        placeholder="Explorer depuis…"
                        field={origin}
                        onTextChange={text => onOriginChange({ text, place: null })}
                        onSelect={place => onOriginChange(fieldFromPlace(place))}
                        stopsIndex={network.stopsIndex}
                        stopsStatus={network.stopsState.status === 'success' ? 'ready' : network.stopsState.status === 'error' ? 'error' : 'loading'}
                        linesById={network.linesById}
                        extraOptions={myPosition}
                    />
                </div>
                {geoError && <p className="px-1 text-xs text-danger">{geoError}</p>}
                <div className="space-y-1.5">
                    <div className="px-1 text-xs font-medium text-muted-foreground">Temps de trajet maximum, en partant maintenant</div>
                    <Segmented
                        label="Temps de trajet maximum"
                        value={maxDuration}
                        onChange={onMaxDurationChange}
                        options={DURATION_CHOICES.map(m => ({ value: m, label: `${m} min` }))}
                    />
                </div>
            </div>

            {!origin.place && (
                <p className="px-1 text-[13px] leading-relaxed text-muted-foreground">
                    Choisissez un arrêt, votre position ou touchez la carte : chaque arrêt atteignable se colore selon le temps de trajet,
                    marche et correspondances comprises.
                </p>
            )}

            {origin.place && result.status === 'loading' && (
                <div className="space-y-2" aria-busy="true">
                    <div className="skeleton h-16" />
                    <div className="skeleton h-24" />
                </div>
            )}
            {result.status === 'error' && <Notice tone="error">{result.message}</Notice>}

            {data && (
                <div className="space-y-4 motion-safe:animate-rise-in">
                    <div className="rounded-xl bg-subtle p-3.5 shadow-control">
                        <div className="text-2xl font-semibold tracking-tight tnum">{data.stops.length.toLocaleString('fr-FR')}</div>
                        <div className="text-[13px] text-muted-foreground">
                            arrêts accessibles en moins de {data.maxDuration} min, départ {data.departureTime}
                        </div>
                        <div className="mt-3 flex overflow-hidden rounded-full" aria-hidden="true">
                            {ISOCHRONE_STEPS.filter(s => s.max - 10 < data.maxDuration).map(step => (
                                <span key={step.label} className="h-1.5 flex-1" style={{ backgroundColor: step.color }} />
                            ))}
                        </div>
                        <div className="mt-1.5 flex justify-between text-2xs text-muted-foreground tnum">
                            <span>0 min</span>
                            <span>{data.maxDuration} min</span>
                        </div>
                    </div>

                    {towns.length > 0 && (
                        <section>
                            <h3 className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">Communes atteintes</h3>
                            <ul className="grid grid-cols-2 gap-1.5">
                                {towns.map(([town, minutes]) => (
                                    <li key={town} className="flex items-center justify-between gap-2 rounded-lg bg-subtle px-2.5 py-2 text-[13px] shadow-control">
                                        <span className="truncate">{town}</span>
                                        <span className="shrink-0 font-medium tnum">{minutes} min</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                    <p className="px-1 text-2xs text-muted-foreground">Calculé en {data.calculationTime} ms avec RAPTOR sur les horaires officiels.</p>
                </div>
            )}
        </div>
    );
}
