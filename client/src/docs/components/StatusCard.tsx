import { Activity, CircleAlert } from 'lucide-react';
import { fetchJson, usePolling } from '../hooks/usePolling';
import { useNow } from '../hooks/useNow';
import { formatAgo, formatNumber, formatServiceDate, formatShortDate, formatUptime } from '../lib/format';
import { cn } from '../lib/utils';

interface Health {
    status: 'ok' | 'degraded';
    uptime: number;
    data: { serviceDate: string; lines: number; stops: number; trips: number };
}

interface FeedStatus {
    fetchedAt: string | null;
    feedTimestamp: string | null;
    error: string | null;
}

interface DataStatus {
    source: { version: string | null; publisher: string | null; downloadedAt: string | null; validity: { from: string | null; to: string | null } };
    realtime: { enabled: boolean; vehicles: FeedStatus; tripUpdates: FeedStatus; alerts: FeedStatus };
}

interface Snapshot {
    health: Health;
    status: DataStatus;
    vehicles: number | null;
    /** Alerts in effect. */
    alerts: number | null;
}

/** Health, data status and vehicles in service; the vehicles request also wakes the real-time feeds up. */
async function loadSnapshot(signal: AbortSignal): Promise<Snapshot> {
    const [health, status, vehicles, alerts] = await Promise.all([
        fetchJson<Health>('/api/health', signal),
        fetchJson<{ data: DataStatus }>('/api/data/status', signal).then(r => r.data),
        fetchJson<{ count: number }>('/api/realtime/vehicles', signal).then(
            r => r.count,
            () => null,
        ),
        fetchJson<{ alerts: { active: boolean }[] }>('/api/realtime/alerts', signal).then(
            r => r.alerts.filter(a => a.active).length,
            () => null,
        ),
    ]);
    // The status read before the vehicles: read it again for fresh feed dates.
    const fresh = await fetchJson<{ data: DataStatus }>('/api/data/status', signal).then(
        r => r.data,
        () => status,
    );
    return { health, status: fresh, vehicles, alerts };
}

/** "2026-10-02 15:17:52.704803 UTC" → "2 oct. 2026, 17:17". */
function formatVersion(version: string | null): string | null {
    if (!version) return null;
    const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(version);
    if (!match) return version;
    const date = new Date(`${match[1]}T${match[2]}Z`);
    if (Number.isNaN(date.getTime())) return version;
    return date.toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function FeedRow({ label, feed, now, note }: { label: string; feed: FeedStatus; now: number; note?: string }) {
    const reference = feed.feedTimestamp ?? feed.fetchedAt;
    const age = reference ? (now - Date.parse(reference)) / 1000 : null;
    const tone = feed.error ? 'bg-rose-500' : age === null ? 'bg-zinc-400' : age < 180 ? 'bg-emerald-500' : age < 900 ? 'bg-amber-500' : 'bg-rose-500';
    const text = feed.error ? 'indisponible' : (formatAgo(reference, now) ?? 'en attente');
    return (
        <li className="flex items-center gap-2.5 py-1">
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone)} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {label}
                {note && <span className="text-muted-foreground/80"> · {note}</span>}
            </span>
            <span className="tnum shrink-0 font-medium text-foreground" title={feed.error ?? reference ?? undefined}>
                {text}
            </span>
        </li>
    );
}

function Stat({ label, value, live = false }: { label: string; value: string; live?: boolean }) {
    return (
        <div className="min-w-0 rounded-xl bg-subtle px-3 py-2.5">
            <dt className="flex items-center gap-1.5 truncate text-[11px] font-medium text-muted-foreground">
                {live && <span className="live-dot h-1.5 w-1.5 text-emerald-500" aria-hidden="true" />}
                {label}
            </dt>
            <dd className="tnum mt-0.5 text-lg font-semibold tracking-tight text-foreground">{value}</dd>
        </div>
    );
}

