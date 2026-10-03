import { useEffect, useRef } from 'react';
import { divIcon, marker as leafletMarker, type Marker } from 'leaflet';
import { useMap } from 'react-leaflet';
import { formatDelay } from '@/lib/realtime';
import type { Vehicle } from '@/types';

interface VehiclesLayerProps {
    vehicles: Vehicle[];
    /** Only these lines (e.g. the line being explored). */
    lines?: ReadonlySet<string> | null;
    animate: boolean;
}

const ANIMATION_MS = 1600;

const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function iconHtml(v: Vehicle): string {
    const label = escapeHtml(v.line ?? '?');
    const arrow =
        v.bearing === null
            ? ''
            : `<span class="vehicle-arrow" style="transform: rotate(${Math.round(v.bearing)}deg)"><span style="border-bottom-color:${v.color}"></span></span>`;
    return `<span class="vehicle-marker${label.length > 2 ? ' is-wide' : ''}" style="--line:${v.color};--text:${v.textColor}">${arrow}<span class="vehicle-badge">${label}</span></span>`;
}

function popupHtml(v: Vehicle): string {
    const delay = v.delay === null ? '' : `<span class="vehicle-delay ${v.delay > 120 ? 'is-late' : 'is-ontime'}">${escapeHtml(formatDelay(v.delay))}</span>`;
    const rows = [
        v.nextStop ? `<div><span>${v.status === 'STOPPED_AT' ? 'À l’arrêt' : 'Prochain arrêt'}</span><strong>${escapeHtml(v.nextStop.name)}</strong></div>` : '',
        v.speed !== null ? `<div><span>Vitesse</span><strong>${v.speed} km/h</strong></div>` : '',
        v.updatedAt
            ? `<div><span>Position</span><strong>${new Date(v.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong></div>`
            : '',
    ].join('');
    return `<div class="vehicle-popup">
        <div class="vehicle-popup-head">
            <span class="vehicle-badge" style="--line:${v.color};--text:${v.textColor}">${escapeHtml(v.line ?? '?')}</span>
            <div><div class="vehicle-popup-title">${escapeHtml(v.headsign ? `→ ${v.headsign}` : v.lineName ?? 'Véhicule')}</div>
            <div class="vehicle-popup-live"><span class="live-dot"></span>En direct ${delay}</div></div>
        </div>
        <div class="vehicle-popup-rows">${rows}</div>
    </div>`;
}

/**
 * Live vehicles, drawn with plain Leaflet markers (faster than React
 * components for ~150 moving icons). Positions glide to their new value.
 */
export function VehiclesLayer({ vehicles, lines, animate }: VehiclesLayerProps) {
    const map = useMap();
    const markers = useRef(new Map<string, { marker: Marker; key: string; frame?: number }>());

    useEffect(() => {
        const current = markers.current;
        const seen = new Set<string>();
        for (const v of vehicles) {
            if (lines && (!v.line || !lines.has(v.line))) continue;
            seen.add(v.id);
            const key = `${v.line}|${v.color}|${Math.round((v.bearing ?? -1) / 5)}`;
            const entry = current.get(v.id);
            if (!entry) {
                const marker = leafletMarker([v.lat, v.lon], {
                    icon: divIcon({ className: 'map-marker', html: iconHtml(v), iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14] }),
                    zIndexOffset: 500,
                    keyboard: false,
                    title: `Ligne ${v.line ?? '?'}${v.headsign ? ` → ${v.headsign}` : ''}`,
                })
                    .bindPopup(popupHtml(v), { className: 'vehicle-popup-container', minWidth: 220, autoPanPadding: [40, 40] })
                    .addTo(map);
                current.set(v.id, { marker, key });
                continue;
            }
            if (entry.key !== key) {
                entry.marker.setIcon(
                    divIcon({ className: 'map-marker', html: iconHtml(v), iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14] }),
                );
                entry.key = key;
            }
            entry.marker.setPopupContent(popupHtml(v));
            const from = entry.marker.getLatLng();
            if (entry.frame) cancelAnimationFrame(entry.frame);
            if (!animate || (from.lat === v.lat && from.lng === v.lon)) {
                entry.marker.setLatLng([v.lat, v.lon]);
                continue;
            }
            const start = performance.now();
            const step = (now: number) => {
                const t = Math.min(1, (now - start) / ANIMATION_MS);
                const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
                entry.marker.setLatLng([from.lat + (v.lat - from.lat) * e, from.lng + (v.lon - from.lng) * e]);
                if (t < 1) entry.frame = requestAnimationFrame(step);
            };
            entry.frame = requestAnimationFrame(step);
        }
        for (const [id, entry] of current) {
            if (seen.has(id)) continue;
            if (entry.frame) cancelAnimationFrame(entry.frame);
            entry.marker.remove();
            current.delete(id);
        }
    }, [vehicles, lines, animate, map]);

    useEffect(
        () => () => {
            for (const entry of markers.current.values()) {
                if (entry.frame) cancelAnimationFrame(entry.frame);
                entry.marker.remove();
            }
            markers.current.clear();
        },
        [],
    );

    return null;
}
