import { useCallback, useSyncExternalStore } from 'react';
import type { StopSummary } from '@/types';

/** Favorite stops, kept in localStorage (fails silently when storage is unavailable). */
const KEY = 'miawstral:favorites';
const listeners = new Set<() => void>();
let cache: StopSummary[] | null = null;

function read(): StopSummary[] {
    if (cache) return cache;
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
        cache = Array.isArray(parsed) ? parsed.filter((s): s is StopSummary => typeof s?.stopPointId === 'string') : [];
    } catch {
        cache = [];
    }
    return cache;
}

function write(next: StopSummary[]): void {
    cache = next;
    try {
        localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        // ignore
    }
    listeners.forEach(l => l());
}

export function useFavorites() {
    const favorites = useSyncExternalStore(
        listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        read,
        read,
    );
    const isFavorite = useCallback((id: string) => favorites.some(f => f.stopPointId === id), [favorites]);
    const toggle = useCallback((stop: StopSummary) => {
        const current = read();
        write(
            current.some(f => f.stopPointId === stop.stopPointId)
                ? current.filter(f => f.stopPointId !== stop.stopPointId)
                : [{ ...stop, distance: undefined }, ...current].slice(0, 12),
        );
    }, []);
    return { favorites, isFavorite, toggle };
}
