import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Bell, Compass, History, MousePointerClick, Radio, Route as RouteIcon, Search, Signpost, Waypoints } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { Notice } from '@/components/common/Notice';
import { LiveDot } from '@/components/common/RealtimeBadge';
import type { MapInsets } from '@/components/map/MapBehaviors';
import { PlannerForm, type TimeMode } from '@/components/planner/PlannerForm';
import { ResultsList } from '@/components/results/ResultsList';
import { RouteDetail } from '@/components/results/RouteDetail';
import { AlertsPanel } from '@/features/alerts/AlertsPanel';
import { DeparturesPanel } from '@/features/departures/DeparturesPanel';
import { ExplorePanel } from '@/features/explore/ExplorePanel';
import { CommandPalette, type PaletteAction } from '@/features/palette/CommandPalette';
import { LinesPanel } from '@/features/lines/LinesPanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { useNetwork } from '@/hooks/useNetwork';
import { useAlerts, useVehicles } from '@/hooks/useRealtime';
import { useRouteSearch } from '@/hooks/useRouteSearch';
import { getDataStatus, getIsochrone } from '@/lib/api';
import { currentTime } from '@/lib/format';
import { EMPTY_FIELD, fieldFromPlace, placeLabel, samePlace, stopPlace, toLocation, type PlaceField, type PlaceSelection } from '@/lib/places';
import { loadRecents, saveRecent, type RecentTrip } from '@/lib/recents';
import { DEFAULT_OPTIONS, type SearchOptions } from '@/lib/searchOptions';
import { decodePlace, encodePlace, readParams, validDate, validTime, writeParams } from '@/lib/url';
import { cn } from '@/lib/utils';
import type { Direction, StopSummary } from '@/types';

// The map (Leaflet + MapLibre) is the heaviest part: load it after the panel.
const JourneyMap = lazy(() => import('@/components/map/JourneyMap').then(m => ({ default: m.JourneyMap })));
const LineMapLayer = lazy(() => import('@/features/lines/LineMapLayer').then(m => ({ default: m.LineMapLayer })));
const IsochroneLayer = lazy(() => import('@/features/explore/IsochroneLayer').then(m => ({ default: m.IsochroneLayer })));

type Mode = 'route' | 'departures' | 'lines' | 'explore' | 'alerts';

const TABS: { mode: Exclude<Mode, 'alerts'>; label: string; icon: typeof RouteIcon }[] = [
    { mode: 'route', label: 'Itinéraire', icon: RouteIcon },
    { mode: 'departures', label: 'Départs', icon: Signpost },
    { mode: 'lines', label: 'Lignes', icon: Waypoints },
    { mode: 'explore', label: 'Explorer', icon: Compass },
];

const PANEL_WIDTH = 400;
const PANEL_MARGIN = 12;

