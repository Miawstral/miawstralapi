import { delayTone, formatDelay } from '@/lib/realtime';
import { cn } from '@/lib/utils';

const tones = {
    ontime: 'text-emerald-600 dark:text-emerald-400',
    early: 'text-sky-600 dark:text-sky-400',
    late: 'text-amber-600 dark:text-amber-400',
    verylate: 'text-red-600 dark:text-red-400',
};

/** Pulsing dot: this information is live. */
export function LiveDot({ className }: { className?: string }) {
    return (
        <span className={cn('relative inline-flex h-2 w-2 shrink-0', className)} aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
    );
}

/** "+3 min" in the color of the delay. */
export function DelayBadge({ delay, className }: { delay: number; className?: string }) {
    return (
        <span className={cn('inline-flex items-center gap-1 text-2xs font-semibold tnum', tones[delayTone(delay)], className)}>
            {formatDelay(delay)}
        </span>
    );
}

/** Live indicator with the delay, e.g. for a departure or a ride. */
export function RealtimeBadge({ delay, className }: { delay: number; className?: string }) {
    return (
        <span className={cn('inline-flex items-center gap-1.5', className)} title="Information en temps réel">
            <LiveDot />
            <DelayBadge delay={delay} />
        </span>
    );
}
