import { lineColor, textColorOn } from '@/lib/colors';
import { cn } from '@/lib/utils';
import type { LineSummary } from '@/types';

interface LineBadgeProps {
    line: string;
    color?: string | null;
    /** Official text color (else computed for contrast). */
    textColor?: string | null;
    /** Accessible name, e.g. the line's full name. */
    title?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function LineBadge({ line, color, textColor, title, size = 'sm', className }: LineBadgeProps) {
    const background = lineColor(color);
    return (
        <span
            title={title}
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-[5px] font-semibold leading-none tracking-tight tnum shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.18)]',
                size === 'sm' ? 'h-5 min-w-[1.375rem] px-1 text-[11px]' : size === 'md' ? 'h-6 min-w-[1.75rem] px-1.5 text-xs' : 'h-8 min-w-[2.5rem] px-2 text-sm',
                className,
            )}
            style={{ backgroundColor: background, color: textColor ?? textColorOn(background) }}
        >
            <span className="sr-only">Ligne </span>
            {line}
        </span>
    );
}

interface LineBadgeListProps {
    lines: string[];
    linesById: ReadonlyMap<string, LineSummary>;
    /** Show at most this many badges, then "+N". */
    max?: number;
    className?: string;
}

export function LineBadgeList({ lines, linesById, max = 6, className }: LineBadgeListProps) {
    if (lines.length === 0) return null;
    const visible = lines.slice(0, max);
    const hidden = lines.length - visible.length;
    return (
        <span className={cn('flex flex-wrap items-center gap-1', className)}>
            {visible.map(id => {
                const line = linesById.get(id);
                return <LineBadge key={id} line={id} color={line?.color} textColor={line?.textColor} title={line?.lineName} />;
            })}
            {hidden > 0 && (
                <span className="text-2xs font-medium text-muted-foreground tnum">
                    +{hidden}
                    <span className="sr-only">{hidden > 1 ? ' autres lignes' : ' autre ligne'}</span>
                </span>
            )}
        </span>
    );
}
