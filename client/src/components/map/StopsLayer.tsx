import { memo, useMemo, useState } from 'react';
import { canvas, type LatLngBounds } from 'leaflet';
import { CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngTuple } from '@/lib/geo';
import { stopLatLng } from '@/lib/places';
import type { StopSummary } from '@/types';

/** Stops are only drawn from this zoom level on, to keep the map fast with ~1000 stops. */
export const MIN_STOPS_ZOOM = 15;

interface StopPoint {
    stop: StopSummary;
    position: LatLngTuple;
}

interface StopsLayerProps {
    stops: StopSummary[];
    onSelect: (stop: StopSummary, position: LatLngTuple) => void;
    /** Highlighted stop (open popup). */
    activeStopId: string | null;
    dark: boolean;
}

const StopMarker = memo(function StopMarker({
    point,
    active,
    onSelect,
    renderer,
    dark,
}: {
    point: StopPoint;
    active: boolean;
    onSelect: StopsLayerProps['onSelect'];
    renderer: ReturnType<typeof canvas>;
    dark: boolean;
}) {
    const eventHandlers = useMemo(
        () => ({ click: () => onSelect(point.stop, point.position) }),
        [onSelect, point],
    );
    return (
        <CircleMarker
            center={point.position}
            radius={active ? 6 : 4}
            renderer={renderer}
            bubblingMouseEvents={false}
            eventHandlers={eventHandlers}
            pathOptions={{
                color: dark ? '#a1a1aa' : '#52525b',
                weight: 1.5,
                fillColor: active ? (dark ? '#fafafa' : '#18181b') : dark ? '#27272a' : '#ffffff',
                fillOpacity: 1,
            }}
        />
    );
});

export function StopsLayer({ stops, onSelect, activeStopId, dark }: StopsLayerProps) {
    const map = useMap();
    const [view, setView] = useState<{ zoom: number; bounds: LatLngBounds }>(() => ({
        zoom: map.getZoom(),
        bounds: map.getBounds(),
    }));
    useMapEvents({
        moveend: () => setView({ zoom: map.getZoom(), bounds: map.getBounds() }),
    });

    // A dedicated canvas renderer with a generous hit tolerance: small dots stay easy to tap.
    const [renderer] = useState(() => canvas({ tolerance: 8 }));

    const points = useMemo(
        () =>
            stops.flatMap((stop): StopPoint[] => {
                const position = stopLatLng(stop);
                return position ? [{ stop, position }] : [];
            }),
        [stops],
    );

    const visible = useMemo(() => {
        if (view.zoom < MIN_STOPS_ZOOM) return [];
        const area = view.bounds.pad(0.25);
        return points.filter((p) => area.contains(p.position));
    }, [points, view]);

    return (
        <>
            {visible.map((point) => (
                <StopMarker
                    key={point.stop.stopPointId}
                    point={point}
                    active={point.stop.stopPointId === activeStopId}
                    onSelect={onSelect}
                    renderer={renderer}
                    dark={dark}
                />
            ))}
        </>
    );
}
