import { useState } from 'react';
import type { Direction, LineSummary, ServiceAlert, Vehicle } from '@/types';
import { LineDetail } from './LineDetail';
import { LineList } from './LineList';
import type { SelectedStop } from './LineStopsTimeline';

interface LinesPanelProps {
    lines: LineSummary[];
    loading: boolean;
    selectedLineId: string | null;
    onSelectLine: (id: string | null) => void;
    direction: Direction;
    onDirectionChange: (d: Direction) => void;
    alerts: ServiceAlert[];
    vehicles: Vehicle[] | null;
    /** Service day YYYY-MM-DD (default: today). */
    date?: string;
    onSelectStop: (stop: SelectedStop) => void;
}

/** Lines of the network, and the detail of the selected one (stops, next passages, live vehicles). */
export function LinesPanel({
    lines,
    loading,
    selectedLineId,
    onSelectLine,
    direction,
    onDirectionChange,
    alerts,
    vehicles,
    date,
    onSelectStop,
}: LinesPanelProps) {
    // Kept here so that the search and the scroll offset survive a visit to a line.
    const [query, setQuery] = useState('');
    const [fromList, setFromList] = useState<{ scrollTop: number; lineId: string } | null>(null);
    // Last line shown: the list position is only restored when coming back from the line opened from it.
    const [lastShown, setLastShown] = useState<string | null>(selectedLineId);
    if (selectedLineId && selectedLineId !== lastShown) setLastShown(selectedLineId);

    if (selectedLineId) {
        return (
            <LineDetail
                key={selectedLineId}
                lineId={selectedLineId}
                summary={lines.find(line => line.bus_id === selectedLineId)}
                date={date}
                direction={direction}
                onDirectionChange={onDirectionChange}
                alerts={alerts}
                vehicles={vehicles}
                onBack={() => onSelectLine(null)}
                onSelectLine={onSelectLine}
                onSelectStop={onSelectStop}
            />
        );
    }

    return (
        <LineList
            lines={lines}
            loading={loading}
            query={query}
            onQueryChange={setQuery}
            onSelectLine={(lineId, scrollTop) => {
                setFromList({ lineId, scrollTop });
                onSelectLine(lineId);
            }}
            alerts={alerts}
            vehicles={vehicles}
            restore={fromList?.lineId === lastShown ? fromList : null}
        />
    );
}
