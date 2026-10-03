import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, History, MousePointerClick } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { Notice } from '@/components/common/Notice';
import type { MapInsets } from '@/components/map/MapBehaviors';
import { PlannerForm, type TimeMode } from '@/components/planner/PlannerForm';
import { ResultsList } from '@/components/results/ResultsList';
import { RouteDetail } from '@/components/results/RouteDetail';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { useNetwork } from '@/hooks/useNetwork';
import { useRouteSearch } from '@/hooks/useRouteSearch';
import { getDataStatus } from '@/lib/api';
import { currentTime } from '@/lib/format';
import { EMPTY_FIELD, fieldFromPlace, placeLabel, samePlace, toLocation, type PlaceField } from '@/lib/places';
import { loadRecents, saveRecent, type RecentTrip } from '@/lib/recents';
import { DEFAULT_OPTIONS, type SearchOptions } from '@/lib/searchOptions';
import { readUrlSearch, writeUrlSearch } from '@/lib/url';
import { cn } from '@/lib/utils';

// The map (Leaflet + MapLibre) is the heaviest part: load it after the panel.
const JourneyMap = lazy(() => import('@/components/map/JourneyMap').then(m => ({ default: m.JourneyMap })));

const PANEL_WIDTH = 400;
const PANEL_MARGIN = 12;

export default function App() {
    const network = useNetwork();
    const isDesktop = useIsDesktop();

    const [from, setFrom] = useState<PlaceField>(EMPTY_FIELD);
    const [to, setTo] = useState<PlaceField>(EMPTY_FIELD);
    const [timeMode, setTimeMode] = useState<TimeMode>('now');
    const [time, setTime] = useState(currentTime);
    const [options, setOptions] = useState<SearchOptions>(DEFAULT_OPTIONS);
    const [recents, setRecents] = useState<RecentTrip[]>(loadRecents);

    const [view, setView] = useState<'list' | 'detail'>('list');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [sheetExpanded, setSheetExpanded] = useState(false);
    const { state: searchState, search } = useRouteSearch();

    // Restore a shared search (?from=…&to=…&t=…) once the stops are known.
    const [restored, setRestored] = useState(false);
    if (!restored && network.stops.length > 0) {
        setRestored(true);
        const fromUrl = readUrlSearch(network.stops);
        if (fromUrl.from) setFrom(fieldFromPlace(fromUrl.from));
        if (fromUrl.to) setTo(fieldFromPlace(fromUrl.to));
        if (fromUrl.time) {
            setTimeMode('at');
            setTime(fromUrl.time);
        }
    }

    // Search as soon as both ends are known, and again when the time or the options change.
    const sameEnds = samePlace(from.place, to.place);
    const requestKey =
        from.place && to.place && !sameEnds
            ? JSON.stringify([toLocation(from.place), toLocation(to.place), timeMode === 'at' ? time : 'now', options])
            : null;

    const runSearch = useCallback(() => {
        if (!from.place || !to.place) return;
        void search({
            from: toLocation(from.place),
            to: toLocation(to.place),
            departureTime: timeMode === 'at' ? time : currentTime(),
            maxTransfers: options.maxTransfers,
            maxWalkingDistance: options.maxWalkingDistance,
        });
        setView('list');
        setSelectedIndex(0);
        setPreviewIndex(null);
        // Mobile: make room for the map once the search is sent.
        setSheetExpanded(false);
        (document.activeElement as HTMLElement | null)?.blur?.();
        setRecents(saveRecent({ from: from.place, to: to.place }));
        writeUrlSearch(from.place, to.place, timeMode === 'at' ? time : null);
    }, [from.place, to.place, timeMode, time, options, search]);

    const runSearchRef = useRef(runSearch);
    useLayoutEffect(() => {
        runSearchRef.current = runSearch;
    });
    useEffect(() => {
        if (!requestKey) return;
        const timer = setTimeout(() => runSearchRef.current(), 120);
        return () => clearTimeout(timer);
    }, [requestKey]);

    const response = searchState.status === 'success' ? searchState.response : null;
    const shownIndex = view === 'list' && previewIndex !== null ? previewIndex : selectedIndex;
    const shownRoute = response?.routes[shownIndex] ?? null;
    const routeKey = searchState.status === 'success' ? `${searchState.id}-${shownIndex}` : 'none';

    const swap = () => {
        setFrom(to);
        setTo(from);
    };

    // Space covered by the panel / sheet, so the map frames the route in the visible area.
    const sheetRef = useRef<HTMLDivElement>(null);
    const [sheetHeight, setSheetHeight] = useState(0);
    useEffect(() => {
        const element = sheetRef.current;
        if (!element || isDesktop) return;
        const observer = new ResizeObserver(() => setSheetHeight(element.offsetHeight));
        observer.observe(element);
        return () => observer.disconnect();
    }, [isDesktop]);
    const insets = useMemo<MapInsets>(
        () =>
            isDesktop
                ? { top: 0, right: 48, bottom: 0, left: PANEL_WIDTH + PANEL_MARGIN }
                : { top: 0, right: 0, bottom: sheetHeight, left: 0 },
        [isDesktop, sheetHeight],
    );

    const body =
        view === 'detail' && response?.routes[selectedIndex] ? (
            <RouteDetail
                route={response.routes[selectedIndex]}
                originLabel={from.place ? placeLabel(from.place) : 'Départ'}
                destinationLabel={to.place ? placeLabel(to.place) : 'Arrivée'}
                onBack={() => setView('list')}
            />
        ) : searchState.status !== 'idle' ? (
            <ResultsList
                state={searchState}
                selectedIndex={selectedIndex}
                relativeTimes={timeMode === 'now'}
                onOpen={index => {
                    setSelectedIndex(index);
                    setPreviewIndex(null);
                    setView('detail');
                }}
                onPreview={setPreviewIndex}
                onRetry={runSearch}
            />
        ) : (
            <EmptyState
                recents={recents}
                sameEnds={sameEnds}
                onRecent={trip => {
                    setFrom(fieldFromPlace(trip.from));
                    setTo(fieldFromPlace(trip.to));
                }}
            />
        );

    const panel = (
        <>
            <header
                className={cn(
                    'flex items-center justify-between px-4 pb-3 pt-4',
                    !isDesktop && searchState.status !== 'idle' && 'hidden',
                )}
            >
                <div className="flex items-center gap-2.5">
                    <BrandMark className="h-7 w-7" />
                    <div className="leading-none">
                        <div className="text-[15px] font-semibold tracking-tight">Miawstral</div>
                        <div className="mt-1 text-xs text-muted-foreground">Réseau Mistral · Toulon</div>
                    </div>
                </div>
                <a
                    href="/api/docs"
                    className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    API
                </a>
            </header>
            <div className={cn('px-3 pb-3', !isDesktop && searchState.status !== 'idle' && 'pt-1')}>
                <PlannerForm
                    from={from}
                    to={to}
                    onFromChange={setFrom}
                    onToChange={setTo}
                    onSwap={swap}
                    timeMode={timeMode}
                    time={time}
                    onTimeModeChange={setTimeMode}
                    onTimeChange={setTime}
                    options={options}
                    onOptionsChange={setOptions}
                    network={network}
                    onFieldFocus={() => setSheetExpanded(true)}
                />
            </div>
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto border-t">{body}</div>
            <DataFooter />
        </>
    );

    return (
        <div className="relative h-dvh w-full overflow-hidden bg-background">
            <div className="absolute inset-0 bg-[var(--map-bg)]">
                <Suspense fallback={null}>
                <JourneyMap
                    stops={network.stops}
                    linesById={network.linesById}
                    route={shownRoute}
                    routeKey={routeKey}
                    origin={from.place}
                    destination={to.place}
                    departuresTime={timeMode === 'at' ? time : currentTime()}
                    insets={insets}
                    onPickOrigin={place => setFrom(fieldFromPlace(place))}
                    onPickDestination={place => setTo(fieldFromPlace(place))}
                />
                </Suspense>
            </div>

            {isDesktop ? (
                <aside
                    aria-label="Recherche d’itinéraire"
                    style={{ width: PANEL_WIDTH, left: PANEL_MARGIN, top: PANEL_MARGIN, maxHeight: `calc(100dvh - ${2 * PANEL_MARGIN}px)` }}
                    className="absolute z-[1000] flex flex-col overflow-hidden rounded-2xl bg-surface shadow-panel"
                >
                    {panel}
                </aside>
            ) : (
                <aside
                    ref={sheetRef}
                    aria-label="Recherche d’itinéraire"
                    className={cn(
                        'fixed inset-x-0 bottom-0 z-[1000] flex flex-col rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-panel transition-[max-height] duration-300 ease-out',
                        sheetExpanded ? 'max-h-[88dvh]' : 'max-h-[55dvh]',
                    )}
                >
                    <button
                        type="button"
                        onClick={() => setSheetExpanded(e => !e)}
                        aria-label={sheetExpanded ? 'Réduire le panneau' : 'Agrandir le panneau'}
                        aria-expanded={sheetExpanded}
                        className="flex h-5 w-full shrink-0 items-center justify-center"
                    >
                        <span className="h-1 w-9 rounded-full bg-border" />
                    </button>
                    {panel}
                </aside>
            )}
        </div>
    );
}

