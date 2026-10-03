import { useState } from 'react';
import { formatNumber } from '../lib/format';
import type { Json, PreviewKind } from '../lib/spec';
import { cn } from '../lib/utils';

/**
 * Small map-less preview of a geographic response: vehicles, isochrone, line
 * shape or itinerary, drawn in SVG on the dark response panel.
 */

type LatLon = [number, number];
interface Polyline {
    points: LatLon[];
    color: string;
    width: number;
    dashed?: boolean;
    opacity?: number;
}
interface Dot {
    lat: number;
    lon: number;
    color: string;
    radius: number;
    label: string;
    stroke?: string;
    square?: boolean;
}
interface LegendItem {
    color: string;
    label: string;
    dashed?: boolean;
}
interface Scene {
    lines: Polyline[];
    dots: Dot[];
    legend: LegendItem[];
    gradient?: { from: string; to: string; min: string; max: string };
    summary: string;
}

type Obj = { [key: string]: Json };
const obj = (v: Json | undefined): Obj => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {});
const arr = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);
const num = (v: Json | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: Json | undefined, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const points = (v: Json | undefined): LatLon[] =>
    arr(v).flatMap(p => {
        const [lat, lon] = arr(p);
        return typeof lat === 'number' && typeof lon === 'number' ? [[lat, lon] as LatLon] : [];
    });

const SURFACE = '#111113';
const isochroneColor = (t: number) => `hsl(205 90% ${Math.round(74 - t * 40)}%)`;

function delayText(delay: number | null): string {
    if (delay === null) return 'pas de prévision';
    const minutes = Math.round(delay / 60);
    if (minutes === 0) return 'à l’heure';
    return minutes > 0 ? `+${minutes} min` : `${minutes} min`;
}

function buildScene(kind: PreviewKind, data: Json): Scene | null {
    const root = obj(data);
    switch (kind) {
        case 'vehicles': {
            const vehicles = arr(root.vehicles).map(obj);
            const counts = new Map<string, { color: string; count: number }>();
            const dots: Dot[] = [];
            for (const v of vehicles) {
                const lat = num(v.lat);
                const lon = num(v.lon);
                if (lat === null || lon === null) continue;
                const line = str(v.line, '?');
                const color = str(v.color, '#64748b');
                const entry = counts.get(line) ?? { color, count: 0 };
                entry.count++;
                counts.set(line, entry);
                dots.push({
                    lat,
                    lon,
                    color,
                    radius: 5,
                    stroke: SURFACE,
                    square: v.mode === 'boat',
                    label: `${v.mode === 'boat' ? 'Bateau' : 'Ligne'} ${line}${v.headsign ? ` → ${str(v.headsign)}` : ''} · ${delayText(num(v.delay))}`,
                });
            }
            const legend = [...counts.entries()]
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 8)
                .map(([line, { color, count }]) => ({ color, label: `${line} · ${count}` }));
            if (counts.size > 8) legend.push({ color: 'transparent', label: `+ ${counts.size - 8} lignes` });
            return {
                lines: [],
                dots,
                legend,
                summary: `${formatNumber(dots.length)} véhicule${dots.length > 1 ? 's' : ''} sur ${counts.size} ligne${counts.size > 1 ? 's' : ''}`,
            };
        }
        case 'isochrone': {
            const stops = arr(root.stops).map(obj);
            const max = num(root.maxDuration) ?? Math.max(1, ...stops.map(s => num(s.duration) ?? 0));
            const dots: Dot[] = [...stops]
                .sort((a, b) => (num(b.duration) ?? 0) - (num(a.duration) ?? 0))
                .flatMap(s => {
                    const lat = num(s.lat);
                    const lon = num(s.lon);
                    const duration = num(s.duration) ?? 0;
                    if (lat === null || lon === null) return [];
                    return [
                        {
                            lat,
                            lon,
                            color: isochroneColor(Math.min(1, duration / max)),
                            radius: 3.5,
                            stroke: SURFACE,
                            label: `${str(s.name)} · ${duration} min${num(s.transfers) ? `, ${num(s.transfers)} corresp.` : ''}`,
                        },
                    ];
                });
            const origin = obj(root.origin);
            const lat = num(origin.lat);
            const lon = num(origin.lon);
            if (lat !== null && lon !== null) {
                dots.push({ lat, lon, color: '#ffffff', radius: 6, stroke: SURFACE, square: false, label: `Départ : ${str(origin.name, 'point choisi')}` });
            }
            return {
                lines: [],
                dots,
                legend: [],
                gradient: { from: isochroneColor(0), to: isochroneColor(1), min: '0 min', max: `${max} min` },
                summary: `${formatNumber(stops.length)} arrêts atteignables en ${max} min`,
            };
        }
        case 'shape': {
            const color = str(root.color, '#60a5fa');
            const directions = arr(root.directions).map(obj);
            const lines: Polyline[] = directions.map((d, i) => ({
                points: points(d.coordinates),
                color,
                width: i === 0 ? 3.5 : 2,
                dashed: i > 0,
                opacity: i === 0 ? 1 : 0.75,
            }));
            const dots: Dot[] = directions.slice(0, 1).flatMap(d =>
                arr(d.stops)
                    .map(obj)
                    .flatMap(s => {
                        const lat = num(s.lat);
                        const lon = num(s.lon);
                        return lat === null || lon === null ? [] : [{ lat, lon, color: SURFACE, stroke: color, radius: 3.5, label: str(s.name) }];
                    }),
            );
            return {
                lines,
                dots,
                legend: directions.map((d, i) => ({ color, dashed: i > 0, label: `→ ${str(d.headsign)}` })),
                summary: `Ligne ${str(root.bus_id)} : ${directions.length} sens`,
            };
        }
        case 'route': {
            const result = obj(root.data ?? root);
            const route = obj(arr(result.routes)[0]);
            const steps = arr(route.steps).map(obj);
            if (steps.length === 0) return null;
            const lines: Polyline[] = [];
            const legend: LegendItem[] = [];
            for (const step of steps) {
                const geometry = points(step.geometry);
                const from = obj(step.from);
                const to = obj(step.to);
                const path =
                    geometry.length >= 2
                        ? geometry
                        : ([
                              [num(from.lat), num(from.lon)],
                              [num(to.lat), num(to.lon)],
                          ].filter(p => p[0] !== null && p[1] !== null) as LatLon[]);
                if (step.type === 'walk') {
                    lines.push({ points: path, color: '#a1a1aa', width: 2, dashed: true });
                } else {
                    const color = str(step.color, '#60a5fa');
                    lines.push({ points: path, color, width: 4 });
                    legend.push({ color, label: `${step.mode === 'boat' ? 'Bateau' : 'Ligne'} ${str(step.line)} · ${str(step.departureTime)}` });
                }
            }
            if (steps.some(s => s.type === 'walk')) legend.push({ color: '#a1a1aa', dashed: true, label: 'À pied' });
            const origin = obj(result.from);
            const destination = obj(result.to);
            const dots: Dot[] = [];
            for (const [place, square] of [
                [origin, false],
                [destination, true],
            ] as const) {
                const lat = num(place.lat);
                const lon = num(place.lon);
                if (lat !== null && lon !== null) {
                    dots.push({ lat, lon, color: '#ffffff', stroke: SURFACE, radius: 5.5, square, label: str(place.name, square ? 'Arrivée' : 'Départ') });
                }
            }
            return {
                lines,
                dots,
                legend,
                summary: `Premier itinéraire : ${str(route.departureTime)} → ${str(route.arrivalTime)}, ${num(route.duration) ?? '?'} min`,
            };
        }
    }
}

