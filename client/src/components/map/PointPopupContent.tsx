import { useEffect, useEffectEvent } from 'react';
import { MapPin } from 'lucide-react';
import { useAsyncData } from '@/hooks/useAsyncData';
import { getNearbyStops } from '@/lib/api';
import { formatCoordinates, formatDistance } from '@/lib/format';
import { MAP_POINT_LABEL } from '@/lib/places';
import type { StopSummary } from '@/types';
import { PopupActions } from './PopupActions';

const NEARBY_RADIUS = 400;
const NEARBY_LIMIT = 4;

interface PointPopupContentProps {
    lat: number;
    lon: number;
    onOrigin: () => void;
    onDestination: () => void;
    onShowStop: (stop: StopSummary) => void;
    onLayoutChange: () => void;
}

export function PointPopupContent({
    lat,
    lon,
    onOrigin,
    onDestination,
    onShowStop,
    onLayoutChange,
}: PointPopupContentProps) {
    const nearby = useAsyncData(`${lat},${lon}`, (signal) => getNearbyStops(lat, lon, NEARBY_RADIUS, signal));

    const notifyLayout = useEffectEvent(onLayoutChange);
    useEffect(() => {
        notifyLayout();
    }, [nearby.status]);

    const stops = nearby.status === 'success' && Array.isArray(nearby.data) ? nearby.data.slice(0, NEARBY_LIMIT) : [];

    return (
        <div className="w-64 text-sm text-foreground">
            <div className="border-b p-3.5 pr-10">
                <h3 className="text-[15px] font-semibold leading-tight">{MAP_POINT_LABEL}</h3>
                <div className="text-xs text-muted-foreground tnum">{formatCoordinates(lat, lon)}</div>
            </div>
            <div className="p-3.5 pt-3">
                <h4 className="mb-1 text-xs font-medium text-muted-foreground">Arrêts à proximité</h4>
                {nearby.status === 'loading' && <div className="skeleton h-5" />}
                {nearby.status === 'error' && <p className="text-xs text-danger">Recherche indisponible.</p>}
                {nearby.status === 'success' && stops.length === 0 && (
                    <p className="text-xs text-muted-foreground">Aucun arrêt à moins de {formatDistance(NEARBY_RADIUS)}.</p>
                )}
                {stops.length > 0 && (
                    <ul className="-mx-1.5">
                        {stops.map(stop => (
                            <li key={stop.stopPointId}>
                                <button
                                    type="button"
                                    onClick={() => onShowStop(stop)}
                                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-muted"
                                >
                                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                    <span className="min-w-0 flex-1 truncate text-[13px]">{stop.name}</span>
                                    {typeof stop.distance === 'number' && (
                                        <span className="shrink-0 text-xs text-muted-foreground tnum">{formatDistance(stop.distance)}</span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="mt-3">
                    <PopupActions onOrigin={onOrigin} onDestination={onDestination} />
                </div>
            </div>
        </div>
    );
}
