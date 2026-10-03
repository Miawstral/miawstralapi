import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ESTIMATED_EXPLANATION =
    'Les horaires de ce sens de circulation ne sont pas publiés : ils ont été déduits du sens inverse. Vérifiez-les avant de partir.';

/** Discreet marker for times that were mirrored from the opposite direction. */
export function EstimatedBadge({ compact = false, className }: { compact?: boolean; className?: string }) {
    return (
        <span
            title={ESTIMATED_EXPLANATION}
            className={cn('inline-flex shrink-0 cursor-help items-center gap-1 text-2xs font-medium text-warning', className)}
        >
            <CircleAlert className="h-3 w-3" aria-hidden="true" />
            {compact ? <span className="sr-only">horaire estimé</span> : 'Estimé'}
            {!compact && <span className="sr-only"> : {ESTIMATED_EXPLANATION}</span>}
        </span>
    );
}
