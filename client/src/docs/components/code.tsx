import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { tokenize, type Language } from '../lib/highlight';
import { cn } from '../lib/utils';
import { CopyButton } from './primitives';

/** Highlighted source, as spans. */
export function Highlighted({ code, language }: { code: string; language: Language }) {
    return (
        <>
            {tokenize(code, language).map((token, i) =>
                token.type === 'plain' ? token.text : (
                    <span key={i} className={`tok-${token.type}`}>
                        {token.text}
                    </span>
                ),
            )}
        </>
    );
}

export function CodeLines({ code, language, className, wrap = false }: { code: string; language: Language; className?: string; wrap?: boolean }) {
    return (
        <pre
            className={cn(
                'code-scroll overflow-auto px-4 py-3.5 font-mono text-[12.5px] leading-[1.7]',
                wrap && 'whitespace-pre-wrap [overflow-wrap:anywhere]',
                className,
            )}
        >
            <code>
                <Highlighted code={code} language={language} />
            </code>
        </pre>
    );
}

/** A dark code panel: optional header, highlighted code, copy button. */
export function CodePanel({
    code,
    language,
    title,
    actions,
    className,
    codeClassName,
    wrap = true,
}: {
    code: string;
    language: Language;
    title?: ReactNode;
    actions?: ReactNode;
    className?: string;
    codeClassName?: string;
    wrap?: boolean;
}) {
    return (
        <div className={cn('code-panel overflow-hidden rounded-xl', className)}>
            {(title || actions) && (
                <div className="flex h-10 items-center gap-2 border-b border-[hsl(var(--code-border))] bg-[hsl(var(--code-header))] pl-4 pr-1.5">
                    <div className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-400">{title}</div>
                    {actions}
                    <CopyButton text={code} onDark label="Copier le code" />
                </div>
            )}
            <div className="relative">
                {!title && !actions && (
                    <CopyButton text={code} onDark label="Copier le code" className="absolute right-1.5 top-1.5 z-10 bg-[hsl(var(--code-bg))]" />
                )}
                <CodeLines code={code} language={language} className={codeClassName} wrap={wrap} />
            </div>
        </div>
    );
}

export interface TabItem<T extends string> {
    id: T;
    label: ReactNode;
}

/**
 * Accessible tabs (roving focus, arrow keys). The panel is rendered by the
 * caller with `panelProps`.
 */
export function Tabs<T extends string>({
    items,
    value,
    onChange,
    label,
    onDark = false,
    size = 'sm',
    className,
    idBase,
}: {
    items: TabItem<T>[];
    value: T;
    onChange: (value: T) => void;
    label: string;
    onDark?: boolean;
    size?: 'xs' | 'sm';
    className?: string;
    idBase: string;
}) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        let next = -1;
        if (event.key === 'ArrowRight') next = (index + 1) % items.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = items.length - 1;
        if (next < 0) return;
        event.preventDefault();
        onChange(items[next].id);
        refs.current[next]?.focus();
    };
    return (
        <div role="tablist" aria-label={label} className={cn('flex min-w-0 items-center gap-0.5 overflow-x-auto', className)}>
            {items.map((item, index) => {
                const selected = item.id === value;
                return (
                    <button
                        key={item.id}
                        ref={el => {
                            refs.current[index] = el;
                        }}
                        type="button"
                        role="tab"
                        id={`${idBase}-tab-${item.id}`}
                        aria-selected={selected}
                        aria-controls={`${idBase}-panel`}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(item.id)}
                        onKeyDown={event => onKeyDown(event, index)}
                        className={cn(
                            'relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors',
                            size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-6 px-2 text-[11px]',
                            onDark
                                ? selected
                                    ? 'bg-white/10 text-zinc-50'
                                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                                : selected
                                  ? 'bg-surface text-foreground shadow-control'
                                  : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}
