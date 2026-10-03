import { useId, useMemo, useRef, useState } from 'react';
import { Accessibility, LoaderCircle, LocateFixed, MousePointerClick, Search, Star } from 'lucide-react';
import { LineBadgeList } from '@/components/common/LineBadge';
import { PlaceCombobox, type ExtraOption } from '@/components/planner/PlaceCombobox';
import { Button } from '@/components/ui/button';
import { useGeolocation } from '@/hooks/useGeolocation';
import { getErrorMessage, getNearbyStops } from '@/lib/api';
import { useFavorites } from '@/lib/favorites';
import { formatDistance } from '@/lib/format';
import { useRevealOnMount } from '@/features/lines/scroll';
import { sortLines, type IndexedStop } from '@/lib/text';
import type { LineSummary, StopSummary } from '@/types';

interface StopPickerProps {
    onStopChange: (stop: StopSummary) => void;
    stopsIndex: IndexedStop[];
    stopsStatus: 'loading' | 'error' | 'ready';
    linesById: ReadonlyMap<string, LineSummary>;
}

const NEARBY_RADIUS = 800;

/** Choice of a stop: search, nearest stop, favorites. */
export function StopPicker({ onStopChange, stopsIndex, stopsStatus, linesById }: StopPickerProps) {
    const titleId = useId();
    const rootRef = useRef<HTMLElement>(null);
    useRevealOnMount(rootRef);
    const [text, setText] = useState('');
    const [geoMessage, setGeoMessage] = useState<string | null>(null);
    const { locate, locating } = useGeolocation();
    const [searchingNearby, setSearchingNearby] = useState(false);
    const busy = locating || searchingNearby;

    const nearest = useMemo<ExtraOption[]>(
        () => [
            {
                id: 'nearest-stop',
                icon: busy ? (
                    <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                ) : (
                    <LocateFixed className="h-4 w-4" aria-hidden="true" />
                ),
                label: 'Arrêt le plus proche',
                description: 'Les départs autour de vous',
                onSelect: () => {
                    setGeoMessage(null);
                    locate()
                        .then(async ({ lat, lon }) => {
                            setSearchingNearby(true);
                            try {
                                const stops = await getNearbyStops(lat, lon, NEARBY_RADIUS);
                                const closest = [...stops].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))[0];
                                if (closest) onStopChange(closest);
                                else setGeoMessage(`Aucun arrêt à moins de ${formatDistance(NEARBY_RADIUS)} de votre position.`);
                            } finally {
                                setSearchingNearby(false);
                            }
                        })
                        .catch((error: unknown) => setGeoMessage(getErrorMessage(error)));
                },
            },
        ],
        [busy, locate, onStopChange],
    );

    return (
        <section ref={rootRef} aria-labelledby={titleId} className="pb-4">
            <header className="px-4 pb-3 pt-4">
                <h2 id={titleId} className="text-[17px] font-semibold tracking-tight">
                    Prochains départs
                </h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">En temps réel, à chaque arrêt du réseau.</p>
                <div className="relative mt-3 rounded-lg bg-surface shadow-control transition-shadow focus-within:shadow-[0_0_0_1px_hsl(var(--foreground)/0.35),0_1px_2px_rgb(0_0_0/0.06)]">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <PlaceCombobox
                        label="Arrêt"
                        placeholder="Rechercher un arrêt"
                        field={{ text, place: null }}
                        onTextChange={setText}
                        onSelect={place => {
                            if (place.kind === 'stop') onStopChange(place.stop);
                        }}
                        stopsIndex={stopsIndex}
                        stopsStatus={stopsStatus}
                        linesById={linesById}
                        extraOptions={nearest}
                    />
                </div>
                {geoMessage && (
                    <p role="alert" className="mt-2 px-1 text-xs text-danger">
                        {geoMessage}
                    </p>
                )}
            </header>

            <div className="space-y-5 px-3">
                <Favorites onStopChange={onStopChange} linesById={linesById} />
                <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted-foreground">
                    <MousePointerClick className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Vous pouvez aussi choisir un arrêt sur la carte, ou depuis le détail d’une ligne.
                </p>
            </div>
        </section>
    );
}

function Favorites({ onStopChange, linesById }: { onStopChange: (stop: StopSummary) => void; linesById: ReadonlyMap<string, LineSummary> }) {
    const titleId = useId();
    const { favorites, toggle } = useFavorites();

    return (
        <section aria-labelledby={titleId}>
            <h3 id={titleId} className="mb-2 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
                Favoris
                {favorites.length > 0 && <span className="tnum text-muted-foreground/70">{favorites.length}</span>}
            </h3>
            {favorites.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-5 text-center">
                    <span aria-hidden="true" className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Star className="h-4 w-4" />
                    </span>
                    <p className="mt-2.5 text-[13px] font-medium">
                        Ajoutez un arrêt en favori avec{' '}
                        <Star className="inline h-3.5 w-3.5 -translate-y-px" aria-hidden="true" />
                        <span className="sr-only">l’étoile ★</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Ses prochains départs seront à un geste d’ici.</p>
                </div>
            ) : (
                <ul className="space-y-1.5">
                    {favorites.map((stop, index) => (
                        <li
                            key={stop.stopPointId}
                            className="relative motion-safe:animate-rise-in"
                            style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                        >
                            <button
                                type="button"
                                onClick={() => onStopChange(stop)}
                                className="flex w-full items-start gap-3 rounded-xl bg-surface p-3 pr-11 text-left shadow-control transition-colors hover:bg-subtle"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1">
                                        <span className="truncate text-sm font-medium">{stop.name}</span>
                                        {stop.accessible && (
                                            <Accessibility className="h-3.5 w-3.5 shrink-0 text-muted-foreground" role="img" aria-label="Arrêt accessible" />
                                        )}
                                    </span>
                                    {stop.city && <span className="block truncate text-xs text-muted-foreground">{stop.city}</span>}
                                    <LineBadgeList lines={sortLines(stop.lines ?? [])} linesById={linesById} max={8} className="mt-2" />
                                </span>
                            </button>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Retirer ${stop.name} des favoris`}
                                title="Retirer des favoris"
                                onClick={() => toggle(stop)}
                                className="absolute right-2 top-2 text-foreground"
                            >
                                <Star className="fill-current" aria-hidden="true" />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
