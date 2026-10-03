import { useEffect, useEffectEvent, useState } from 'react';

export interface Polled<T> {
    data: T | null;
    error: string | null;
    /** Date.now() of the last success. */
    updatedAt: number | null;
}

/** Loads `load` now and every `intervalMs` while the page is visible. */
export function usePolling<T>(load: (signal: AbortSignal) => Promise<T>, intervalMs: number): Polled<T> {
    const [state, setState] = useState<Polled<T>>({ data: null, error: null, updatedAt: null });
    const run = useEffectEvent((signal: AbortSignal) => load(signal));

    useEffect(() => {
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
                if (!stopped) setState({ data, error: null, updatedAt: Date.now() });
            } catch (error) {
                if (!stopped && !controller.signal.aborted) {
                    setState(s => ({ ...s, error: error instanceof Error ? error.message : String(error) }));
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
    }, [intervalMs]);

    return state;
}

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
}