function EmptyState({
    recents,
    sameEnds,
    onRecent,
}: {
    recents: RecentTrip[];
    sameEnds: boolean;
    onRecent: (trip: RecentTrip) => void;
}) {
    return (
        <div className="space-y-4 p-3">
            {sameEnds && <Notice>Le départ et l’arrivée sont identiques.</Notice>}
            {recents.length > 0 && (
                <section>
                    <h2 className="px-1 pb-1 text-xs font-medium text-muted-foreground">Récents</h2>
                    <ul>
                        {recents.map(trip => (
                            <li key={`${placeLabel(trip.from)}→${placeLabel(trip.to)}`}>
                                <button
                                    type="button"
                                    onClick={() => onRecent(trip)}
                                    className="flex w-full items-center gap-3 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-subtle"
                                >
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                        <History className="h-4 w-4" aria-hidden="true" />
                                    </span>
                                    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
                                        <span className="truncate">{placeLabel(trip.from)}</span>
                                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                        <span className="truncate">{placeLabel(trip.to)}</span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            <Hint icon={<MousePointerClick className="h-4 w-4" aria-hidden="true" />}>
                Choisissez un arrêt, ou touchez la carte pour partir d’un point précis. Les arrêts apparaissent en zoomant.
            </Hint>
        </div>
    );
}

function Hint({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <p className="flex gap-2.5 px-1.5 text-[13px] leading-relaxed text-muted-foreground">
            <span className="mt-0.5 shrink-0">{icon}</span>
            {children}
        </p>
    );
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

function DataFooter() {
    const status = useAsyncData('status', getDataStatus);
    const updated =
        status.status === 'success' && status.data.newestTimetable
            ? `Horaires mis à jour le ${dateFormatter.format(new Date(status.data.newestTimetable))}`
            : 'Horaires du Réseau Mistral';
    return (
        <footer className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-2xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                {updated}
            </span>
            <span>Projet indépendant</span>
        </footer>
    );
}
