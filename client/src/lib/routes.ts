import type { RouteOption } from '@/types';
import { minutesBetween } from './format';

export type RouteTag = 'fastest' | 'fewest-transfers' | 'walk';

export const TAG_LABELS: Record<RouteTag, string> = {
    fastest: 'Le plus rapide',
    'fewest-transfers': 'Moins de correspondances',
    walk: 'À pied',
};

export const isWalkOnly = (route: RouteOption) => route.steps.every(s => s.type === 'walk');

/** Highlights that help choosing between itineraries. */
export function routeTags(routes: RouteOption[]): RouteTag[][] {
    const transit = routes.filter(r => !isWalkOnly(r));
    const fastest = Math.min(...transit.map(r => r.duration));
    const fewest = Math.min(...transit.map(r => r.transfers));
    const fastestIsFewest = transit.some(r => r.duration === fastest && r.transfers === fewest);

    let fastestTagged = false;
    let fewestTagged = false;
    return routes.map(route => {
        if (isWalkOnly(route)) return ['walk'];
        const tags: RouteTag[] = [];
        if (transit.length > 1 && route.duration === fastest && !fastestTagged) {
            tags.push('fastest');
            fastestTagged = true;
        } else if (!fastestIsFewest && route.transfers === fewest && !fewestTagged) {
            tags.push('fewest-transfers');
            fewestTagged = true;
        }
        return tags;
    });
}

/** Minutes until the departure of the route, when it is within the next two hours. */
export function minutesUntil(departureTime: string, now: string): number | null {
    const delta = minutesBetween(now, departureTime);
    return delta !== null && delta >= 0 && delta <= 120 ? delta : null;
}
