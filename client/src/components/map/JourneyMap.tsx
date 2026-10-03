import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LatLng, Popup as LeafletPopup } from 'leaflet';
import { MapContainer, Popup, ZoomControl } from 'react-leaflet';
import { usePrefersDark } from '@/hooks/useMediaQuery';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { TOULON_CENTER, type LatLngTuple } from '@/lib/geo';
import { placeLatLng, pointPlace, stopLatLng, stopPlace, type PlaceSelection } from '@/lib/places';
import type { LineSummary, RouteOption, StopSummary, Vehicle } from '@/types';
import { EndpointMarkers } from './EndpointMarkers';
import { MapEvents, MapResizer, ViewController, type MapInsets } from './MapBehaviors';
import { PointPopupContent } from './PointPopupContent';
import { RouteLayer } from './RouteLayer';
import { StopPopupContent } from './StopPopupContent';
import { StopsLayer } from './StopsLayer';
import { VectorBasemap } from './VectorBasemap';
import { VehiclesLayer } from './VehiclesLayer';

const INITIAL_ZOOM = 13;


type MapPopup = { kind: 'stop'; stop: StopSummary; position: LatLngTuple } | { kind: 'point'; position: LatLngTuple };

interface JourneyMapProps {
    stops: StopSummary[];
    linesById: ReadonlyMap<string, LineSummary>;
    route: RouteOption | null;
    /** Identifies the displayed route (changes when another itinerary is shown). */
    routeKey: string;
    origin: PlaceSelection | null;
    destination: PlaceSelection | null;
    /** "HH:MM" used for the departures shown in stop popups. */
    departuresTime: string;
    insets: MapInsets;
    /** Live vehicles to draw (empty to hide them). */
    vehicles: Vehicle[];
    /** Restricts the vehicles to these lines. */
    vehicleLines?: ReadonlySet<string> | null;
    /** Extra layers of the current mode (line path, isochrone…). */
    children?: ReactNode;
    onPickOrigin: (place: PlaceSelection) => void;
    onPickDestination: (place: PlaceSelection) => void;
}

export function JourneyMap({
    stops,
    linesById,
    route,
    routeKey,
    origin,
    destination,
    departuresTime,
    insets,
    vehicles,
    vehicleLines,
    children,
    onPickOrigin,
    onPickDestination,
}: JourneyMapProps) {
    const reducedMotion = usePrefersReducedMotion();
    const dark = usePrefersDark();
    const [popup, setPopup] = useState<MapPopup | null>(null);
    const popupRef = useRef<LeafletPopup>(null);

    const endpoints = useMemo(
        () => [origin, destination].flatMap(p => (p ? [placeLatLng(p)] : [])).filter(p => p !== null),
        [origin, destination],
    );

    const openStop = useCallback((stop: StopSummary, position: LatLngTuple) => {
        setPopup({ kind: 'stop', stop, position });
    }, []);

    const handleMapClick = (latlng: LatLng) => {
        // First click closes an open popup, the next one drops a point.
        setPopup(current => (current ? null : { kind: 'point', position: [latlng.lat, latlng.lng] }));
    };

    const pick = (place: PlaceSelection, as: 'origin' | 'destination') => {
        (as === 'origin' ? onPickOrigin : onPickDestination)(place);
        setPopup(null);
    };

    return (
        <MapContainer
            center={TOULON_CENTER}
            zoom={INITIAL_ZOOM}
            zoomControl={false}
            closePopupOnClick={false}
            zoomAnimation={!reducedMotion}
            fadeAnimation={!reducedMotion}
            markerZoomAnimation={!reducedMotion}
            attributionControl
            maxZoom={19}
            className="h-full w-full"
        >
            {/* Monochrome basemap: the line colors are the only colors on the map. */}
            <VectorBasemap dark={dark} />
            <ZoomControl position="topright" zoomInTitle="Zoomer" zoomOutTitle="Dézoomer" />

            <MapResizer />
            <MapEvents onClick={handleMapClick} />
            <ViewController route={route} endpoints={endpoints} animate={!reducedMotion} insets={insets} />

            <StopsLayer
                stops={stops}
                onSelect={openStop}
                activeStopId={popup?.kind === 'stop' ? popup.stop.stopPointId : null}
                dark={dark}
            />
            {children}
            {route && <RouteLayer key={routeKey} route={route} dark={dark} />}
            <EndpointMarkers origin={origin} destination={destination} />
            <VehiclesLayer vehicles={vehicles} lines={vehicleLines} animate={!reducedMotion} />

            {popup && (
                <Popup
                    key={popup.kind === 'stop' ? popup.stop.stopPointId : popup.position.join(',')}
                    ref={popupRef}
                    position={popup.position}
                    minWidth={256}
                    maxWidth={320}
                    autoPanPaddingTopLeft={[insets.left + 16, insets.top + 16]}
                    autoPanPaddingBottomRight={[insets.right + 16, insets.bottom + 16]}
                    eventHandlers={{
                        remove: () => setPopup(current => (current === popup ? null : current)),
                    }}
                >
                    {/*
                      React handles clicks on the portal container, before they reach the map. The
                      content may be unmounted by then, so Leaflet could no longer tell the click
                      came from a popup and would fire a map click: stop it here.
                    */}
                    <div onClick={event => event.stopPropagation()}>
                        {popup.kind === 'stop' ? (
                            <StopPopupContent
                                stop={popup.stop}
                                time={departuresTime}
                                linesById={linesById}
                                onOrigin={() => pick(stopPlace(popup.stop), 'origin')}
                                onDestination={() => pick(stopPlace(popup.stop), 'destination')}
                                onLayoutChange={() => popupRef.current?.update()}
                            />
                        ) : (
                            <PointPopupContent
                                lat={popup.position[0]}
                                lon={popup.position[1]}
                                onOrigin={() => pick(pointPlace(...popup.position), 'origin')}
                                onDestination={() => pick(pointPlace(...popup.position), 'destination')}
                                onShowStop={stop => {
                                    const position = stopLatLng(stop);
                                    if (position) openStop(stop, position);
                                }}
                                onLayoutChange={() => popupRef.current?.update()}
                            />
                        )}
                    </div>
                </Popup>
            )}
        </MapContainer>
    );
}
