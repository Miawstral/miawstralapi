import { CircleAlert, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Drawer, TopBar } from './components/Chrome';
import { Guide } from './components/Guides';
import { Hero } from './components/Hero';
import { Models, TagSection } from './components/Reference';
import { SearchDialog } from './components/SearchDialog';
import { Sidebar } from './components/Sidebar';
import { useScrollSpy } from './hooks/useScrollSpy';
import { SAMPLE_LANGUAGES, type SampleLanguage } from './lib/codegen';
import { LanguageContext, ModelContext } from './lib/context';
import { buildModel, type DocsModel, type OpenApiSpec } from './lib/spec';
import { readStorage, writeStorage } from './lib/storage';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; model: DocsModel };

const LANGUAGE_KEY = 'miawstral-docs-language';

function initialLanguage(): SampleLanguage {
    const saved = readStorage(LANGUAGE_KEY);
    return SAMPLE_LANGUAGES.some(l => l.id === saved) ? (saved as SampleLanguage) : 'curl';
}

function Skeleton() {
    return (
        <div className="min-h-screen" aria-busy="true" aria-label="Chargement de la documentation">
            <div className="h-14 border-b" />
            <div className="mx-auto max-w-[76rem] space-y-6 px-4 pt-16 sm:px-6 lg:pl-[19rem]">
                <div className="h-7 w-56 animate-pulse rounded-full bg-muted" />
                <div className="h-12 w-full max-w-xl animate-pulse rounded-lg bg-muted" />
                <div className="h-24 w-full max-w-2xl animate-pulse rounded-lg bg-muted" />
            </div>
        </div>
    );
}

function Failure({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <main className="flex min-h-screen items-center justify-center px-4">
            <div className="max-w-md rounded-2xl bg-surface p-6 text-center shadow-panel">
                <CircleAlert className="mx-auto h-6 w-6 text-danger" aria-hidden="true" />
                <h1 className="mt-3 text-lg font-semibold">Documentation indisponible</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                    La spécification <code className="font-mono">/api/openapi.json</code> n’a pas pu être chargée ({message}).
                </p>
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" /> Réessayer
                </button>
            </div>
        </main>
    );
}

function Docs({ model }: { model: DocsModel }) {
    const [searchOpen, setSearchOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [language, setLanguageState] = useState<SampleLanguage>(initialLanguage);
    const setLanguage = useCallback((next: SampleLanguage) => {
        setLanguageState(next);
        writeStorage(LANGUAGE_KEY, next);
    }, []);
    const languageValue = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
    const closeMenu = useCallback(() => setMenuOpen(false), []);
    const closeSearch = useCallback(() => setSearchOpen(false), []);

    const ids = useMemo(
        () => [
            'introduction',
            ...model.guides.map(g => g.id),
            ...model.tags.flatMap(t => [t.id, ...t.operations.map(o => o.id)]),
            'modeles',
            ...model.schemas.map(s => s.id),
        ],
        [model],
    );
    const active = useScrollSpy(ids);

    // Deep link: once the page is rendered, go to the section of the URL.
    useEffect(() => {
        const id = decodeURIComponent(window.location.hash.slice(1));
        if (!id) return;
        const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' }));
        return () => cancelAnimationFrame(frame);
    }, []);

    // The URL follows the section being read (without adding history entries).
    useEffect(() => {
        if (!active) return;
        if (active === 'introduction') {
            if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
        } else if (window.location.hash !== `#${active}`) {
            history.replaceState(null, '', `#${active}`);
        }
    }, [active]);

    // ⌘K / Ctrl+K, or "/" outside of the fields.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
            if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                setSearchOpen(open => !open);
            } else if (event.key === '/' && !typing) {
                event.preventDefault();
                setSearchOpen(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const { info } = model.spec;
    return (
        <ModelContext.Provider value={model}>
            <LanguageContext.Provider value={languageValue}>
                <a
                    href="#contenu"
                    className="sr-only z-[60] rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
                >
                    Aller au contenu
                </a>
                <TopBar onSearch={() => setSearchOpen(true)} onMenu={() => setMenuOpen(true)} menuOpen={menuOpen} />
                <aside
                    data-scroll
                    className="scrollbar-thin fixed bottom-0 left-0 top-14 z-30 hidden w-[17rem] overflow-y-auto border-r bg-background lg:block"
                >
                    <Sidebar active={active} />
                </aside>
                {menuOpen && <Drawer active={active} onClose={closeMenu} />}
                {searchOpen && <SearchDialog onClose={closeSearch} />}

                <main id="contenu" tabIndex={-1} className="overflow-x-clip focus:outline-none lg:pl-[17rem]">
                    <div className="mx-auto max-w-[76rem] px-4 sm:px-6 lg:px-10">
                        <Hero />
                        {model.guides.map((guide, i) => (
                            <Guide key={guide.id} guide={guide} index={i} />
                        ))}
                        {model.tags.map(tag => (
                            <TagSection key={tag.id} tag={tag} />
                        ))}
                        <Models />
                        <footer className="flex flex-col gap-2 border-t py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                            <p>
                                {info.title} {info.version}
                                {info.license && <> · Code sous licence {info.license.name}</>}
                            </p>
                            <p>
                                Page générée depuis{' '}
                                <a href="/api/openapi.json" className="font-medium text-foreground underline-offset-4 hover:underline">
                                    /api/openapi.json
                                </a>{' '}
                                (OpenAPI {model.spec.openapi})
                            </p>
                        </footer>
                    </div>
                </main>
            </LanguageContext.Provider>
        </ModelContext.Provider>
    );
}

export function DocsApp() {
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState<LoadState>({ status: 'loading' });

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/openapi.json', { signal: controller.signal, headers: { Accept: 'application/json' } })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json() as Promise<OpenApiSpec>;
            })
            .then(
                spec => setState({ status: 'ready', model: buildModel(spec) }),
                (error: unknown) => {
                    if (controller.signal.aborted) return;
                    setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
                },
            );
        return () => controller.abort();
    }, [attempt]);

    if (state.status === 'loading') return <Skeleton />;
    if (state.status === 'error')
        return (
            <Failure
                message={state.message}
                onRetry={() => {
                    setState({ status: 'loading' });
                    setAttempt(a => a + 1);
                }}
            />
        );
    return <Docs model={state.model} />;
}
