import { cn } from '../lib/utils';

/** Miawstral logo (same as the app): a dotted path from an origin to a destination. */
export function BrandMark({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('h-8 w-8', className)}>
            <rect width="32" height="32" rx="8" className="fill-primary" />
            <path
                d="M10.5 21.5c0-5.5 11-5 11-11"
                fill="none"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeDasharray="0.1 4.2"
                className="stroke-primary-foreground"
            />
            <circle cx="10.5" cy="21.5" r="3.2" className="fill-primary-foreground" />
            <rect x="18.3" y="7.3" width="6.4" height="6.4" rx="1.6" strokeWidth="2.2" className="fill-primary stroke-primary-foreground" />
        </svg>
    );
}
