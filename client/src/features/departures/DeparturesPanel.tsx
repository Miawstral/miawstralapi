import { usePolling } from '@/hooks/usePolling';
import { getAlerts } from '@/lib/api';
import type { IndexedStop } from '@/lib/text';
import type { LineSummary, ServiceAlert, StopSummary } from '@/types';
import { StopBoard } from './StopBoard';
import { StopPicker } from './StopPicker';

interface DeparturesPanelProps {
    stop: StopSummary | null;
    onStopChange: (stop: StopSummary | null) => void;
    stopsIndex: IndexedStop[];
    stopsStatus: 'loading' | 'error' | 'ready';
    linesById: ReadonlyMap<string, LineSummary>;
    onPlanFrom: (stop: StopSummary) => void;
    onPlanTo: (stop: StopSummary) => void;
    onSelectLine: (lineId: string) => void;
    /**
     * Optional: the alerts the shell already polls. Without it, the panel
     * fetches them itself (every 2 min) to show the disruptions at the stop.
     */
    alerts?: ServiceAlert[] | null;
}

/** Live departures at a stop, or the choice of a stop (search, nearest, favorites). */
export function DeparturesPanel({
    stop,
    onStopChange,
    stopsIndex,
    stopsStatus,
    linesById,
    onPlanFrom,
    onPlanTo,
    onSelectLine,
    alerts,
}: DeparturesPanelProps) {
    const ownAlerts = usePolling(alerts === undefined && stop ? 'departures:alerts' : null, getAlerts, 120_000);

    if (!stop) {
        return <StopPicker onStopChange={onStopChange} stopsIndex={stopsIndex} stopsStatus={stopsStatus} linesById={linesById} />;
    }
    return (
        <StopBoard
            key={stop.stopPointId}
            stop={stop}
            onBack={() => onStopChange(null)}
            linesById={linesById}
            alerts={alerts === undefined ? ownAlerts.data : alerts}
            onPlanFrom={onPlanFrom}
            onPlanTo={onPlanTo}
            onSelectLine={onSelectLine}
        />
    );
}
