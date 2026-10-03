import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Compass, CornerDownLeft, MapPin, Route, Search, Siren, Signpost } from 'lucide-react';
import { LineBadge } from '@/components/common/LineBadge';
import { ModeIcon } from '@/components/common/ModeIcon';
import { normalizeText, searchIndexedStops, type IndexedStop } from '@/lib/text';
import { cn } from '@/lib/utils';
import type { LineSummary, StopSummary } from '@/types';

export type PaletteAction = 'route' | 'departures' | 'lines' | 'explore' | 'alerts';

interface CommandPaletteProps {
    open: boolean;
    onClose: () => void;
    stopsIndex: IndexedStop[];
    lines: LineSummary[];
    onStop: (stop: StopSummary) => void;
    onLine: (lineId: string) => void;
    onAction: (action: PaletteAction) => void;
}

type Item =
    | { kind: 'action'; id: PaletteAction; label: string; hint: string; icon: ReactNode }
    | { kind: 'stop'; stop: StopSummary }
    | { kind: 'line'; line: LineSummary };

const ACTIONS: Extract<Item, { kind: 'action' }>[] = [
    { kind: 'action', id: 'route', label: 'Calculer un itinéraire', hint: 'Itinéraire', icon: <Route className="h-4 w-4" /> },
    { kind: 'action', id: 'departures', label: 'Prochains départs à un arrêt', hint: 'Départs', icon: <Signpost className="h-4 w-4" /> },
    { kind: 'action', id: 'lines', label: 'Toutes les lignes', hint: 'Lignes', icon: <MapPin className="h-4 w-4" /> },
    { kind: 'action', id: 'explore', label: 'Jusqu’où aller en 30 min ?', hint: 'Explorer', icon: <Compass className="h-4 w-4" /> },
    { kind: 'action', id: 'alerts', label: 'Infos trafic', hint: 'Perturbations', icon: <Siren className="h-4 w-4" /> },
];

/** ⌘K: jump to a stop, a line or a view. */
export function CommandPalette({ open, onClose, stopsIndex, lines, onStop, onLine, onAction }: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        const previous = document.activeElement as HTMLElement | null;
        inputRef.current?.focus();
        return () => previous?.focus?.();
    }, [open]);

    const items = useMemo<Item[]>(() => {
        const q = normalizeText(query);
        if (!q) return [...ACTIONS, ...lines.slice(0, 6).map(line => ({ kind: 'line' as const, line }))];
        const matchedLines = lines
            .filter(l => normalizeText(l.bus_id) === q || normalizeText(l.bus_id).startsWith(q) || normalizeText(l.lineName).includes(q))
            .slice(0, 5)
            .map(line => ({ kind: 'line' as const, line }));
        const stops = searchIndexedStops(stopsIndex, query, 7).map(stop => ({ kind: 'stop' as const, stop }));
        const actions = ACTIONS.filter(a => normalizeText(`${a.label} ${a.hint}`).includes(q));
        return [...matchedLines, ...stops, ...actions];
    }, [query, lines, stopsIndex]);

    if (!open) return null;

    const close = () => {
        setQuery('');
        setActive(0);
        onClose();
    };
    const choose = (item: Item) => {
        if (item.kind === 'action') onAction(item.id);
        else if (item.kind === 'stop') onStop(item.stop);
        else onLine(item.line.bus_id);
        close();
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-start justify-center bg-black/30 p-4 pt-[12vh] backdrop-blur-[2px] motion-safe:animate-fade-in" onMouseDown={close}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Recherche rapide"
                className="w-full max-w-lg overflow-hidden rounded-2xl bg-surface shadow-panel motion-safe:animate-rise-in"
                onMouseDown={event => event.stopPropagation()}
            >
                <div className="flex items-center gap-2.5 border-b px-4">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={event => {
                            setQuery(event.target.value);
                            setActive(0);
                        }}
                        onKeyDown={event => {
                            if (event.key === 'Escape') close();
                            else if (event.key === 'ArrowDown') {
                                event.preventDefault();
                                setActive(i => Math.min(items.length - 1, i + 1));
                            } else if (event.key === 'ArrowUp') {
                                event.preventDefault();
                                setActive(i => Math.max(0, i - 1));
                            } else if (event.key === 'Enter' && items[active]) {
                                event.preventDefault();
                                choose(items[active]);
                            }
                        }}
                        placeholder="Arrêt, ligne ou action…"
                        aria-label="Rechercher"
                        aria-controls="palette-results"
                        aria-activedescendant={items[active] ? `palette-item-${active}` : undefined}
                        className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
                    />
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">Échap</kbd>
                </div>
                <ul id="palette-results" role="listbox" className="scrollbar-thin max-h-[50vh] overflow-y-auto p-1.5">
                    {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Aucun résultat</li>}
                    {items.map((item, index) => (
                        <li
                            key={item.kind === 'stop' ? `s-${item.stop.stopPointId}` : item.kind === 'line' ? `l-${item.line.bus_id}` : `a-${item.id}`}
                            id={`palette-item-${index}`}
                            role="option"
                            aria-selected={index === active}
                            onMouseMove={() => setActive(index)}
                            onClick={() => choose(item)}
                            className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2', index === active && 'bg-muted')}
                        >
                            {item.kind === 'action' && (
                                <>
                                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">{item.icon}</span>
                                    <span className="flex-1 text-sm">{item.label}</span>
                                </>
                            )}
                            {item.kind === 'line' && (
                                <>
                                    <LineBadge line={item.line.bus_id} color={item.line.color} textColor={item.line.textColor} size="md" />
                                    <span className="min-w-0 flex-1 truncate text-sm">{item.line.lineName}</span>
                                    {item.line.mode !== 'bus' && <ModeIcon mode={item.line.mode} className="h-4 w-4 text-muted-foreground" />}
                                </>
                            )}
                            {item.kind === 'stop' && (
                                <>
                                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                        <MapPin className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm">{item.stop.name}</span>
                                        <span className="block truncate text-xs text-muted-foreground">{item.stop.city}</span>
                                    </span>
                                    <span className="text-2xs text-muted-foreground">Départs</span>
                                </>
                            )}
                            {index === active && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
