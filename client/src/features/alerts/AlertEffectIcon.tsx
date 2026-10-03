import {
    Accessibility,
    Ban,
    CalendarClock,
    CirclePlus,
    Hourglass,
    Info,
    MapPinned,
    RouteOff,
    Signpost,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { effectInfo, type AlertEffectKind, type AlertTone } from './alertFormat';

const ICONS: Record<AlertEffectKind, LucideIcon> = {
    NO_SERVICE: Ban,
    REDUCED_SERVICE: RouteOff,
    SIGNIFICANT_DELAYS: Hourglass,
    DETOUR: Signpost,
    ADDITIONAL_SERVICE: CirclePlus,
    MODIFIED_SERVICE: CalendarClock,
    STOP_MOVED: MapPinned,
    ACCESSIBILITY_ISSUE: Accessibility,
    OTHER: Info,
};

const TONES: Record<AlertTone, string> = {
    danger: 'bg-danger/10 text-danger',
    warning: 'bg-warning/10 text-warning',
    info: 'bg-muted text-muted-foreground',
};

/** Tinted square with the icon of the alert's effect (detour, interruption…). */
export function AlertEffectIcon({ effect, size = 'md', className }: { effect: string | null; size?: 'sm' | 'md'; className?: string }) {
    const { kind, label, tone } = effectInfo(effect);
    const Icon = ICONS[kind];
    return (
        <span
            role="img"
            aria-label={label}
            title={label}
            className={cn(
                'inline-flex shrink-0 items-center justify-center',
                size === 'sm' ? 'h-6 w-6 rounded-md' : 'h-8 w-8 rounded-lg',
                TONES[tone],
                className,
            )}
        >
            <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
        </span>
    );
}
