const EARTH_RADIUS_M = 6_371_000;

/** Walking speed used for estimates, in meters per minute (≈ 4.8 km/h). */
export const WALKING_SPEED_M_PER_MIN = 80;
/** Ratio between the street distance and the straight-line distance in a city. */
export const URBAN_DETOUR_FACTOR = 1.3;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in meters (haversine formula). */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Estimated walk between two points: street distance (m) and duration (whole minutes, ≥ 1). */
export function estimateWalk(lat1: number, lon1: number, lat2: number, lon2: number): { distance: number; duration: number } {
    const distance = Math.round(haversine(lat1, lon1, lat2, lon2) * URBAN_DETOUR_FACTOR);
    return { distance, duration: Math.max(1, Math.ceil(distance / WALKING_SPEED_M_PER_MIN)) };
}

