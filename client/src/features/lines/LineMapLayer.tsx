import { memo, useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef } from 'react';
import { latLngBounds, type LatLngTuple } from 'leaflet';
import { CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet';
import { useAsyncData } from '@/hooks/useAsyncData';
import { usePrefersDark } from '@/hooks/useMediaQuery';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { getLineShape } from '@/lib/api';
import { strokeColor } from '@/lib/colors';
import type { Direction, LineShape } from '@/types';
import type { SelectedStop } from './LineStopsTimeline';
import { uncoveredConnectors } from './shapeUtils';

interface LineMapLayerProps {
    lineId: string;
    date?: string;
    direction: Direction;
    /** Space covered by the side panel (desktop), in pixels. */
    insetsLeft?: number;
    /** Space covered by the bottom sheet (mobile), in pixels. */
    insetsBottom?: number;
    onSelectStop?: (stop: SelectedStop) => void;
}

type ShapeDirection = LineShape['directions'][number];

/**
 * Official path of a line on the map (inside the shell's `<MapContainer>`): the
 * selected direction with its stops, the other one faint and dashed underneath.
 * The view fits the line when it is loaded.
 */
export function LineMapLayer({ lineId, date, direction, insetsLeft = 0, insetsBottom = 0, onSelectStop }: LineMapLayerProps) {
    const map = useMap();
    const dark = usePrefersDark();
    const reducedMotion = usePrefersReducedMotion();
    const state = useAsyncData(`${lineId}@${date ?? 'today'}`, signal => getLineShape(lineId, date, signal));
    const shape = state.status === 'success' ? state.data : null;

    // Stable handler for the stop markers (the shell may pass a new function on every render).
    const onSelectRef = useRef(onSelectStop);
    useLayoutEffect(() => {
        onSelectRef.current = onSelectStop;
    });
    const selectStop = useCallback((stop: SelectedStop) => onSelectRef.current?.(stop), []);

    const fit = useEffectEvent((data: LineShape) => {
        const points: LatLngTuple[] = data.directions.flatMap(d => [
            ...d.coordinates,
            ...d.stops.map((s): LatLngTuple => [s.lat, s.lon]),
        ]);
        const finite = points.filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
        if (finite.length === 0) return;
        const bounds = latLngBounds(finite);
        if (!bounds.isValid()) return;
        map.fitBounds(bounds, {
            paddingTopLeft: [insetsLeft + 40, 40],
            paddingBottomRight: [40, insetsBottom + 40],
            maxZoom: 16,
            animate: !reducedMotion,
        });
    });

    useEffect(() => {
        if (shape) fit(shape);
    }, [shape]);

    const color = strokeColor(shape?.color, dark);
    const styles = useMemo(
        () => ({
            other: { color, weight: 3, opacity: dark ? 0.55 : 0.45, dashArray: '1 7', lineCap: 'round', lineJoin: 'round' } as const,
            casing: { color: dark ? '#09090b' : '#ffffff', weight: 10, opacity: 0.95, lineCap: 'round', lineJoin: 'round' } as const,
            line: { color, weight: 5.5, opacity: 1, lineCap: 'round', lineJoin: 'round' } as const,
        }),
        [color, dark],
    );

    const selected = shape?.directions.find(d => d.direction === direction) ?? shape?.directions[0];
    // Official path, plus stop-to-stop connectors where it does not reach the stops.
    const paths = useMemo(
        () => (selected ? [selected.coordinates, ...uncoveredConnectors(selected.coordinates, selected.stops)] : []),
        [selected],
    );

    if (!shape || !selected) return null;
    const others = shape.directions.filter(d => d !== selected);

    return (
        <>
            {others.map((d, index) => (
                <Polyline
                    key={`other-${index}`}
                    positions={d.coordinates}
                    interactive={false}
                    pathOptions={styles.other}
                />
            ))}
            <Polyline key="casing" positions={paths} interactive={false} pathOptions={styles.casing} />
            <Polyline key="line" positions={paths} interactive={false} pathOptions={styles.line} />
            <StopNodes direction={selected} color={color} dark={dark} onSelectStop={selectStop} />
        </>
    );
}

const StopNodes = memo(function StopNodes({
    direction,
    color,
    dark,
    onSelectStop,
}: {
    direction: ShapeDirection;
    color: string;
    dark: boolean;
    onSelectStop: (stop: SelectedStop) => void;
}) {
    const last = direction.stops.length - 1;
    // Termini last, so that they are drawn on top.
    const ordered = useMemo(
        () =>
            direction.stops
                .map((stop, index) => ({ stop, index, terminus: index === 0 || index === last }))
                .sort((a, b) => Number(a.terminus) - Number(b.terminus)),
        [direction.stops, last],
    );
    const styles = useMemo(
        () => ({
            stop: { color, weight: 2.25, fillColor: dark ? '#f4f4f5' : '#ffffff', fillOpacity: 1 },
            terminus: { color, weight: 3.5, fillColor: '#ffffff', fillOpacity: 1 },
        }),
        [color, dark],
    );

    return (
        <>
            {ordered.map(({ stop, index, terminus }) => {
                const radius = terminus ? 6.5 : 3.5;
                return (
                    <CircleMarker
                        key={`${stop.stopPointId}-${index}`}
                        center={[stop.lat, stop.lon]}
                        radius={radius}
                        bubblingMouseEvents={false}
                        eventHandlers={{
                            click: () => onSelectStop({ stopPointId: stop.stopPointId, name: stop.name, lat: stop.lat, lon: stop.lon }),
                        }}
                        pathOptions={terminus ? styles.terminus : styles.stop}
                    >
                        <Tooltip direction="top" offset={[0, -radius - 3]}>
                            {terminus ? (
                                <>
                                    <span className="opacity-70">{index === 0 ? 'Départ · ' : 'Terminus · '}</span>
                                    {stop.name}
                                </>
                            ) : (
                                stop.name
                            )}
                        </Tooltip>
                    </CircleMarker>
                );
            })}
        </>
    );
});
