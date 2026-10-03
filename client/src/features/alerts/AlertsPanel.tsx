import { useId, useMemo } from 'react';
import { CircleCheck } from 'lucide-react';
import { Notice } from '@/components/common/Notice';
import { useNow } from '@/hooks/useNow';
import { plural } from '@/lib/format';
import type { ServiceAlert } from '@/types';
import { AlertCard } from './AlertCard';
import { splitAlerts } from './alertFormat';

interface AlertsPanelProps {
    alerts: ServiceAlert[] | null;
    loading: boolean;
    error: string | null;
    onSelectLine: (lineId: string) => void;
}

/** "Info trafic": ongoing and upcoming disruptions of the network. */
export function AlertsPanel({ alerts, loading, error, onSelectLine }: AlertsPanelProps) {
    const titleId = useId();
    const now = useNow(60_000);
    const split = useMemo(() => (alerts ? splitAlerts(alerts, now) : null), [alerts, now]);
    const total = split ? split.ongoing.length + split.upcoming.length : 0;

    const summary = split
        ? total === 0
            ? 'Trafic normal sur l’ensemble du réseau'
            : [
                  split.ongoing.length > 0 ? `${plural(split.ongoing.length, 'perturbation')} en cours` : 'Aucune perturbation en cours',
                  split.upcoming.length > 0 ? `${split.upcoming.length} à venir` : null,
              ]
                  .filter(Boolean)
                  .join(' · ')
        : loading
          ? 'Chargement des informations…'
          : null;

    return (
        <section aria-labelledby={titleId} aria-busy={loading && !alerts} className="pb-4">
            <header className="px-4 pb-3 pt-4">
                <h2 id={titleId} className="text-[17px] font-semibold tracking-tight">
                    Info trafic
                </h2>
                <p className="mt-0.5 h-5 text-[13px] text-muted-foreground">{summary}</p>
            </header>

            <div className="space-y-5 px-3">
                {error && (
                    <Notice tone={alerts ? 'warning' : 'error'} title={alerts ? 'Mise à jour impossible' : 'Info trafic indisponible'}>
                        {error}
                        {alerts ? ' Les informations affichées peuvent ne plus être à jour.' : ' Nouvel essai automatique dans quelques instants.'}
                    </Notice>
                )}

                {!split && loading && <AlertsSkeleton />}

                {split && total === 0 && !error && <AllClear />}

                {split && total > 0 && (
                    <>
                        <AlertSection title="En cours" alerts={split.ongoing} onSelectLine={onSelectLine} empty="Aucune perturbation en cours." />
                        {split.upcoming.length > 0 && <AlertSection title="À venir" alerts={split.upcoming} onSelectLine={onSelectLine} />}
                    </>
                )}
            </div>
        </section>
    );
}

function AlertSection({
    title,
    alerts,
    onSelectLine,
    empty,
}: {
    title: string;
    alerts: ServiceAlert[];
    onSelectLine: (lineId: string) => void;
    empty?: string;
}) {
    const id = useId();
    return (
        <section aria-labelledby={id}>
            <h3 id={id} className="mb-2 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
                {title}
                <span className="rounded-full bg-muted px-1.5 text-2xs font-semibold leading-4 text-foreground/80 tnum">{alerts.length}</span>
            </h3>
            {alerts.length === 0 ? (
                <p className="px-1 text-[13px] text-muted-foreground">{empty}</p>
            ) : (
                <ul className="space-y-2">
                    {alerts.map((alert, index) => (
                        <li key={alert.id} className="motion-safe:animate-rise-in" style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
                            <AlertCard alert={alert} onSelectLine={onSelectLine} />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function AllClear() {
    return (
        <div className="flex flex-col items-center px-6 py-10 text-center motion-safe:animate-fade-in">
            <div aria-hidden="true" className="relative flex h-16 w-16 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-emerald-500/[0.07]" />
                <span className="absolute inset-[9px] rounded-full bg-emerald-500/[0.12]" />
                <CircleCheck className="relative h-7 w-7 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
            </div>
            <p className="mt-4 text-sm font-semibold">Aucune perturbation signalée</p>
            <p className="mt-1 max-w-[17rem] text-[13px] leading-relaxed text-muted-foreground">
                Le réseau Mistral circule normalement. Ces informations sont actualisées toutes les 2&nbsp;minutes.
            </p>
        </div>
    );
}

function AlertsSkeleton() {
    return (
        <ul className="space-y-2" aria-label="Chargement de l’info trafic">
            {[0, 1, 2].map(i => (
                <li key={i} className="flex gap-3 rounded-xl bg-surface p-3.5 shadow-control">
                    <span className="skeleton h-8 w-8 shrink-0 rounded-lg" />
                    <span className="flex-1 space-y-2 pt-0.5">
                        <span className="skeleton block h-4 w-4/5" />
                        <span className="skeleton block h-3 w-2/5" />
                        <span className="flex gap-1 pt-1">
                            <span className="skeleton block h-5 w-6" />
                            <span className="skeleton block h-5 w-6" />
                        </span>
                    </span>
                </li>
            ))}
        </ul>
    );
}
