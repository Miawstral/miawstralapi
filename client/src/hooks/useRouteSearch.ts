import { useCallback, useEffect, useRef, useState } from 'react';
import { calculateRoutes, getErrorMessage, isAbortError } from '@/lib/api';
import type { RouteRequest, RouteResponse } from '@/types';

export type RouteSearchState =
    | { status: 'idle' }
    | { status: 'loading'; request: RouteRequest }
    | { status: 'error'; request: RouteRequest; message: string }
    | { status: 'success'; request: RouteRequest; response: RouteResponse; id: number };

/** POST /api/routes/calculate, keeping only the latest request alive. */
export function useRouteSearch() {
    const [state, setState] = useState<RouteSearchState>({ status: 'idle' });
    const controllerRef = useRef<AbortController | null>(null);
    const searchIdRef = useRef(0);

    useEffect(() => () => controllerRef.current?.abort(), []);

    const search = useCallback(async (request: RouteRequest) => {
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;
        const id = ++searchIdRef.current;

        setState({ status: 'loading', request });
        try {
            const response = await calculateRoutes(request, controller.signal);
            setState({
                status: 'success',
                request,
                id,
                response: {
                    ...response,
                    routes: Array.isArray(response.routes) ? response.routes : [],
                    warnings: Array.isArray(response.warnings) ? response.warnings : [],
                },
            });
        } catch (error) {
            if (isAbortError(error) || controller.signal.aborted) return;
            setState({ status: 'error', request, message: getErrorMessage(error) });
        }
    }, []);

    return { state, search };
}
