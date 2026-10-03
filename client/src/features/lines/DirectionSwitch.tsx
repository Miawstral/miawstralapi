import type { KeyboardEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Direction } from '@/types';

interface DirectionSwitchProps {
    directions: { direction: Direction; headsign: string }[];
    value: Direction;
    onChange: (direction: Direction) => void;
    className?: string;
}

/** "→ Le Brusc | → Seyne Centre": choice of the direction (radio group, arrow keys). */
export function DirectionSwitch({ directions, value, onChange, className }: DirectionSwitchProps) {
    if (directions.length < 2) {
        const only = directions[0];
        if (!only) return null;
        return (
            <div className={cn('flex h-9 items-center gap-1.5 rounded-lg bg-muted px-3 text-[13px]', className)}>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">Direction </span>
                <span className="truncate font-medium">{only.headsign}</span>
                <span className="ml-auto shrink-0 text-2xs text-muted-foreground">Sens unique</span>
            </div>
        );
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const next = (index + step + directions.length) % directions.length;
        onChange(directions[next].direction);
        const radios = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
        radios?.[next]?.focus();
    };

    return (
        <div role="radiogroup" aria-label="Sens de circulation" className={cn('grid grid-cols-2 gap-0.5 rounded-lg bg-muted p-0.5', className)}>
            {directions.map((d, index) => {
                const checked = d.direction === value;
                return (
                    <button
                        key={d.direction}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        tabIndex={checked ? 0 : -1}
                        title={`Direction ${d.headsign}`}
                        onClick={() => onChange(d.direction)}
                        onKeyDown={event => handleKeyDown(event, index)}
                        className={cn(
                            'flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2.5 text-left text-[13px] font-medium transition-colors',
                            checked ? 'bg-surface text-foreground shadow-control' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="sr-only">Direction </span>
                        <span className="truncate">{d.headsign}</span>
                    </button>
                );
            })}
        </div>
    );
}
