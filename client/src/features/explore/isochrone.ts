/** Travel time buckets of the isochrone map, from near (green) to far (purple). */
export const ISOCHRONE_STEPS = [
    { max: 10, color: '#16a34a', label: '< 10 min' },
    { max: 20, color: '#65a30d', label: '10–20' },
    { max: 30, color: '#ca8a04', label: '20–30' },
    { max: 45, color: '#ea580c', label: '30–45' },
    { max: 60, color: '#dc2626', label: '45–60' },
    { max: Infinity, color: '#9333ea', label: '> 60' },
] as const;

export function isochroneColor(minutes: number): string {
    return (ISOCHRONE_STEPS.find(s => minutes < s.max) ?? ISOCHRONE_STEPS[ISOCHRONE_STEPS.length - 1]).color;
}

export const DURATION_CHOICES = [15, 30, 45, 60, 90];
