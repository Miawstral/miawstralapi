import { memo, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Search, TriangleAlert, X } from 'lucide-react';
import { LineBadge } from '@/components/common/LineBadge';
import { ModeIcon } from '@/components/common/ModeIcon';
import { LiveDot } from '@/components/common/RealtimeBadge';
import { useNow } from '@/hooks/useNow';
import { cn } from '@/lib/utils';
import type { LineSummary, ServiceAlert, Vehicle } from '@/types';
import { alertsByLine } from '@/features/alerts/alertFormat';
import { countVehiclesByLine, groupLines, isSchoolLine, lineTermini, searchLines, type LineGroup } from './lineUtils';
import { scrollParent } from './scroll';

interface LineListProps {
    lines: LineSummary[];
    loading: boolean;
    query: string;
    onQueryChange: (query: string) => void;
    /** `scrollTop`: offset of the panel's scroll area when the line was chosen. */
    onSelectLine: (lineId: string, scrollTop: number) => void;
    alerts: ServiceAlert[];
    vehicles: Vehicle[] | null;
    /** Where to come back to after visiting a line. */
    restore?: { scrollTop: number; lineId: string } | null;
}

/** All the lines of the network, grouped by mode, with a search field. */
export function LineList({ lines, loading, query, onQueryChange, onSelectLine, alerts, vehicles, restore }: LineListProps) {
    const titleId = useId();
    const rootRef = useRef<HTMLElement>(null);
    const now = useNow(60_000);
    const [schoolOpen, setSchoolOpen] = useState(() => Boolean(restore && lines.some(l => l.bus_id === restore.lineId && isSchoolLine(l))));

    // Back from a line: same scroll offset, focus on its row.
    useLayoutEffect(() => {
        if (!restore) return;
        const parent = scrollParent(rootRef.current);
        if (parent) parent.scrollTop = restore.scrollTop;
        const active = document.activeElement;
        if (!active || active === document.body || !active.isConnected) {
            rootRef.current?.querySelector<HTMLElement>(`[data-line-id="${CSS.escape(restore.lineId)}"]`)?.focus({ preventScroll: true });
        }
        // Mount only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const select = (lineId: string) => onSelectLine(lineId, scrollParent(rootRef.current)?.scrollTop ?? 0);

    const groups = useMemo(() => groupLines(lines), [lines]);
    const results = useMemo(() => (query.trim() ? searchLines(lines, query) : null), [lines, query]);
    const running = useMemo(() => (vehicles ? countVehiclesByLine(vehicles) : null), [vehicles]);
    const disrupted = useMemo(() => {
        const byLine = alertsByLine(alerts, now);
        return new Map([...byLine].map(([id, list]) => [id, list.filter(a => a.status === 'ongoing').length]));
    }, [alerts, now]);

    const rowProps = (line: LineSummary) => ({
        line,
        running: running ? (running.get(line.bus_id) ?? 0) : null,
        alertCount: disrupted.get(line.bus_id) ?? 0,
        onSelect: select,
    });

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && results?.[0]) {
            event.preventDefault();
            select(results[0].bus_id);
        } else if (event.key === 'Escape' && query) {
            event.preventDefault();
            onQueryChange('');
        }
    };

    const liveTotal = running ? [...running.values()].reduce((a, b) => a + b, 0) : null;

    return (
        <section ref={rootRef} aria-labelledby={titleId} className="pb-4">
            <header className="px-4 pb-3 pt-4">
                <h2 id={titleId} className="text-[17px] font-semibold tracking-tight">
                    Lignes
                </h2>
                <p className="mt-0.5 flex h-5 items-center gap-1.5 text-[13px] text-muted-foreground">
                    {loading && lines.length === 0 ? (
                        'Chargement du réseau…'
                    ) : (
                        <>
                            {lines.length} lignes
                            {liveTotal !== null && liveTotal > 0 && (
                                <>
                                    <span aria-hidden="true">·</span>
                                    <LiveDot />
                                    <span className="tnum">{liveTotal} véhicules en service</span>
                                </>
                            )}
                        </>
                    )}
                </p>
                <div className="relative mt-3">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input
                        type="search"
                        value={query}
                        onChange={event => onQueryChange(event.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Numéro, terminus, quartier…"
                        aria-label="Rechercher une ligne"
                        autoComplete="off"
                        spellCheck={false}
                        className="h-10 w-full rounded-lg bg-surface pl-9 pr-9 text-sm shadow-control outline-none transition-shadow placeholder:text-muted-foreground focus:shadow-[0_0_0_1px_hsl(var(--foreground)/0.35),0_1px_2px_rgb(0_0_0/0.06)] [&::-webkit-search-cancel-button]:hidden"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => onQueryChange('')}
                            aria-label="Effacer la recherche"
                            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                    )}
                </div>
            </header>

            {loading && lines.length === 0 ? (
                <ListSkeleton />
            ) : results ? (
                <div className="px-2" aria-live="polite">
                    {results.length === 0 ? (
                        <p className="px-2 py-8 text-center text-[13px] text-muted-foreground">
                            Aucune ligne ne correspond à « {query.trim()} ».
                        </p>
                    ) : (
                        <>
                            <p className="sr-only">{results.length} résultats</p>
                            <ul>
                                {results.map(line => (
                                    <LineRow key={line.bus_id} {...rowProps(line)} showMode />
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            ) : (
                <div className="space-y-4 px-2">
                    {groups.map(group =>
                        group.id === 'school' ? (
                            <CollapsibleGroup key={group.id} group={group} open={schoolOpen} onToggle={() => setSchoolOpen(o => !o)}>
                                {group.lines.map(line => (
                                    <LineRow key={line.bus_id} {...rowProps(line)} />
                                ))}
                            </CollapsibleGroup>
                        ) : (
                            <LineGroupSection key={group.id} group={group}>
                                {group.lines.map(line => (
                                    <LineRow key={line.bus_id} {...rowProps(line)} />
                                ))}
                            </LineGroupSection>
                        ),
                    )}
                </div>
            )}
        </section>
    );
}

function LineGroupSection({ group, children }: { group: LineGroup; children: ReactNode }) {
    const id = useId();
    return (
        <section aria-labelledby={id}>
            <h3 id={id} className="flex items-center gap-1.5 px-2 pb-1 text-xs font-medium text-muted-foreground">
                {group.id !== 'school' && <ModeIcon mode={group.id} className="h-3.5 w-3.5" />}
                {group.label}
                <span className="tnum text-muted-foreground/70">{group.lines.length}</span>
            </h3>
            <ul>{children}</ul>
        </section>
    );
}

function CollapsibleGroup({ group, open, onToggle, children }: { group: LineGroup; open: boolean; onToggle: () => void; children: ReactNode }) {
    const id = useId();
    return (
        <section>
            <h3>
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={id}
                    onClick={onToggle}
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground"
                >
                    {group.label}
                    <span className="tnum text-muted-foreground/70">{group.lines.length}</span>
                    <ChevronDown className={cn('ml-auto h-3.5 w-3.5 transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden="true" />
                </button>
            </h3>
            <ul id={id} hidden={!open} className="mt-1">
                {children}
            </ul>
        </section>
    );
}

const LineRow = memo(function LineRow({
    line,
    running,
    alertCount,
    onSelect,
    showMode = false,
}: {
    line: LineSummary;
    /** Vehicles in service, null while the positions are loading. */
    running: number | null;
    /** Ongoing alerts. */
    alertCount: number;
    onSelect: (lineId: string) => void;
    showMode?: boolean;
}) {
    const termini = lineTermini(line);
    return (
        <li>
            <button
                type="button"
                onClick={() => onSelect(line.bus_id)}
                data-line-id={line.bus_id}
                title={line.lineName}
                className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-subtle focus-visible:bg-subtle"
            >
                <span className="flex w-11 shrink-0">
                    <LineBadge line={line.bus_id} color={line.color} textColor={line.textColor} size="lg" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium leading-5">
                        {showMode && line.mode !== 'bus' && <ModeIcon mode={line.mode} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                        {termini ? (
                            <span className="truncate">
                                {termini[0]}
                                <span className="mx-1 text-muted-foreground" aria-hidden="true">
                                    ↔
                                </span>
                                <span className="sr-only"> – </span>
                                {termini[1]}
                            </span>
                        ) : (
                            <span className="truncate">{line.lineName}</span>
                        )}
                    </span>
                    <span className="mt-0.5 flex h-4 items-center gap-2 text-xs text-muted-foreground">
                        {running === null ? (
                            <span className="skeleton h-3 w-16" />
                        ) : running > 0 ? (
                            <span className="inline-flex items-center gap-1.5 text-foreground/75">
                                <LiveDot />
                                <span className="tnum">{running} en service</span>
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5">
                                <span aria-hidden="true" className="h-2 w-2 rounded-full border border-muted-foreground/50" />
                                Aucun véhicule en ligne
                            </span>
                        )}
                        {alertCount > 0 && (
                            <span className="inline-flex items-center gap-1 font-medium text-warning">
                                <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                                {alertCount > 1 ? `${alertCount} perturbations` : 'Perturbée'}
                            </span>
                        )}
                    </span>
                </span>
                <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden="true"
                />
            </button>
        </li>
    );
});

function ListSkeleton() {
    return (
        <ul className="px-2" aria-label="Chargement des lignes">
            {Array.from({ length: 8 }, (_, i) => (
                <li key={i} className="flex items-center gap-3 px-2 py-2">
                    <span className="flex w-11 shrink-0">
                        <span className="skeleton h-8 w-10 rounded-[5px]" />
                    </span>
                    <span className="flex-1 space-y-1.5">
                        <span className="skeleton block h-4" style={{ width: `${55 + ((i * 29) % 35)}%` }} />
                        <span className="skeleton block h-3 w-20" />
                    </span>
                </li>
            ))}
        </ul>
    );
}
