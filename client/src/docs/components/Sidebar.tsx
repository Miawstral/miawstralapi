import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useModel } from '../lib/context';
import { cn } from '../lib/utils';
import { MethodPill } from './primitives';

function NavLink({
    href,
    active,
    children,
    onNavigate,
    className,
}: {
    href: string;
    active: boolean;
    children: ReactNode;
    onNavigate?: () => void;
    className?: string;
}) {
    return (
        <a
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'location' : undefined}
            data-active={active || undefined}
            className={cn(
                'relative flex min-h-8 items-center gap-2.5 rounded-lg px-2.5 py-1 text-[13.5px] transition-colors',
                active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                className,
            )}
        >
            {active && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[2px] rounded-full bg-foreground" aria-hidden="true" />}
            {children}
        </a>
    );
}

function GroupTitle({ children, href }: { children: ReactNode; href?: string }) {
    const className = 'mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/70';
    return href ? (
        <a href={href} className={cn(className, 'block hover:text-foreground')}>
            {children}
        </a>
    ) : (
        <p className={className}>{children}</p>
    );
}

/** Table of contents: introduction, endpoints by tag, models. */
export function Sidebar({ active, onNavigate }: { active: string | null; onNavigate?: () => void }) {
    const { guides, tags, schemas } = useModel();
    const activeSchema = schemas.some(s => s.id === active);
    const [modelsOpen, setModelsOpen] = useState(false);
    const showModels = modelsOpen || activeSchema;
    const container = useRef<HTMLElement>(null);

    // Keeps the current entry visible in the sidebar.
    useEffect(() => {
        const element = container.current?.querySelector<HTMLElement>('[data-active]');
        if (!element) return;
        const box = element.getBoundingClientRect();
        const parent = container.current!.closest('[data-scroll]')?.getBoundingClientRect();
        if (parent && (box.top < parent.top + 40 || box.bottom > parent.bottom - 40)) element.scrollIntoView({ block: 'center' });
    }, [active]);

    return (
        <nav ref={container} aria-label="Sommaire de la documentation" className="space-y-7 pb-10 pl-3 pr-2 pt-6 text-sm">
            <div>
                <GroupTitle>Introduction</GroupTitle>
                <ul className="space-y-px">
                    <li>
                        <NavLink href="#introduction" active={active === 'introduction' || active === null} onNavigate={onNavigate}>
                            Présentation
                        </NavLink>
                    </li>
                    {guides.map(guide => (
                        <li key={guide.id}>
                            <NavLink href={`#${guide.id}`} active={active === guide.id} onNavigate={onNavigate}>
                                {guide.title}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </div>
            {tags.map(tag => (
                <div key={tag.id}>
                    <GroupTitle href={`#${tag.id}`}>{tag.name}</GroupTitle>
                    <ul className="space-y-px">
                        {tag.operations.map(op => (
                            <li key={op.id}>
                                <NavLink href={`#${op.id}`} active={active === op.id} onNavigate={onNavigate}>
                                    <MethodPill method={op.method} size="xs" />
                                    <span className="min-w-0 flex-1 truncate">{op.summary}</span>
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
            <div>
                <button
                    type="button"
                    aria-expanded={showModels}
                    onClick={() => setModelsOpen(o => !o)}
                    className="mb-1 flex w-full items-center gap-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/70 hover:text-foreground"
                >
                    Modèles
                    <span className="font-normal normal-case tracking-normal text-muted-foreground">{schemas.length}</span>
                    <ChevronRight className={cn('ml-auto h-3.5 w-3.5 transition-transform', showModels && 'rotate-90')} aria-hidden="true" />
                </button>
                {showModels && (
                    <ul className="space-y-px">
                        {schemas.map(s => (
                            <li key={s.id}>
                                <NavLink href={`#${s.id}`} active={active === s.id} onNavigate={onNavigate} className="font-mono text-[12.5px]">
                                    {s.name}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </nav>
    );
}
