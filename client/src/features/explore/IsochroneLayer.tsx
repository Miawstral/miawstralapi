import { useEffect, useMemo, useState } from 'react';
import { canvas, latLngBounds } from 'leaflet';
import { CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { IsochroneResponse } from '@/types';
import { isochroneColor } from './isochrone';

interface IsochroneLayerProps {
    data: IsochroneResponse;
    insetsLeft: number;
    insetsBottom: number;
}

/** Reachable stops colored by travel time, nearest drawn on top. */
export function IsochroneLayer({ data, insetsLeft, insetsBottom }: IsochroneLayerProps) {
    const map = useMap();
    const reducedMotion = usePrefersReducedMotion();
    const [renderer] = useState(() => canvas({ padding: 0.3 }));
    const stops = useMemo(() => [...data.stops].sort((a, b) => b.duration - a.duration), [data]);

    useEffect(() => {
        if (data.stops.length === 0) return;
        const bounds = latLngBounds(data.stops.map(s => [s.lat, s.lon] as [number, number]));
        map.fitBounds(bounds, {
            paddingTopLeft: [insetsLeft + 40, 40],
            paddingBottomRight: [40, insetsBottom + 40],
            maxZoom: 15,
            animate: !reducedMotion,
        });
        // Fit only when a new result arrives.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    return (
        <>
            {stops.map(stop => (
                <CircleMarker
                    key={stop.stopPointId}
                    center={[stop.lat, stop.lon]}
                    radius={stop.duration === 0 ? 7 : 5}
                    renderer={renderer}
                    bubblingMouseEvents={false}
                    pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: isochroneColor(stop.duration), fillOpacity: 0.95 }}
                >
                    <Tooltip direction="top" offset={[0, -6]}>
                        <span className="tnum">{stop.duration} min</span> · {stop.name}
                        {stop.transfers > 0 ? ` · ${stop.transfers} corresp.` : ''}
                    </Tooltip>
                </CircleMarker>
            ))}
        </>
    );
}
