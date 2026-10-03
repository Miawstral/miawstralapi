import { useCallback, useMemo, useState } from 'react';
import { getLines, getStops } from '@/lib/api';
import { indexStops, type IndexedStop } from '@/lib/text';
import type { LineSummary, StopSummary } from '@/types';
import { useAsyncData, type AsyncState } from './useAsyncData';

export interface NetworkData {
    stops: StopSummary[];
    stopsIndex: IndexedStop[];
    stopsState: AsyncState<StopSummary[]>;
    linesById: ReadonlyMap<string, LineSummary>;
    reloadStops: () => void;
}

const NO_STOPS: StopSummary[] = [];

/** Stops and lines of the network, loaded once (used for autocomplete, the map and line colors). */
export function useNetwork(): NetworkData {
    const [attempt, setAttempt] = useState(0);
    const stopsState = useAsyncData(`stops#${attempt}`, getStops);
    const linesState = useAsyncData('lines', getLines);

    const stops = stopsState.status === 'success' && Array.isArray(stopsState.data) ? stopsState.data : NO_STOPS;
    const stopsIndex = useMemo(() => indexStops(stops), [stops]);

    const lines = linesState.status === 'success' && Array.isArray(linesState.data) ? linesState.data : null;
    const linesById = useMemo(() => new Map((lines ?? []).map((line) => [line.bus_id, line])), [lines]);

    const reloadStops = useCallback(() => setAttempt((n) => n + 1), []);

    return { stops, stopsIndex, stopsState, linesById, reloadStops };
}