export default function App() {
    const network = useNetwork();
    const isDesktop = useIsDesktop();
    const [mode, setMode] = useState<Mode>('route');

    // Itinerary
    const [from, setFrom] = useState<PlaceField>(EMPTY_FIELD);
    const [to, setTo] = useState<PlaceField>(EMPTY_FIELD);
    const [timeMode, setTimeMode] = useState<TimeMode>('now');
    const [time, setTime] = useState(currentTime);
    const [date, setDate] = useState<string | null>(null);
    const [options, setOptions] = useState<SearchOptions>(DEFAULT_OPTIONS);
    const [recents, setRecents] = useState<RecentTrip[]>(loadRecents);
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const { state: searchState, search } = useRouteSearch();

    // Other views
    const [departuresStop, setDeparturesStop] = useState<StopSummary | null>(null);
    const [lineId, setLineId] = useState<string | null>(null);
    const [lineDirection, setLineDirection] = useState<Direction>('OUTWARD');
    const [exploreOrigin, setExploreOrigin] = useState<PlaceField>(EMPTY_FIELD);
    const [maxDuration, setMaxDuration] = useState(30);

    // Real time & chrome
    const [liveVehicles, setLiveVehicles] = useState(true);
    const vehicles = useVehicles(liveVehicles);
    const alerts = useAlerts();
    const activeAlerts = (alerts.data ?? []).filter(a => a.active);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [sheetExpanded, setSheetExpanded] = useState(false);
    const status = useAsyncData('status', getDataStatus);
    const dateRange = status.status === 'success' ? status.data.source.validity : { from: null, to: null };

    // Restore the view from the URL once the stops are known.
    const [restored, setRestored] = useState(false);
    if (!restored && network.stops.length > 0) {
        setRestored(true);
        const params = readParams();
        const byId = new Map(network.stops.map(s => [s.stopPointId, s]));
        if (params.get('stop')) {
            const place = decodePlace(params.get('stop'), byId);
            if (place?.kind === 'stop') {
                setDeparturesStop(place.stop);
                setMode('departures');
            }
        } else if (params.get('line')) {
            setLineId(params.get('line'));
            setMode('lines');
        } else if (params.get('explore')) {
            const place = decodePlace(params.get('explore'), byId);
            if (place) setExploreOrigin(fieldFromPlace(place));
            const max = Number(params.get('max'));
            if ([15, 30, 45, 60, 90].includes(max)) setMaxDuration(max);
            setMode('explore');
        } else if (params.get('alerts')) {
            setMode('alerts');
        } else if (params.get('view') === 'departures' || params.get('view') === 'lines' || params.get('view') === 'explore') {
            setMode(params.get('view') as Mode);
        } else {
            const fromPlace = decodePlace(params.get('from'), byId);
            const toPlace = decodePlace(params.get('to'), byId);
            if (fromPlace) setFrom(fieldFromPlace(fromPlace));
            if (toPlace) setTo(fieldFromPlace(toPlace));
            const t = validTime(params.get('t'));
            if (t) {
                setTime(t);
                setTimeMode(params.get('arrive') ? 'arrive' : 'at');
            }
            setDate(validDate(params.get('d')));
        }
    }

    // Itinerary search: as soon as both ends are known, and again when the time or the options change.
    const sameEnds = samePlace(from.place, to.place);
    const requestKey =
        from.place && to.place && !sameEnds
            ? JSON.stringify([toLocation(from.place), toLocation(to.place), timeMode, timeMode === 'now' ? '' : time, date, options])
            : null;

    const runSearch = useCallback(() => {
        if (!from.place || !to.place) return;
        const clock = timeMode === 'now' ? (date ? '07:00' : currentTime()) : time;
        void search({
            from: toLocation(from.place),
            to: toLocation(to.place),
            ...(date ? { date } : {}),
            ...(timeMode === 'arrive' ? { arrivalTime: clock } : { departureTime: clock }),
            maxTransfers: options.maxTransfers,
            maxWalkingDistance: options.maxWalkingDistance,
            wheelchair: options.wheelchair || undefined,
        });
        setView('list');
        setSelectedIndex(0);
        setPreviewIndex(null);
        setSheetExpanded(false);
        (document.activeElement as HTMLElement | null)?.blur?.();
        setRecents(saveRecent({ from: from.place, to: to.place }));
    }, [from.place, to.place, timeMode, time, date, options, search]);

    const runSearchRef = useRef(runSearch);
    useLayoutEffect(() => {
        runSearchRef.current = runSearch;
    });
    useEffect(() => {
        if (!requestKey) return;
        const timer = setTimeout(() => runSearchRef.current(), 120);
        return () => clearTimeout(timer);
    }, [requestKey]);

    // Keep the URL in sync with the current view.
    useEffect(() => {
        if (!restored) return;
        if (mode === 'departures') writeParams({ stop: departuresStop?.stopPointId });
        else if (mode === 'lines') writeParams({ line: lineId });
        else if (mode === 'explore') writeParams({ explore: exploreOrigin.place ? encodePlace(exploreOrigin.place) : null, max: String(maxDuration) });
        else if (mode === 'alerts') writeParams({ alerts: '1' });
        else
            writeParams({
                from: from.place ? encodePlace(from.place) : null,
                to: to.place ? encodePlace(to.place) : null,
                t: timeMode === 'now' ? null : time,
                arrive: timeMode === 'arrive' ? '1' : null,
                d: date,
            });
    }, [restored, mode, departuresStop, lineId, exploreOrigin.place, maxDuration, from.place, to.place, timeMode, time, date]);

    // ⌘K / Ctrl+K and "/" open the quick search.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName));
            if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
                event.preventDefault();
                setPaletteOpen(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Isochrone
    const isoKey = mode === 'explore' && exploreOrigin.place ? `${encodePlace(exploreOrigin.place)}|${maxDuration}` : null;
    const isochrone = useAsyncData(isoKey, signal =>
        getIsochrone(
            exploreOrigin.place!.kind === 'stop'
                ? { stopId: exploreOrigin.place!.stop.stopPointId }
                : { lat: exploreOrigin.place!.lat, lon: exploreOrigin.place!.lon },
            { maxDuration, maxTransfers: 2 },
            signal,
        ),
    );

    const response = searchState.status === 'success' ? searchState.response : null;
    const shownIndex = view === 'list' && previewIndex !== null ? previewIndex : selectedIndex;
    const shownRoute = mode === 'route' ? (response?.routes[shownIndex] ?? null) : null;
    const routeKey = searchState.status === 'success' ? `${searchState.id}-${shownIndex}` : 'none';

    // Space covered by the panel / sheet, so the map frames things in the visible area.
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

    const goToMode = (next: Mode) => {
        setMode(next);
        setPaletteOpen(false);
    };
    const planFrom = (stop: StopSummary) => {
        setFrom(fieldFromPlace(stopPlace(stop)));
        goToMode('route');
    };
    const planTo = (stop: StopSummary) => {
        setTo(fieldFromPlace(stopPlace(stop)));
        goToMode('route');
    };
    const openLine = (id: string) => {
        setLineId(id);
        setLineDirection('OUTWARD');
        goToMode('lines');
    };
    const openStop = (stop: StopSummary) => {
        setDeparturesStop(stop);
        goToMode('departures');
    };
    const stopById = useMemo(() => new Map(network.stops.map(s => [s.stopPointId, s])), [network.stops]);

    // Map: pick a point (route) or an origin (explore).
    const pickOrigin = (place: PlaceSelection) => {
        if (mode === 'explore') setExploreOrigin(fieldFromPlace(place));
        else {
            setFrom(fieldFromPlace(place));
            goToMode('route');
        }
    };
    const pickDestination = (place: PlaceSelection) => {
        setTo(fieldFromPlace(place));
        goToMode('route');
    };

    // Vehicles shown on the map: those that matter for the current view.
    const vehicleLines = useMemo<ReadonlySet<string> | null>(() => {
        if (mode === 'lines') return lineId ? new Set([lineId]) : null;
        if (mode === 'explore') return new Set();
        if (mode === 'departures') return departuresStop ? new Set(departuresStop.lines) : null;
        if (mode === 'route' && shownRoute) return new Set(shownRoute.steps.flatMap(s => (s.type === 'bus' ? [s.line] : [])));
        return null;
    }, [mode, lineId, departuresStop, shownRoute]);
    const mapOrigin =
        mode === 'route' ? from.place : mode === 'departures' && departuresStop ? stopPlace(departuresStop) : mode === 'explore' ? exploreOrigin.place : null;
    const mapDestination = mode === 'route' ? to.place : null;

    let body: ReactNode;
    if (mode === 'route') {
        body =
            view === 'detail' && response?.routes[selectedIndex] ? (
                <RouteDetail
                    route={response.routes[selectedIndex]}
                    serviceDate={response.serviceDate}
                    alerts={response.alerts}
                    originLabel={from.place ? placeLabel(from.place) : 'Départ'}
                    destinationLabel={to.place ? placeLabel(to.place) : 'Arrivée'}
                    onBack={() => setView('list')}
                />
            ) : searchState.status !== 'idle' ? (
                <ResultsList
                    state={searchState}
                    selectedIndex={selectedIndex}
                    relativeTimes={timeMode === 'now' && !date}
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
    } else if (mode === 'departures') {
        body = (
            <DeparturesPanel
                stop={departuresStop}
                onStopChange={setDeparturesStop}
                stopsIndex={network.stopsIndex}
                stopsStatus={network.stopsState.status === 'success' ? 'ready' : network.stopsState.status === 'error' ? 'error' : 'loading'}
                linesById={network.linesById}
                onPlanFrom={planFrom}
                onPlanTo={planTo}
                onSelectLine={openLine}
                alerts={alerts.data}
            />
        );
    } else if (mode === 'lines') {
        body = (
            <LinesPanel
                lines={[...network.linesById.values()]}
                loading={network.linesById.size === 0}
                selectedLineId={lineId}
                onSelectLine={id => {
                    setLineId(id);
                    setLineDirection('OUTWARD');
                }}
                direction={lineDirection}
                onDirectionChange={setLineDirection}
                alerts={alerts.data ?? []}
                vehicles={vehicles.data?.vehicles ?? null}
                onSelectStop={stop => {
                    const summary = stopById.get(stop.stopPointId);
                    if (summary) openStop(summary);
                }}
            />
        );
    } else if (mode === 'explore') {
        body = (
            <ExplorePanel
                origin={exploreOrigin}
                onOriginChange={setExploreOrigin}
                maxDuration={maxDuration}
                onMaxDurationChange={setMaxDuration}
                result={isochrone}
                network={network}
            />
        );
    } else {
        body = <AlertsPanel alerts={alerts.data} loading={alerts.loading} error={alerts.error} onSelectLine={openLine} />;
    }

    const compactHeader = !isDesktop && mode === 'route' && searchState.status !== 'idle';
    const panel = (
        <>
            <header className={cn('flex items-center justify-between gap-2 px-4 pb-2.5 pt-3.5', compactHeader && 'hidden')}>
                <button type="button" onClick={() => goToMode('route')} className="flex items-center gap-2.5 rounded-lg text-left">
                    <BrandMark className="h-7 w-7" />
                    <span className="leading-none">
                        <span className="block text-[15px] font-semibold tracking-tight">Miawstral</span>
                        <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            Réseau Mistral · Toulon
                        </span>
                    </span>
                </button>
                <div className="flex items-center gap-0.5">
                    <button
                        type="button"
                        onClick={() => setPaletteOpen(true)}
                        className="flex h-8 items-center gap-2 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Recherche rapide"
                        title="Recherche rapide (⌘K)"
                    >
                        <Search className="h-4 w-4" aria-hidden="true" />
                        {isDesktop && <kbd className="rounded border bg-muted px-1 text-2xs">⌘K</kbd>}
                    </button>
                    <button
                        type="button"
                        onClick={() => goToMode(mode === 'alerts' ? 'route' : 'alerts')}
                        aria-pressed={mode === 'alerts'}
                        className={cn(
                            'relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-muted',
                            mode === 'alerts' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                        aria-label={`Infos trafic${activeAlerts.length ? ` (${activeAlerts.length} en cours)` : ''}`}
                        title="Infos trafic"
                    >
                        <Bell className="h-4 w-4" aria-hidden="true" />
                        {activeAlerts.length > 0 && (
                            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold text-white tnum">
                                {activeAlerts.length}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            <nav aria-label="Vues" className={cn('px-3 pb-2.5', compactHeader && 'pt-1')}>
                <div className="grid grid-cols-4 gap-0.5 rounded-xl bg-muted p-0.5">
                    {TABS.map(({ mode: tab, label, icon: Icon }) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => goToMode(tab)}
                            aria-current={mode === tab ? 'page' : undefined}
                            className={cn(
                                'flex h-8 items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-medium transition-colors',
                                mode === tab ? 'bg-surface text-foreground shadow-control' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className={cn(!isDesktop && 'sr-only min-[380px]:not-sr-only')}>{label}</span>
                        </button>
                    ))}
                </div>
            </nav>

            {mode === 'route' && (
                <div className="px-3 pb-3">
                    <PlannerForm
                        from={from}
                        to={to}
                        onFromChange={setFrom}
                        onToChange={setTo}
                        onSwap={() => {
                            setFrom(to);
                            setTo(from);
                        }}
                        timeMode={timeMode}
                        time={time}
                        onTimeModeChange={setTimeMode}
                        onTimeChange={setTime}
                        date={date}
                        onDateChange={setDate}
                        dateRange={dateRange}
                        options={options}
                        onOptionsChange={setOptions}
                        network={network}
                        onFieldFocus={() => setSheetExpanded(true)}
                    />
                </div>
            )}
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto border-t">{body}</div>
            <DataFooter status={status} />
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
                        origin={mapOrigin}
                        destination={mapDestination}
                        departuresTime={timeMode === 'now' ? currentTime() : time}
                        insets={insets}
                        vehicles={liveVehicles ? (vehicles.data?.vehicles ?? []) : []}
                        vehicleLines={vehicleLines}
                        onPickOrigin={pickOrigin}
                        onPickDestination={pickDestination}
                    >
                        {mode === 'lines' && lineId && (
                            // Each lazy layer suspends on its own: suspending the whole map would unmount Leaflet.
                            <Suspense fallback={null}>
                            <LineMapLayer
                                key={lineId}
                                lineId={lineId}
                                direction={lineDirection}
                                insetsLeft={insets.left}
                                insetsBottom={insets.bottom}
                                onSelectStop={stop => {
                                    const summary = stopById.get(stop.stopPointId);
                                    if (summary) openStop(summary);
                                }}
                            />
                            </Suspense>
                        )}
                        {mode === 'explore' && isochrone.status === 'success' && (
                            <Suspense fallback={null}>
                                <IsochroneLayer data={isochrone.data} insetsLeft={insets.left} insetsBottom={insets.bottom} />
                            </Suspense>
                        )}
                    </JourneyMap>
                </Suspense>
            </div>

            <LiveToggle
                enabled={liveVehicles}
                onToggle={() => setLiveVehicles(v => !v)}
                count={vehicles.data?.count ?? null}
                className={isDesktop ? 'right-[60px] top-3' : 'right-[60px] top-3'}
            />

            {isDesktop ? (
                <aside
                    aria-label="Panneau Miawstral"
                    style={{ width: PANEL_WIDTH, left: PANEL_MARGIN, top: PANEL_MARGIN, maxHeight: `calc(100dvh - ${2 * PANEL_MARGIN}px)` }}
                    className="absolute z-[1000] flex flex-col overflow-hidden rounded-2xl bg-surface shadow-panel"
                >
                    {panel}
                </aside>
            ) : (
                <aside
                    ref={sheetRef}
                    aria-label="Panneau Miawstral"
                    className={cn(
                        'fixed inset-x-0 bottom-0 z-[1000] flex flex-col rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-panel transition-[max-height] duration-300 ease-out',
                        sheetExpanded ? 'max-h-[88dvh]' : 'max-h-[56dvh]',
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

            <CommandPalette
                open={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                stopsIndex={network.stopsIndex}
                lines={[...network.linesById.values()]}
                onStop={openStop}
                onLine={openLine}
                onAction={(action: PaletteAction) => goToMode(action)}
            />
        </div>
    );
}

function LiveToggle({ enabled, onToggle, count, className }: { enabled: boolean; onToggle: () => void; count: number | null; className?: string }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-pressed={enabled}
            title={enabled ? 'Masquer les véhicules en direct' : 'Afficher les véhicules en direct'}
            className={cn(
                'absolute z-[1000] flex h-9 items-center gap-2 rounded-lg bg-surface px-3 text-[13px] font-medium shadow-pop transition-colors hover:bg-subtle',
                !enabled && 'text-muted-foreground',
                className,
            )}
        >
            {enabled ? <LiveDot /> : <Radio className="h-3.5 w-3.5" aria-hidden="true" />}
            En direct
            {enabled && count !== null && <span className="text-muted-foreground tnum">{count}</span>}
        </button>
    );
}

function EmptyState({ recents, sameEnds, onRecent }: { recents: RecentTrip[]; sameEnds: boolean; onRecent: (trip: RecentTrip) => void }) {
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
            <p className="flex gap-2.5 px-1.5 text-[13px] leading-relaxed text-muted-foreground">
                <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Choisissez un arrêt, ou touchez la carte pour partir d’un point précis. Horaires officiels et retards en temps réel.
            </p>
        </div>
    );
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

function DataFooter({ status }: { status: ReturnType<typeof useAsyncData<Awaited<ReturnType<typeof getDataStatus>>>> }) {
    const source = status.status === 'success' ? status.data.source : null;
    return (
        <footer className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-2xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
                <LiveDot className="scale-75" />
                {source?.validity.to
                    ? `Données officielles · horaires jusqu’au ${dateFormatter.format(new Date(`${source.validity.to}T12:00:00`))}`
                    : 'Données officielles du Réseau Mistral'}
            </span>
            <a href="/docs" className="font-medium hover:text-foreground">
                API
            </a>
        </footer>
    );
}
