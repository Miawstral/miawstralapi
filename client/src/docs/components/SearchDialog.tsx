import { Braces, CornerDownLeft, FileText, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useModel } from '../lib/context';
import { plainText } from '../lib/markdown';
import { normalize, type HttpMethod } from '../lib/spec';
import { cn } from '../lib/utils';
import { Kbd, MethodPill } from './primitives';

interface Entry {
    id: string;
    group: 'Endpoints' | 'Guides' | 'Modèles';
    title: string;
    subtitle: string;
    method?: HttpMethod;
    /** Normalized text searched. */
    haystack: string;
    /** Normalized title, ranked first. */
    key: string;
}

const GROUPS: Entry['group'][] = ['Endpoints', 'Guides', 'Modèles'];

function score(entry: Entry, terms: string[]): number {
    let total = 0;
    for (const term of terms) {
        if (!entry.haystack.includes(term)) return -1;
        if (entry.key.startsWith(term)) total += 6;
        else if (entry.key.includes(term)) total += 4;
        else if (entry.subtitle.toLowerCase().includes(term)) total += 2;
        else total += 1;
    }
    return total;
}

/** ⌘K palette over the endpoints, guides and models. */
export function SearchDialog({ onClose }: { onClose: () => void }) {
    const { operations, guides, schemas } = useModel();
    const [query, setQuery] = useState('');
    const [index, setIndex] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const list = useRef<HTMLUListElement>(null);

    const entries = useMemo<Entry[]>(
        () => [
            ...operations.map(op => ({
                id: op.id,
                group: 'Endpoints' as const,
                title: op.summary,
                subtitle: op.path,
                method: op.method,
                key: normalize(op.summary),
                haystack: normalize(`${op.summary} ${op.method} ${op.path} ${op.tag} ${op.operationId} ${plainText(op.description).slice(0, 400)}`),
            })),
            ...guides.map(g => ({
                id: g.id,
                group: 'Guides' as const,
                title: g.title,
                subtitle: plainText(g.body).slice(0, 90),
                key: normalize(g.title),
                haystack: normalize(`${g.title} ${plainText(g.body)}`),
            })),
            ...schemas.map(s => ({
                id: s.id,
                group: 'Modèles' as const,
                title: s.name,
                subtitle: s.schema.description ?? 'Modèle',
                key: normalize(s.name),
                haystack: normalize(`${s.name} ${s.schema.description ?? ''} ${Object.keys(s.schema.properties ?? {}).join(' ')}`),
            })),
        ],
        [operations, guides, schemas],
    );

    const results = useMemo(() => {
        const terms = normalize(query).split(/\s+/).filter(Boolean);
        if (terms.length === 0) return entries.filter(e => e.group !== 'Modèles').slice(0, 24);
        return entries
            .map(entry => ({ entry, score: score(entry, terms) }))
            .filter(r => r.score >= 0)
            .sort((a, b) => GROUPS.indexOf(a.entry.group) - GROUPS.indexOf(b.entry.group) || b.score - a.score)
            .map(r => r.entry)
            .slice(0, 40);
    }, [entries, query]);

    const current = Math.min(index, Math.max(0, results.length - 1));

    useEffect(() => {
        input.current?.focus();
        const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const overflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.documentElement.style.overflow = overflow;
            previous?.focus?.();
        };
    }, []);

    useEffect(() => {
        list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [current, results]);

    const go = (entry: Entry | undefined) => {
        if (!entry) return;
        onClose();
        // After the dialog is gone (and the scroll lock released).
        requestAnimationFrame(() => {
            if (window.location.hash === `#${entry.id}`) document.getElementById(entry.id)?.scrollIntoView({ block: 'start' });
            else window.location.hash = entry.id;
        });
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setIndex(i => (Math.min(i, results.length - 1) + 1) % Math.max(1, results.length));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setIndex(i => (Math.min(i, results.length - 1) - 1 + results.length) % Math.max(1, results.length));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            go(results[current]);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
        } else if (event.key === 'Tab') {
            // Focus stays in the dialog.
            event.preventDefault();
            input.current?.focus();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh] sm:pt-[14vh]" onKeyDown={onKeyDown}>
            <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px] motion-safe:animate-fade-in" onClick={onClose} aria-hidden="true" />
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Rechercher dans la documentation"
                className="relative flex max-h-[min(34rem,78vh)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-surface shadow-pop motion-safe:animate-rise-in"
            >
                <div className="flex items-center gap-3 border-b px-4">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <input
                        ref={input}
                        value={query}
                        onChange={e => {
                            setQuery(e.target.value);
                            setIndex(0);
                        }}
                        placeholder="Endpoint, modèle, paramètre…"
                        role="combobox"
                        aria-expanded="true"
                        aria-controls="search-results"
                        aria-activedescendant={results[current] ? `search-${results[current].id}` : undefined}
                        aria-autocomplete="list"
                        className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    <Kbd>Échap</Kbd>
                </div>
                <ul ref={list} id="search-results" role="listbox" aria-label="Résultats" className="scrollbar-thin flex-1 overflow-y-auto p-2">
                    {results.length === 0 && <li className="px-3 py-10 text-center text-sm text-muted-foreground">Aucun résultat pour « {query} ».</li>}
                    {results.map((entry, i) => {
                        const header = i === 0 || results[i - 1].group !== entry.group ? entry.group : null;
                        const selected = i === current;
                        return (
                            <li key={entry.id} role="presentation">
                                {header && (
                                    <p role="presentation" className="px-3 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground first:pt-1">
                                        {header}
                                    </p>
                                )}
                                <div
                                    id={`search-${entry.id}`}
                                    role="option"
                                    aria-selected={selected}
                                    onMouseMove={() => setIndex(i)}
                                    onClick={() => go(entry)}
                                    className={cn(
                                        'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2',
                                        selected ? 'bg-muted text-foreground' : 'text-foreground/90',
                                    )}
                                >
                                    {entry.method ? (
                                        <MethodPill method={entry.method} size="xs" />
                                    ) : entry.group === 'Guides' ? (
                                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                    ) : (
                                        <Braces className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                    )}
                                    <span className="min-w-0 flex-1">
                                        <span className={cn('block truncate text-sm font-medium', entry.group === 'Modèles' && 'font-mono')}>{entry.title}</span>
                                        <span className={cn('block truncate text-xs text-muted-foreground', entry.method && 'font-mono')}>{entry.subtitle}</span>
                                    </span>
                                    {selected && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                                </div>
                            </li>
                        );
                    })}
                </ul>
                <div className="flex items-center gap-4 border-t bg-subtle px-4 py-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                        <Kbd>↑</Kbd>
                        <Kbd>↓</Kbd> naviguer
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <Kbd>↵</Kbd> ouvrir
                    </span>
                    <span className="ml-auto">{results.length} résultat{results.length > 1 ? 's' : ''}</span>
                </div>
            </div>
        </div>
    );
}
