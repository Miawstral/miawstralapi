import { cn } from '@/lib/utils';

interface SegmentedProps<T extends string | number> {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
    className?: string;
}

/** Row of mutually exclusive choices (radio group styled as a segmented control). */
export function Segmented<T extends string | number>({ label, value, options, onChange, className }: SegmentedProps<T>) {
    return (
        <div role="radiogroup" aria-label={label} className={cn('flex rounded-lg bg-muted p-0.5', className)}>
            {options.map(option => {
                const checked = option.value === value;
                return (
                    <button
                        key={String(option.value)}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            'h-7 flex-1 rounded-md px-2 text-[13px] font-medium transition-colors',
                            checked
                                ? 'bg-surface text-foreground shadow-control'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
