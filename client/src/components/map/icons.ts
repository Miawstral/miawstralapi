import { divIcon } from 'leaflet';

/** Same shapes as the timeline: a ring for the origin, a square for the destination. */
export const originIcon = divIcon({
    className: 'map-marker',
    html: '<span class="block h-4 w-4 rounded-full border-[3.5px] border-zinc-950 bg-white shadow-[0_0_0_2px_white,0_2px_6px_rgb(0_0_0/0.35)] dark:border-white dark:bg-zinc-950 dark:shadow-[0_0_0_2px_rgb(24_24_27),0_2px_6px_rgb(0_0_0/0.6)]"></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    tooltipAnchor: [0, -10],
});

export const destinationIcon = divIcon({
    className: 'map-marker',
    html: '<span class="block h-4 w-4 rounded-[4px] bg-zinc-950 shadow-[0_0_0_2.5px_white,0_2px_6px_rgb(0_0_0/0.35)] dark:bg-white dark:shadow-[0_0_0_2.5px_rgb(24_24_27),0_2px_6px_rgb(0_0_0/0.6)]"></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    tooltipAnchor: [0, -10],
});
