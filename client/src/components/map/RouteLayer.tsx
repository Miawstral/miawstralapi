import { Fragment, useMemo } from 'react';
import { CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import { strokeColor } from '@/lib/colors';
import { formatTime } from '@/lib/format';
import { busLegPositions, walkLegPositions } from '@/lib/geo';
import type { BusStep, RouteOption, StopRef, WalkStep } from '@/types';

interface Theme {
    dark: boolean;
}

function StopDot({ stop, time, color, label, small = false, dark }: { stop: StopRef; time: string; color: string; label?: string; small?: boolean } & Theme) {
    const radius = small ? 3 : 5.5;
    return (
        <CircleMarker
            center={[stop.lat, stop.lon]}
            radius={radius}
            bubblingMouseEvents={false}
            pathOptions={{ color, weight: small ? 2 : 3, fillColor: dark ? '#18181b' : '#ffffff', fillOpacity: 1 }}
        >
            <Tooltip direction="top" offset={[0, -radius - 2]}>
                <span className="tnum">{formatTime(time)}</span> · {label ? `${label} · ` : ''}
                {stop.name}
            </Tooltip>
        </CircleMarker>
    );
}

function BusLegLine({ step, dark }: { step: BusStep } & Theme) {
    const positions = useMemo(() => busLegPositions(step), [step]);
    const color = strokeColor(step.color, dark);
    return (
        <>
            <Polyline
                positions={positions}
                interactive={false}
                pathOptions={{ color: dark ? '#09090b' : '#ffffff', weight: 10, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
            />
            <Polyline
                positions={positions}
                interactive={false}
                pathOptions={{ color, weight: 5.5, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
            />
        </>
    );
}

function WalkLegLine({ step, dark }: { step: WalkStep } & Theme) {
    const positions = useMemo(() => walkLegPositions(step), [step]);
    return (
        <Polyline
            positions={positions}
            interactive={false}
            pathOptions={{ color: dark ? '#a1a1aa' : '#52525b', weight: 4, opacity: 1, dashArray: '0.1 8', lineCap: 'round' }}
        />
    );
}

/** Selected itinerary: lines first, then the stops on top of them. */
export function RouteLayer({ route, dark }: { route: RouteOption } & Theme) {
    return (
        <>
            {route.steps.map((step, index) =>
                step.type === 'bus' ? (
                    <BusLegLine key={`line-${index}`} step={step} dark={dark} />
                ) : (
                    <WalkLegLine key={`line-${index}`} step={step} dark={dark} />
                ),
            )}
            {route.steps.map((step, index) => {
                if (step.type !== 'bus') return null;
                const color = strokeColor(step.color, dark);
                return (
                    <Fragment key={`stops-${index}`}>
                        {(step.intermediateStops ?? []).map((stop, i) => (
                            <StopDot key={`${stop.stopId}-${i}`} stop={stop} time={stop.time} color={color} small dark={dark} />
                        ))}
                        <StopDot stop={step.from} time={step.departureTime} color={color} label={`Montée ${step.line}`} dark={dark} />
                        <StopDot stop={step.to} time={step.arrivalTime} color={color} label={`Descente ${step.line}`} dark={dark} />
                    </Fragment>
                );
            })}
        </>
    );
}
