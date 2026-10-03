import { ChevronRight, TriangleAlert } from 'lucide-react';
import { RealtimeBadge } from '@/components/common/RealtimeBadge';
import { formatDistance, formatDuration, formatTime, formatTransfers } from '@/lib/format';
import { isWalkOnly, TAG_LABELS, type RouteTag } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { RouteOption } from '@/types';
import { RouteGlyphs } from './RouteGlyphs';

interface RouteRowProps {
    route: RouteOption;
    tags: RouteTag[];
    selected: boolean;
    /** Minutes before departure, when soon. */
    leavesIn: number | null;
    onOpen: () => void;
    onPreview: (active: boolean) => void;
    index: number;
}

export function RouteRow({ route, tags, selected, leavesIn, onOpen, onPreview, index }: RouteRowProps) {
    const walkOnly = isWalkOnly(route);
    const firstRide = route.steps.find(s => s.type === 'bus');
    const meta = [
        leavesIn === null ? null : leavesIn === 0 ? 'Départ maintenant' : `Départ dans ${formatDuration(leavesIn)}`,
        walkOnly ? null : formatTransfers(route.transfers),
        route.walkingDistance > 0 ? `${formatDistance(route.walkingDistance)} à pied` : null,
    ].filter(Boolean);

    return (
        <button
            type="button"
            onClick={onOpen}
            onMouseEnter={() => onPreview(true)}
            onMouseLeave={() => onPreview(false)}
            onFocus={() => onPreview(true)}
            onBlur={() => onPreview(false)}
            aria-current={selected ? 'true' : undefined}
            style={{ animationDelay: `${index * 35}ms` }}
            className={cn(
                'group relative block w-full rounded-xl px-3 py-3 text-left transition-colors motion-safe:animate-rise-in',
                selected ? 'bg-subtle shadow-control' : 'hover:bg-subtle',
            )}
        >
            <span className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-semibold tracking-tight tnum">
                    {formatTime(route.departureTime)}
                    <span className="mx-1.5 font-normal text-muted-foreground">→</span>
                    {formatTime(route.arrivalTime)}
                </span>
                <span className="text-[15px] font-semibold tracking-tight tnum">{formatDuration(route.duration)}</span>
            </span>
            <span className="mt-2 flex items-center justify-between gap-3">
                <RouteGlyphs route={route} />
                <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                />
            </span>
            <span className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                {tags.map(tag => (
                    <span key={tag} className="rounded-full bg-brand/10 px-1.5 py-px text-2xs font-medium text-brand">
                        {TAG_LABELS[tag]}
                    </span>
                ))}
                {meta.map((item, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                        {(i > 0 || tags.length > 0) && <span aria-hidden="true">·</span>}
                        {item}
                    </span>
                ))}
                {firstRide?.realtime && <RealtimeBadge delay={firstRide.realtime.departureDelay} className="ml-0.5" />}
                {firstRide?.cancelled && <span className="font-medium text-danger">Course supprimée</span>}
                {route.alerts.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-warning" title="Perturbation sur une ligne de ce trajet">
                        <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                        Info trafic
                    </span>
                )}
            </span>
        </button>
    );
}
