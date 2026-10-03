import { useSyncExternalStore } from 'react';

/** Live result of a CSS media query. */
export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        callback => {
            const list = window.matchMedia(query);
            list.addEventListener('change', callback);
            return () => list.removeEventListener('change', callback);
        },
        () => window.matchMedia(query).matches,
        () => false,
    );
}

export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
export const usePrefersDark = () => useMediaQuery('(prefers-color-scheme: dark)');
