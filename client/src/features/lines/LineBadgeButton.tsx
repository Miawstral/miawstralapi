import { LineBadge } from '@/components/common/LineBadge';
import { cn } from '@/lib/utils';

interface LineBadgeButtonProps {
    line: string;
    color?: string | null;
    textColor?: string | null;
    /** Full name of the line, for the tooltip. */
    lineName?: string;
    size?: 'sm' | 'md' | 'lg';
    /** Without it, a plain badge is rendered. */
    onSelect?: (lineId: string) => void;
    className?: string;
}

/** Line badge that opens the line (falls back to a plain badge without `onSelect`). */
export function LineBadgeButton({ line, color, textColor, lineName, size = 'sm', onSelect, className }: LineBadgeButtonProps) {
    const badge = <LineBadge line={line} color={color} textColor={textColor} size={size} />;
    if (!onSelect) {
        return (
            <span title={lineName} className={cn('inline-flex', className)}>
                {badge}
            </span>
        );
    }
    return (
        <button
            type="button"
            onClick={event => {
                event.stopPropagation();
                onSelect(line);
            }}
            title={lineName ? `Voir la ligne ${line} · ${lineName}` : `Voir la ligne ${line}`}
            aria-label={`Voir la ligne ${line}${lineName ? ` (${lineName})` : ''}`}
            className={cn(
                'inline-flex shrink-0 rounded-[6px] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_2px_6px_-1px_rgb(0_0_0/0.25)] active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                className,
            )}
        >
            {badge}
        </button>
    );
}
