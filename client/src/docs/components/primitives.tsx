import { Check, Copy, Gauge, Lock, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCopy } from '../hooks/useCopy';
import type { Badge as BadgeSpec } from '../lib/spec';
import { cn } from '../lib/utils';

const METHOD_STYLES: Record<string, { light: string; dark: string }> = {
    get: {
        light: 'bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20',
        dark: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25',
    },
    post: {
        light: 'bg-blue-500/10 text-blue-700 ring-blue-600/20 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20',
        dark: 'bg-blue-400/10 text-blue-300 ring-blue-400/25',
    },
    put: {
        light: 'bg-amber-500/10 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20',
        dark: 'bg-amber-400/10 text-amber-300 ring-amber-400/25',
    },
    patch: {
        light: 'bg-amber-500/10 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20',
        dark: 'bg-amber-400/10 text-amber-300 ring-amber-400/25',
    },
    delete: {
        light: 'bg-rose-500/10 text-rose-700 ring-rose-600/20 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20',
        dark: 'bg-rose-400/10 text-rose-300 ring-rose-400/25',
    },
};

/** "GET", "POST"… as a small colored pill. */
export function MethodPill({
    method,
    size = 'sm',
    onDark = false,
    className,
}: {
    method: string;
    size?: 'xs' | 'sm' | 'md';
    onDark?: boolean;
    className?: string;
}) {
    const style = METHOD_STYLES[method] ?? METHOD_STYLES.get;
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-md font-mono font-semibold uppercase tracking-wide ring-1 ring-inset',
                size === 'xs' && 'h-[18px] min-w-[38px] px-1 text-[9.5px]',
                size === 'sm' && 'h-5 min-w-[44px] px-1.5 text-[10.5px]',
                size === 'md' && 'h-6 min-w-[50px] px-2 text-xs',
                onDark ? style.dark : style.light,
                className,
            )}
        >
            {method === 'delete' ? 'DEL' : method.toUpperCase()}
        </span>
    );
}

const TONES: Record<BadgeSpec['tone'], { className: string; icon: ReactNode }> = {
    live: {
        className: 'bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-300 dark:ring-emerald-400/20',
        icon: <span className="live-dot h-1.5 w-1.5 text-emerald-500" aria-hidden="true" />,
    },
    limit: {
        className: 'bg-amber-500/10 text-amber-800 ring-amber-600/20 dark:text-amber-300 dark:ring-amber-400/20',
        icon: <Gauge className="h-3 w-3" aria-hidden="true" />,
    },
    cache: {
        className: 'bg-sky-500/10 text-sky-800 ring-sky-600/20 dark:text-sky-300 dark:ring-sky-400/20',
        icon: <Timer className="h-3 w-3" aria-hidden="true" />,
    },
    admin: {
        className: 'bg-rose-500/10 text-rose-700 ring-rose-600/20 dark:text-rose-300 dark:ring-rose-400/20',
        icon: <Lock className="h-3 w-3" aria-hidden="true" />,
    },
};

export function Chip({ badge }: { badge: BadgeSpec }) {
    const tone = TONES[badge.tone] ?? TONES.cache;
    return (
        <span
            className={cn(
                'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset',
                tone.className,
            )}
        >
            {tone.icon}
            {badge.label}
        </span>
    );
}

export function CopyButton({
    text,
    label = 'Copier',
    onDark = false,
    className,
    showLabel = false,
}: {
    text: string;
    label?: string;
    onDark?: boolean;
    className?: string;
    showLabel?: boolean;
}) {
    const { copied, copy } = useCopy();
    return (
        <button
            type="button"
            onClick={() => void copy(text)}
            aria-label={copied ? 'Copié' : label}
            title={copied ? 'Copié' : label}
            className={cn(
                'inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors',
                showLabel ? 'px-2' : 'w-7',
                onDark
                    ? 'text-zinc-400 hover:bg-white/10 hover:text-zinc-100'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                className,
            )}
        >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            {showLabel && <span>{copied ? 'Copié' : label}</span>}
            <span className="sr-only" aria-live="polite">
                {copied ? 'Copié dans le presse-papiers' : ''}
            </span>
        </button>
    );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <kbd
            className={cn(
                'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface px-1 font-sans text-[11px] font-medium text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]',
                className,
            )}
        >
            {children}
        </kbd>
    );
}

/** A path with its {parameters} highlighted. */
export function PathText({ path, className }: { path: string; className?: string }) {
    const parts = path.split(/(\{[^}]+\})/g);
    return (
        <span className={cn('font-mono', className)}>
            {parts.map((part, i) =>
                part.startsWith('{') ? (
                    <span key={i} className="text-brand">
                        {part}
                    </span>
                ) : (
                    <span key={i}>{part.replace(/\//g, '/​')}</span>
                ),
            )}
        </span>
    );
}

export function StatusPill({ status, className }: { status: string | number; className?: string }) {
    const code = String(status);
    const tone = code.startsWith('2')
        ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-300 dark:ring-emerald-400/25'
        : code.startsWith('3')
          ? 'bg-sky-500/10 text-sky-700 ring-sky-600/20 dark:text-sky-300 dark:ring-sky-400/25'
          : code.startsWith('4')
            ? 'bg-amber-500/10 text-amber-800 ring-amber-600/20 dark:text-amber-300 dark:ring-amber-400/25'
            : 'bg-rose-500/10 text-rose-700 ring-rose-600/20 dark:text-rose-300 dark:ring-rose-400/25';
    return (
        <span className={cn('inline-flex h-5 items-center rounded-md px-1.5 font-mono text-[11px] font-semibold ring-1 ring-inset', tone, className)}>
            {code}
        </span>
    );
}

/** Same as StatusPill, for the dark code panels. */
export function StatusDot({ status }: { status: string | number }) {
    const code = String(status);
    const color = code.startsWith('2') ? 'bg-emerald-400' : code.startsWith('3') ? 'bg-sky-400' : code.startsWith('4') ? 'bg-amber-400' : 'bg-rose-400';
    return <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', color)} aria-hidden="true" />;
}
