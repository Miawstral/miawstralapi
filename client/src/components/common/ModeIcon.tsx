import { BusFront, CableCar, Ship, TrainFront, TramFront } from 'lucide-react';
import { MODE_LABELS } from '@/lib/modes';
import type { TransitMode } from '@/types';

const ICONS = { bus: BusFront, boat: Ship, cable: CableCar, tram: TramFront, rail: TrainFront };

export function ModeIcon({ mode, className }: { mode: TransitMode; className?: string }) {
    const Icon = ICONS[mode] ?? BusFront;
    return <Icon className={className} aria-label={MODE_LABELS[mode]} />;
}
