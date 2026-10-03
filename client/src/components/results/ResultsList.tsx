import { RotateCw } from 'lucide-react';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import type { RouteSearchState } from '@/hooks/useRouteSearch';
import { currentTime, formatTime, plural } from '@/lib/format';
import { minutesUntil, routeTags } from '@/lib/routes';
import { RouteRow } from './RouteRow';

interface ResultsListProps {
    state: RouteSearchState;
    selectedIndex: number;
    /** Departure time is "now": show "leaves in X min". */
    relativeTimes: boolean;
    onOpen: (index: number) => void;
    onPreview: (index: number | null) => void;
    onRetry: () => void;
}

export function ResultsList({ state, selectedIndex, relativeTimes, onOpen, onPreview, onRetry }: ResultsListProps) {
    if (state.status === 'loading') return <ResultsSkeleton />;

    if (state.status === 'error') {
        return (
            <div className="p-3">
                <Notice
                    tone="error"
                    title="La recherche a échoué"
                    action={
                        <Button size="sm" onClick={onRetry}>
                            <RotateCw aria-hidden="true" />
                            Réessayer
                        </Button>
                    }
                >
                    {state.message}
                </Notice>
            </div>
        );
    }

    if (state.status !== 'success') return null;

    const { routes, warnings, departureTime } = state.response;
    const tags = routeTags(routes);
    const now = currentTime();

    return (
        <section aria-label="Itinéraires" className="pb-2">
            <header className="flex items-baseline justify-between px-4 pb-1 pt-3">
                <h2 className="text-[13px] font-medium text-foreground">
                    {routes.length > 0 ? plural(routes.length, 'itinéraire') : 'Aucun itinéraire'}
                </h2>
                <span className="text-xs text-muted-foreground tnum">Départ dès {formatTime(departureTime)}</span>
            </header>

            {warnings.length > 0 && (
                <div className="space-y-2 px-3 pb-2 pt-1">
                    {warnings.map(warning => (
                        <Notice key={warning} tone={routes.length === 0 ? 'info' : 'warning'}>
                            {warning}
                        </Notice>
                    ))}
                </div>
            )}

            <ol className="space-y-0.5 px-1.5">
                {routes.map((route, index) => (
                    <li key={`${state.id}-${index}`}>
                        <RouteRow
                            index={index}
                            route={route}
                            tags={tags[index]}
                            selected={index === selectedIndex}
                            leavesIn={relativeTimes ? minutesUntil(route.departureTime, now) : null}
                            onOpen={() => onOpen(index)}
                            onPreview={active => onPreview(active ? index : null)}
                        />
                    </li>
                ))}
            </ol>
        </section>
    );
}

function ResultsSkeleton() {
    return (
        <div className="space-y-1 px-1.5 py-3" aria-busy="true" aria-label="Recherche des itinéraires">
            <div className="skeleton mx-2.5 mb-3 h-3.5 w-24" />
            {[0, 1, 2].map(i => (
                <div key={i} className="space-y-2.5 rounded-xl px-3 py-3">
                    <div className="flex justify-between">
                        <div className="skeleton h-4 w-28" />
                        <div className="skeleton h-4 w-12" />
                    </div>
                    <div className="flex gap-1.5">
                        <div className="skeleton h-5 w-7" />
                        <div className="skeleton h-5 w-7" />
                    </div>
                    <div className="skeleton h-3 w-44" />
                </div>
            ))}
        </div>
    );
}
