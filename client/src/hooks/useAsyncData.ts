import { useEffect, useEffectEvent, useState } from 'react';
import { getErrorMessage } from '@/lib/api';

export type AsyncState<T> =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: T }
    | { status: 'error'; message: string };

type Settled<T> = { status: 'success'; data: T } | { status: 'error'; message: string };

/**
 * Runs `load` whenever `key` changes (and aborts the previous request).
 * Pass `null` as key to stay idle. Change the key (e.g. append an attempt
 * counter) to reload.
 */
export function useAsyncData<T>(
    key: string | null,
    load: (signal: AbortSignal) => Promise<T>,
): AsyncState<T> {
    const [settled, setSettled] = useState<{ key: string; result: Settled<T> } | null>(null);
    const runLoad = useEffectEvent((signal: AbortSignal) => load(signal));

    useEffect(() => {
        if (key === null) return;
        const controller = new AbortController();
        runLoad(controller.signal).then(
            (data) => setSettled({ key, result: { status: 'success', data } }),
            (error: unknown) => {
                if (controller.signal.aborted) return;
                setSettled({ key, result: { status: 'error', message: getErrorMessage(error) } });
            },
        );
        return () => controller.abort();
    }, [key]);

    if (key === null) return { status: 'idle' };
    if (!settled || settled.key !== key) return { status: 'loading' };
    return settled.result;
}
