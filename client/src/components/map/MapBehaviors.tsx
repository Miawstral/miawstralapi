import { useEffect, useEffectEvent, useMemo } from 'react';
import { latLngBounds, type LatLng } from 'leaflet';
import { useMap, useMapEvents } from 'react-leaflet';
import { routePositions, type LatLngTuple } from '@/lib/geo';
import type { RouteOption } from '@/types';

/** Keeps Leaflet in sync with its container size (responsive layout, panel resize…). */
export function MapResizer() {
    const map = useMap();
    useEffect(() => {
        const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
        observer.observe(map.getContainer());
        return () => observer.disconnect();
    }, [map]);
    return null;
}

export function MapEvents({ onClick }: { onClick: (latlng: LatLng) => void }) {
    useMapEvents({ click: event => onClick(event.latlng) });
    return null;
}

/** Space covered by the interface over the map (floating panel, bottom sheet), in pixels. */
export interface MapInsets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

interface ViewControllerProps {
    route: RouteOption | null;
    /** Origin / destination positions, used when there is no route to show. */
    endpoints: LatLngTuple[];
    animate: boolean;
    insets: MapInsets;
}

/** Moves the view to the selected route, or to the chosen origin/destination. */
export function ViewController({ route, endpoints, animate, insets }: ViewControllerProps) {
    const map = useMap();

    const routeBounds = useMemo(() => {
        const points = route ? routePositions(route) : [];
        return points.length > 0 ? latLngBounds(points) : null;
    }, [route]);

    const endpointsKey = endpoints.map((p) => p.map((v) => v.toFixed(5)).join(',')).join('|');

    const padding = (extra: number) => ({
        paddingTopLeft: [insets.left + extra, insets.top + extra] as [number, number],
        paddingBottomRight: [insets.right + extra, insets.bottom + extra] as [number, number],
    });

    const fitRoute = useEffectEvent(() => {
        if (routeBounds?.isValid()) {
            map.fitBounds(routeBounds, { ...padding(40), maxZoom: 17, animate });
        }
    });

    const showEndpoints = useEffectEvent(() => {
        if (route || endpoints.length === 0) return;
        const bounds = latLngBounds(endpoints);
        map.fitBounds(bounds, { ...padding(64), maxZoom: endpoints.length === 1 ? 15 : 16, animate });
    });

    useEffect(() => {
        fitRoute();
    }, [routeBounds]);

    useEffect(() => {
        showEndpoints();
    }, [endpointsKey]);

    return null;
}
