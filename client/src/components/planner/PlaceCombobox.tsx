import { useEffect, useId, useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode, type Ref } from 'react';
import { Accessibility, MapPin, X } from 'lucide-react';
import { LineBadgeList } from '@/components/common/LineBadge';
import { searchIndexedStops, type IndexedStop } from '@/lib/text';
import { stopPlace, type PlaceField, type PlaceSelection } from '@/lib/places';
import { cn } from '@/lib/utils';
import type { LineSummary, StopSummary } from '@/types';

/** Extra entry shown before the stops (e.g. "Ma position"). */
export interface ExtraOption {
    id: string;
    icon: ReactNode;
    label: string;
    description: string;
    onSelect: () => void;
}

interface PlaceComboboxProps {
    label: string;
    placeholder: string;
    field: PlaceField;
    onTextChange: (text: string) => void;
    onSelect: (place: PlaceSelection) => void;
    onFocus?: () => void;
    stopsIndex: IndexedStop[];
    stopsStatus: 'loading' | 'error' | 'ready';
    linesById: ReadonlyMap<string, LineSummary>;
    /** Shown when the field is focused and empty. */
    extraOptions?: ExtraOption[];
    inputRef?: Ref<HTMLInputElement>;
}

type Option = { kind: 'extra'; extra: ExtraOption } | { kind: 'stop'; entry: StopSummary };

export function PlaceCombobox({
    label,
    placeholder,
    field,
    onTextChange,
    onSelect,
    onFocus,
    stopsIndex,
    stopsStatus,
    linesById,
    extraOptions = [],
    inputRef,
}: PlaceComboboxProps) {
    const id = useId();
    const inputId = `${id}-input`;
    const listboxId = `${id}-listbox`;
    const optionId = (index: number) => `${id}-option-${index}`;

    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    const query = field.place ? '' : field.text;
    const options = useMemo<Option[]>(() => {
        if (!query.trim()) return extraOptions.map(extra => ({ kind: 'extra', extra }));
        return searchIndexedStops(stopsIndex, query, 7).map(entry => ({ kind: 'stop', entry }));
    }, [stopsIndex, query, extraOptions]);

    const showList = open && options.length > 0;
    const showStatus = open && query.trim().length > 0 && options.length === 0;
    const statusMessage =
        stopsStatus === 'loading'
            ? 'Chargement des arrêts…'
            : stopsStatus === 'error'
              ? 'La liste des arrêts est indisponible.'
              : 'Aucun arrêt ne correspond à cette recherche.';

    useEffect(() => {
        if (activeIndex >= 0) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, id]);

    const choose = (option: Option) => {
        if (option.kind === 'extra') option.extra.onSelect();
        else onSelect(stopPlace(option.entry));
        setOpen(false);
        setActiveIndex(-1);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                setOpen(true);
                if (options.length > 0) setActiveIndex(i => (i + 1) % options.length);
                break;
            case 'ArrowUp':
                event.preventDefault();
                if (options.length > 0) setActiveIndex(i => (i <= 0 ? options.length - 1 : i - 1));
                break;
            case 'Enter':
                if (showList) {
                    event.preventDefault();
                    choose(options[Math.max(0, activeIndex)]);
                }
                break;
            case 'Escape':
                if (open) {
                    event.preventDefault();
                    setOpen(false);
                    setActiveIndex(-1);
                }
                break;
        }
    };

    return (
        <div className="relative">
            <label htmlFor={inputId} className="sr-only">
                {label}
            </label>
            <input
                ref={inputRef}
                id={inputId}
                type="text"
                role="combobox"
                autoComplete="off"
                spellCheck={false}
                aria-autocomplete="list"
                aria-expanded={showList}
                aria-controls={listboxId}
                aria-activedescendant={showList && activeIndex >= 0 ? optionId(activeIndex) : undefined}
                placeholder={placeholder}
                value={field.text}
                onChange={event => {
                    onTextChange(event.target.value);
                    setOpen(true);
                    setActiveIndex(-1);
                }}
                onFocus={event => {
                    onFocus?.();
                    if (!field.place) setOpen(true);
                    else event.target.select();
                }}
                onClick={() => setOpen(true)}
                onBlur={() => {
                    setOpen(false);
                    setActiveIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                className="h-11 w-full bg-transparent pl-10 pr-9 text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            {field.text && (
                <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => {
                        onTextChange('');
                        setOpen(true);
                        document.getElementById(inputId)?.focus();
                    }}
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={`Effacer « ${label} »`}
                >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            )}

            <ul
                id={listboxId}
                role="listbox"
                aria-label={`Suggestions pour « ${label} »`}
                hidden={!showList}
                className="scrollbar-thin absolute inset-x-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-xl bg-surface p-1 shadow-pop motion-safe:animate-rise-in"
            >
                {options.map((option, index) => {
                    const active = index === activeIndex;
                    const common = {
                        id: optionId(index),
                        role: 'option',
                        'aria-selected': active,
                        onMouseDown: (event: MouseEvent) => event.preventDefault(),
                        onMouseMove: () => setActiveIndex(index),
                        onClick: () => choose(option),
                        className: cn(
                            'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5',
                            active && 'bg-muted',
                        ),
                    } as const;
                    if (option.kind === 'extra') {
                        return (
                            <li key={option.extra.id} {...common}>
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
                                    {option.extra.icon}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium">{option.extra.label}</span>
                                    <span className="block text-xs text-muted-foreground">{option.extra.description}</span>
                                </span>
                            </li>
                        );
                    }
                    const stop = option.entry;
                    return (
                        <li key={stop.stopPointId} {...common}>
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                <MapPin className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1">
                                    <span className="truncate text-sm font-medium">{stop.name}</span>
                                    {stop.accessible && (
                                        <Accessibility
                                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                            role="img"
                                            aria-label="Arrêt accessible"
                                        />
                                    )}
                                </span>
                                {stop.city && <span className="block truncate text-xs text-muted-foreground">{stop.city}</span>}
                            </span>
                            <LineBadgeList lines={stop.lines ?? []} linesById={linesById} max={4} className="max-w-[45%] justify-end" />
                        </li>
                    );
                })}
            </ul>

            {showStatus && (
                <div
                    role="status"
                    className="absolute inset-x-0 top-full z-40 mt-1 rounded-xl bg-surface px-3 py-3 text-sm text-muted-foreground shadow-pop"
                >
                    {statusMessage}
                </div>
            )}
        </div>
    );
}
