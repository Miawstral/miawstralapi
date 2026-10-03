import { ChevronRight } from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Json } from '../lib/spec';
import { formatNumber } from '../lib/format';
import { cn } from '../lib/utils';

const INDENT = 14;
const PAGE = 50;

const isContainer = (value: Json): value is Json[] | { [key: string]: Json } => value !== null && typeof value === 'object';
const isPrimitiveArray = (value: Json) => Array.isArray(value) && value.every(v => !isContainer(v));

function Primitive({ value }: { value: Json }) {
    if (value === null || typeof value === 'boolean') return <span className="tok-literal">{String(value)}</span>;
    if (typeof value === 'number') return <span className="tok-number">{value}</span>;
    return <span className="tok-string">{JSON.stringify(value)}</span>;
}

function InlineArray({ value }: { value: Json[] }) {
    return (
        <>
            <span className="tok-punct">[</span>
            {value.map((v, i) => (
                <span key={i}>
                    <Primitive value={v} />
                    {i < value.length - 1 && <span className="tok-punct">, </span>}
                </span>
            ))}
            <span className="tok-punct">]</span>
        </>
    );
}

/** `{ stopPointId: "TOLIBI", name: "Liberté", … }` */
function preview(value: Json[] | { [key: string]: Json }): string {
    if (Array.isArray(value)) return `${formatNumber(value.length)} élément${value.length > 1 ? 's' : ''}`;
    const parts: string[] = [];
    let length = 0;
    for (const [k, v] of Object.entries(value)) {
        const text = isContainer(v) ? `${k}: ${Array.isArray(v) ? '[…]' : '{…}'}` : `${k}: ${JSON.stringify(v)}`;
        if (length + text.length > 56 && parts.length > 0) {
            parts.push('…');
            break;
        }
        parts.push(text);
        length += text.length + 2;
    }
    return parts.join(', ');
}

function defaultOpen(value: Json[] | { [key: string]: Json }, depth: number, index: number | null): boolean {
    if (depth === 0) return true;
    if (index !== null && index >= 3) return false;
    if (Array.isArray(value)) {
        // Long paths (geometries) stay closed.
        if (value.length > 6 && value.every(v => Array.isArray(v))) return false;
        return depth <= 4;
    }
    return depth <= 5;
}

function Line({ depth, children, style }: { depth: number; children: ReactNode; style?: CSSProperties }) {
    return (
        <div className="relative whitespace-pre-wrap break-words" style={{ paddingLeft: depth * INDENT + 16, ...style }}>
            {children}
        </div>
    );
}

function Key({ name }: { name: string | number | null }) {
    if (name === null || typeof name === 'number') return null;
    return (
        <>
            <span className="tok-key">{JSON.stringify(name)}</span>
            <span className="tok-punct">: </span>
        </>
    );
}

function Node({
    name,
    value,
    depth,
    last,
    index,
}: {
    name: string | number | null;
    value: Json;
    depth: number;
    last: boolean;
    index: number | null;
}) {
    const container = isContainer(value);
    const [open, setOpen] = useState(() => (container ? defaultOpen(value, depth, index) : true));
    const [limit, setLimit] = useState(PAGE);
    const comma = last ? null : <span className="tok-punct">,</span>;

    if (!container) {
        return (
            <Line depth={depth}>
                <Key name={name} />
                <Primitive value={value} />
                {comma}
            </Line>
        );
    }

    const array = Array.isArray(value);
    const entries: [string | number, Json][] = array ? value.map((v, i) => [i, v]) : Object.entries(value);
    const [openBracket, closeBracket] = array ? ['[', ']'] : ['{', '}'];

    if (entries.length === 0) {
        return (
            <Line depth={depth}>
                <Key name={name} />
                <span className="tok-punct">
                    {openBracket}
                    {closeBracket}
                </span>
                {comma}
            </Line>
        );
    }

    if (array && isPrimitiveArray(value) && JSON.stringify(value).length < 400) {
        return (
            <Line depth={depth}>
                <Key name={name} />
                <InlineArray value={value} />
                {comma}
            </Line>
        );
    }

    const toggle = (
        <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            aria-label={open ? 'Replier' : 'Déplier'}
            className="absolute top-[3px] flex h-[17px] w-[17px] items-center justify-center rounded text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200"
            style={{ left: depth * INDENT - 1 }}
        >
            <ChevronRight className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} aria-hidden="true" />
        </button>
    );

    if (!open) {
        return (
            <Line depth={depth}>
                {toggle}
                <Key name={name} />
                <button type="button" onClick={() => setOpen(true)} className="rounded text-left hover:bg-white/5">
                    <span className="tok-punct">{openBracket}</span>
                    <span className="px-1 text-zinc-500">{preview(value)}</span>
                    <span className="tok-punct">{closeBracket}</span>
                </button>
                {comma}
            </Line>
        );
    }

    const shown = entries.slice(0, limit);
    const hidden = entries.length - shown.length;
    return (
        <>
            <Line depth={depth}>
                {toggle}
                <Key name={name} />
                <span className="tok-punct">{openBracket}</span>
                {array && depth > 0 && <span className="ml-2 select-none text-[11px] text-zinc-600">{formatNumber(entries.length)}</span>}
            </Line>
            {shown.map(([k, v], i) => (
                <Node
                    key={k}
                    name={array ? null : k}
                    value={v}
                    depth={depth + 1}
                    last={i === entries.length - 1}
                    index={array ? i : null}
                />
            ))}
            {hidden > 0 && (
                <Line depth={depth + 1}>
                    <button
                        type="button"
                        onClick={() => setLimit(entries.length)}
                        className="rounded-md bg-white/5 px-2 py-0.5 font-sans text-[11.5px] font-medium text-zinc-300 transition-colors hover:bg-white/10"
                    >
                        Afficher les {formatNumber(hidden)} autres éléments
                    </button>
                </Line>
            )}
            <Line depth={depth}>
                <span className="tok-punct">{closeBracket}</span>
                {comma}
            </Line>
        </>
    );
}

/** JSON with foldable objects and arrays, for the dark code panels. */
export function JsonViewer({ value, className }: { value: Json; className?: string }) {
    return (
        <div className={cn('code-scroll overflow-auto py-3 pr-4 font-mono text-[12.5px] leading-[1.7]', className)}>
            <Node name={null} value={value} depth={0} last index={null} />
        </div>
    );
}
