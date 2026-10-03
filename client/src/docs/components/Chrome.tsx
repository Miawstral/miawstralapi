import { ArrowUpRight, FileJson, Menu, Search, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useModel } from '../lib/context';
import { BrandMark } from './BrandMark';
import { Kbd } from './primitives';
import { Sidebar } from './Sidebar';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function TopBar({ onSearch, onMenu, menuOpen }: { onSearch: () => void; onMenu: () => void; menuOpen: boolean }) {
    const { spec } = useModel();
    return (
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
            <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-5">
                <button
                    type="button"
                    onClick={onMenu}
                    aria-label="Ouvrir le sommaire"
                    aria-expanded={menuOpen}
                    aria-controls="docs-drawer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
                >
                    <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
                <div className="flex min-w-0 items-center gap-2.5 lg:w-[calc(17rem-1.25rem)] lg:shrink-0">
                    <a href="#introduction" className="flex min-w-0 items-center gap-2.5 rounded-lg pr-1" aria-label={`${spec.info.title}, retour en haut`}>
                        <BrandMark className="h-7 w-7 shrink-0" />
                        <span className="flex items-baseline gap-1.5 truncate">
                            <span className="text-[15px] font-semibold tracking-tight text-foreground">Miawstral</span>
                            <span className="text-[15px] font-medium text-muted-foreground">API</span>
                        </span>
                    </a>
                    <span className="hidden h-5 items-center rounded-md border bg-subtle px-1.5 font-mono text-[11px] font-medium text-muted-foreground sm:inline-flex">
                        v{spec.info.version}
                    </span>
                </div>
                <div className="flex flex-1 justify-end lg:justify-start">
                    <button
                        type="button"
                        onClick={onSearch}
                        aria-label="Rechercher (Ctrl K)"
                        className="group inline-flex h-9 items-center gap-2.5 rounded-lg text-sm text-muted-foreground transition-colors max-md:w-9 max-md:justify-center max-md:hover:bg-muted md:w-72 md:border md:bg-subtle md:pl-3 md:pr-1.5 md:shadow-[inset_0_1px_0_hsl(var(--surface))] md:hover:border-input md:hover:text-foreground"
                    >
                        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="hidden flex-1 text-left md:inline">Rechercher…</span>
                        <span className="hidden items-center gap-0.5 md:inline-flex" aria-hidden="true">
                            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
                            <Kbd>K</Kbd>
                        </span>
                    </button>
                </div>

                <a
                    href="/api/openapi.json"
                    className="hidden h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
                >
                    <FileJson className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden xl:inline">OpenAPI</span>
                </a>
                <a
                    href="/"
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.98]"
                >
                    <span className="hidden sm:inline">Ouvrir l’app</span>
                    <span className="sm:hidden">App</span>
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
            </div>
        </header>
    );
}

/** Mobile table of contents. */
export function Drawer({ active, onClose }: { active: string | null; onClose: () => void }) {
    const panel = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        panel.current?.querySelector<HTMLElement>('button, a')?.focus();
        const overflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.documentElement.style.overflow = overflow;
            previous?.focus?.();
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px] motion-safe:animate-fade-in" onClick={onClose} aria-hidden="true" />
            <div
                ref={panel}
                id="docs-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Sommaire"
                data-scroll
                className="scrollbar-thin absolute inset-y-0 left-0 w-[86vw] max-w-[20rem] overflow-y-auto bg-background shadow-panel motion-safe:animate-slide-in"
            >
                <div className="sticky top-0 z-10 flex h-14 items-center gap-2.5 border-b bg-background/90 px-4 backdrop-blur">
                    <BrandMark className="h-7 w-7" />
                    <span className="flex-1 text-[15px] font-semibold">Sommaire</span>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fermer le sommaire"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>
                <Sidebar active={active} onNavigate={onClose} />
            </div>
        </div>
    );
}