const WIDTH = 480;
const HEIGHT = 270;
const NICE_DISTANCES = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];

export function GeoPreview({ kind, data, className }: { kind: PreviewKind; data: Json; className?: string }) {
    const [hover, setHover] = useState<number | null>(null);
    const scene = buildScene(kind, data);
    const all: LatLon[] = scene ? [...scene.lines.flatMap(l => l.points), ...scene.dots.map(d => [d.lat, d.lon] as LatLon)] : [];
    if (!scene || all.length === 0) {
        return <p className={cn('px-4 py-6 text-center text-xs text-zinc-500', className)}>Rien à afficher sur la carte.</p>;
    }

    let minLat = Math.min(...all.map(p => p[0]));
    let maxLat = Math.max(...all.map(p => p[0]));
    let minLon = Math.min(...all.map(p => p[1]));
    let maxLon = Math.max(...all.map(p => p[1]));
    const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    // Same scale on both axes, padded, fitted to the frame.
    let spanX = Math.max((maxLon - minLon) * k, 0.004);
    let spanY = Math.max(maxLat - minLat, 0.004);
    const padding = 0.12;
    spanX *= 1 + padding * 2;
    spanY *= 1 + padding * 2;
    if (spanX / spanY > WIDTH / HEIGHT) spanY = (spanX * HEIGHT) / WIDTH;
    else spanX = (spanY * WIDTH) / HEIGHT;
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    minLat = centerLat - spanY / 2;
    maxLat = centerLat + spanY / 2;
    minLon = centerLon - spanX / k / 2;
    maxLon = centerLon + spanX / k / 2;
    const x = (lon: number) => ((lon - minLon) / (maxLon - minLon)) * WIDTH;
    const y = (lat: number) => ((maxLat - lat) / (maxLat - minLat)) * HEIGHT;

    const metersWide = spanX * 111_320;
    const scaleMeters = NICE_DISTANCES.find(d => d >= metersWide / 6) ?? 50000;
    const scaleWidth = (scaleMeters / metersWide) * WIDTH;
    const hovered = hover === null ? null : scene.dots[hover];

    return (
        <figure className={cn('m-0', className)}>
            <div className="relative overflow-hidden rounded-lg border border-white/[0.06] bg-[#0c0c0e]">
                <svg
                    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                    role="img"
                    aria-label={scene.summary}
                    className="block h-auto w-full"
                    onMouseLeave={() => setHover(null)}
                >
                    <defs>
                        <pattern id={`dots-${kind}`} width="12" height="12" patternUnits="userSpaceOnUse">
                            <circle cx="1" cy="1" r="0.6" fill="rgb(255 255 255 / 0.09)" />
                        </pattern>
                    </defs>
                    <rect width={WIDTH} height={HEIGHT} fill={`url(#dots-${kind})`} />
                    {scene.lines.map((line, i) => (
                        <polyline
                            key={i}
                            points={line.points.map(([la, lo]) => `${x(lo).toFixed(1)},${y(la).toFixed(1)}`).join(' ')}
                            fill="none"
                            stroke={line.color}
                            strokeWidth={line.width * 0.8}
                            strokeOpacity={line.opacity ?? 1}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={line.dashed ? '1 4' : undefined}
                        />
                    ))}
                    {scene.dots.map((dot, i) => {
                        const cx = x(dot.lon);
                        const cy = y(dot.lat);
                        const r = dot.radius * 0.8 * (hover === i ? 1.4 : 1);
                        return (
                            <g key={i} onMouseEnter={() => setHover(i)}>
                                {/* Bigger hit target than the mark. */}
                                <circle cx={cx} cy={cy} r={Math.max(r + 3, 7)} fill="transparent" />
                                {dot.square ? (
                                    <rect
                                        x={cx - r}
                                        y={cy - r}
                                        width={r * 2}
                                        height={r * 2}
                                        rx={r * 0.35}
                                        fill={dot.color}
                                        stroke={dot.stroke ?? SURFACE}
                                        strokeWidth={1.5}
                                    />
                                ) : (
                                    <circle cx={cx} cy={cy} r={r} fill={dot.color} stroke={dot.stroke ?? SURFACE} strokeWidth={1.5} />
                                )}
                            </g>
                        );
                    })}
                    <g transform={`translate(${WIDTH - scaleWidth - 12} ${HEIGHT - 12})`}>
                        <rect width={scaleWidth} height="2" rx="1" fill="rgb(255 255 255 / 0.45)" />
                        <text x={scaleWidth / 2} y="-5" textAnchor="middle" fontSize="9.5" fill="rgb(255 255 255 / 0.6)" fontFamily="inherit">
                            {scaleMeters >= 1000 ? `${scaleMeters / 1000} km` : `${scaleMeters} m`}
                        </text>
                    </g>
                </svg>
                {hovered && (
                    <div
                        className="pointer-events-none absolute z-10 max-w-[70%] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-900 shadow-lg"
                        style={{ left: `${(x(hovered.lon) / WIDTH) * 100}%`, top: `calc(${(y(hovered.lat) / HEIGHT) * 100}% - 10px)` }}
                    >
                        <span className="block truncate">{hovered.label}</span>
                    </div>
                )}
            </div>
            <figcaption className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-zinc-400">
                <span className="font-medium text-zinc-300">{scene.summary}</span>
                {scene.legend.map(item => (
                    <span key={item.label} className="inline-flex items-center gap-1.5">
                        {item.color !== 'transparent' &&
                            (item.dashed ? (
                                <span className="h-0 w-3.5 border-t-2 border-dotted" style={{ borderColor: item.color }} aria-hidden="true" />
                            ) : (
                                <span className="h-2 w-2 rounded-full" style={{ background: item.color }} aria-hidden="true" />
                            ))}
                        {item.label}
                    </span>
                ))}
                {scene.gradient && (
                    <span className="inline-flex items-center gap-1.5">
                        {scene.gradient.min}
                        <span
                            className="h-1.5 w-16 rounded-full"
                            style={{ background: `linear-gradient(to right, ${scene.gradient.from}, ${scene.gradient.to})` }}
                            aria-hidden="true"
                        />
                        {scene.gradient.max}
                    </span>
                )}
            </figcaption>
        </figure>
    );
}