/** Live state of the service, of the timetables and of the real-time feeds. */
export function StatusCard() {
    const { data, error } = usePolling(loadSnapshot, 30_000);
    const now = useNow(1000);

    if (!data) {
        return (
            <div className="rounded-2xl bg-surface p-5 shadow-panel" aria-busy={!error}>
                {error ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CircleAlert className="h-4 w-4 text-danger" aria-hidden="true" /> État du service indisponible ({error}).
                    </p>
                ) : (
                    <div className="space-y-3" aria-label="Chargement de l’état du service">
                        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                        <div className="grid grid-cols-4 gap-2">
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
                            ))}
                        </div>
                        <div className="h-20 animate-pulse rounded-xl bg-muted" />
                    </div>
                )}
            </div>
        );
    }

    const { health, status, vehicles, alerts } = data;
    const ok = health.status === 'ok';
    const validity = status.source.validity;
    const version = formatVersion(status.source.version);

    return (
        <section aria-labelledby="status-title" className="overflow-hidden rounded-2xl bg-surface shadow-panel">
            <div className="flex items-center gap-3 border-b px-5 py-3.5">
                <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <h2 id="status-title" className="flex-1 text-sm font-semibold text-foreground">
                    État du service
                </h2>
                <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <span className="live-dot h-1.5 w-1.5 text-emerald-500" aria-hidden="true" />
                    En direct
                </span>
            </div>
            <div className="space-y-4 px-5 py-4">
                <div>
                    <p className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                        <span className={cn('h-2 w-2 rounded-full', ok ? 'bg-emerald-500' : 'bg-amber-500')} aria-hidden="true" />
                        {ok ? 'Opérationnel' : 'Service dégradé'}
                    </p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                        Journée de service du {formatServiceDate(health.data.serviceDate)} · en ligne depuis {formatUptime(health.uptime)}
                    </p>
                </div>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat label="Lignes" value={formatNumber(health.data.lines)} />
                    <Stat label="Arrêts" value={formatNumber(health.data.stops)} />
                    <Stat label="Courses" value={formatNumber(health.data.trips)} />
                    <Stat label="En service" value={vehicles === null ? '—' : formatNumber(vehicles)} live={vehicles !== null} />
                </dl>
                <dl className="divide-y rounded-xl border text-[13px]">
                    <div className="flex flex-col gap-1 px-3.5 py-2.5 sm:flex-row sm:items-start sm:gap-3">
                        <dt className="shrink-0 text-muted-foreground sm:w-24">Horaires</dt>
                        <dd className="min-w-0 flex-1 sm:text-right">
                            <span className="font-medium text-foreground">{version ?? 'version inconnue'}</span>
                            <span className="block text-muted-foreground">
                                {status.source.publisher ?? 'Réseau Mistral'}
                                {validity.from && validity.to && (
                                    <>
                                        {' '}
                                        · du {formatShortDate(validity.from)} au {formatShortDate(validity.to)}
                                    </>
                                )}
                            </span>
                        </dd>
                    </div>
                    <div className="flex flex-col gap-0.5 px-3.5 py-2 sm:flex-row sm:items-start sm:gap-3">
                        <dt className="shrink-0 pt-0.5 text-muted-foreground sm:w-24 sm:pt-1.5">Temps réel</dt>
                        <dd className="min-w-0 flex-1">
                            {status.realtime.enabled ? (
                                <ul>
                                    <FeedRow label="Positions" feed={status.realtime.vehicles} now={now} />
                                    <FeedRow label="Prévisions" feed={status.realtime.tripUpdates} now={now} />
                                    <FeedRow
                                        label="Perturbations"
                                        feed={status.realtime.alerts}
                                        now={now}
                                        note={alerts === null ? undefined : `${alerts} en cours`}
                                    />
                                </ul>
                            ) : (
                                <p className="py-1.5 text-muted-foreground sm:text-right">Désactivé sur ce serveur.</p>
                            )}
                        </dd>
                    </div>
                </dl>
            </div>
        </section>
    );
}
