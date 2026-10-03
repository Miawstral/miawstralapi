import { useEffect, useEffectEvent, useState } from 'react';
import { getErrorMessage } from '@/lib/api';

export interface PollingState<T> {
    data: T | null;
    error: string | null;
    loading: boolean;
    /** Date.now() of the last successful load. */
    updatedAt: number | null;
}

/**
 * Loads `load` every `intervalMs` while the page is visible (and right away when
 * it becomes visible again). `key` restarts it; `null` pauses it.
 */
export function usePolling<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, intervalMs: number): PollingState<T> {
    const [state, setState] = useState<PollingState<T> & { key: string | null }>({
        key,
        data: null,
        error: null,
        loading: key !== null,
        updatedAt: null,
    });
    const run = useEffectEvent((signal: AbortSignal) => load(signal));

    useEffect(() => {
        if (key === null) return;
        let controller: AbortController | null = null;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let stopped = false;

        const tick = async () => {
            clearTimeout(timer);
            if (document.visibilityState !== 'visible') return;
            controller?.abort();
            controller = new AbortController();
            try {
                const data = await run(controller.signal);
                if (!stopped) setState({ key, data, error: null, loading: false, updatedAt: Date.now() });
            } catch (error) {
                if (!stopped && !controller.signal.aborted) {
                    setState(s => ({ ...s, key, error: getErrorMessage(error), loading: false }));
                }
            }
            if (!stopped) timer = setTimeout(tick, intervalMs);
        };
        const onVisibility = () => {
            if (document.visibilityState === 'visible') void tick();
        };

        void tick();
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            stopped = true;
            clearTimeout(timer);
            controller?.abort();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [key, intervalMs]);

    if (state.key !== key) return { data: null, error: null, loading: key !== null, updatedAt: null };
    return state;
}
