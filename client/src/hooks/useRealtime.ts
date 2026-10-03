import { getAlerts, getVehicles } from '@/lib/api';
import { usePolling } from './usePolling';

/** Live vehicle positions (every 10 s while visible). */
export function useVehicles(enabled: boolean) {
    return usePolling(enabled ? 'vehicles' : null, getVehicles, 10_000);
}

/** Service alerts (every 2 minutes). */
export function useAlerts() {
    return usePolling('alerts', getAlerts, 120_000);
}
