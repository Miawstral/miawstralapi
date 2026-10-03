import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PopoverProps {
    /** Renders the trigger; spread the props on a button. */
    trigger: (props: {
        'aria-expanded': boolean;
        'aria-controls': string;
        'aria-haspopup': 'dialog';
        onClick: () => void;
        ref: (element: HTMLButtonElement | null) => void;
    }) => ReactNode;
    children: ReactNode | ((close: () => void) => ReactNode);
    label: string;
    align?: 'start' | 'end';
    /** Span the nearest positioned ancestor instead of sizing to the content. */
    fullWidth?: boolean;
    className?: string;
}

/** Small anchored panel: closes on Escape and on outside clicks, returns the focus to its trigger. */
export function Popover({ trigger, children, label, align = 'start', fullWidth = false, className }: PopoverProps) {
    const id = useId();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [triggerElement, setTriggerElement] = useState<HTMLButtonElement | null>(null);

    const close = () => {
        setOpen(false);
        triggerElement?.focus();
    };

    useEffect(() => {
        if (!open) return;
        panelRef.current?.querySelector<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')?.focus();
        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                setOpen(false);
                triggerElement?.focus();
            }
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open, triggerElement]);

    return (
        <div ref={rootRef} className={fullWidth ? undefined : 'relative'}>
            {trigger({
                'aria-expanded': open,
                'aria-controls': id,
                'aria-haspopup': 'dialog',
                onClick: () => setOpen(o => !o),
                ref: setTriggerElement,
            })}
            {open && (
                <div
                    ref={panelRef}
                    id={id}
                    role="dialog"
                    aria-label={label}
                    className={cn(
                        'absolute top-full z-50 mt-1.5 rounded-xl bg-surface p-3 shadow-pop motion-safe:animate-rise-in',
                        fullWidth ? 'inset-x-0' : align === 'end' ? 'right-0' : 'left-0',
                        className,
                    )}
                >
                    {typeof children === 'function' ? children(close) : children}
                </div>
            )}
        </div>
    );
}
