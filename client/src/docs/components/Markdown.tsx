import { Fragment } from 'react';
import { languageOf } from '../lib/highlight';
import { parseBlocks, parseInline, type Block, type Inline } from '../lib/markdown';
import { cn } from '../lib/utils';
import { CodePanel } from './code';

function InlineNodes({ nodes }: { nodes: Inline[] }) {
    return (
        <>
            {nodes.map((node, i) => {
                switch (node.kind) {
                    case 'text':
                        return <Fragment key={i}>{node.text}</Fragment>;
                    case 'code':
                        return (
                            <code
                                key={i}
                                className={cn(
                                    'rounded-[5px] bg-muted px-[0.38em] py-[0.12em] font-mono text-[0.85em] font-medium text-foreground [box-decoration-break:clone]',
                                    // Short code stays on one line, long code may wrap anywhere.
                                    node.text.length <= 28 ? 'whitespace-nowrap' : '[overflow-wrap:anywhere]',
                                )}
                            >
                                {node.text}
                            </code>
                        );
                    case 'strong':
                        return (
                            <strong key={i} className="font-semibold text-foreground">
                                <InlineNodes nodes={node.children} />
                            </strong>
                        );
                    case 'em':
                        return (
                            <em key={i}>
                                <InlineNodes nodes={node.children} />
                            </em>
                        );
                    case 'link': {
                        const external = /^https?:/.test(node.href);
                        return (
                            <a
                                key={i}
                                href={node.href}
                                {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                                className="font-medium text-brand underline decoration-brand/30 underline-offset-[3px] transition-colors hover:decoration-brand"
                            >
                                <InlineNodes nodes={node.children} />
                            </a>
                        );
                    }
                }
            })}
        </>
    );
}

export function InlineMarkdown({ text }: { text: string }) {
    return <InlineNodes nodes={parseInline(text)} />;
}

function BlockNode({ block, size }: { block: Block; size: 'sm' | 'md' }) {
    const text = size === 'md' ? 'text-[15px] leading-7' : 'text-sm leading-6';
    switch (block.kind) {
        case 'heading':
            return block.level <= 2 ? (
                <h3 className="pt-2 text-lg font-semibold tracking-tight text-foreground">
                    <InlineMarkdown text={block.text} />
                </h3>
            ) : (
                <h4 className="pt-1 text-[15px] font-semibold text-foreground">
                    <InlineMarkdown text={block.text} />
                </h4>
            );
        case 'paragraph':
            return (
                <p className={cn(text, 'text-pretty text-muted-foreground')}>
                    <InlineMarkdown text={block.text} />
                </p>
            );
        case 'list':
            return block.ordered ? (
                <ol className={cn(text, 'space-y-2 text-muted-foreground')}>
                    {block.items.map((item, i) => (
                        <li key={i} className="flex gap-3">
                            <span
                                aria-hidden="true"
                                className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[11px] font-semibold text-foreground"
                            >
                                {i + 1}
                            </span>
                            <span className="min-w-0">
                                <InlineMarkdown text={item} />
                            </span>
                        </li>
                    ))}
                </ol>
            ) : (
                <ul className={cn(text, 'space-y-1.5 text-muted-foreground')}>
                    {block.items.map((item, i) => (
                        <li key={i} className="relative pl-5">
                            <span aria-hidden="true" className="absolute left-1 top-[0.7em] h-1.5 w-1.5 rounded-full bg-border" />
                            <InlineMarkdown text={item} />
                        </li>
                    ))}
                </ul>
            );
        case 'code':
            return (
                <CodePanel
                    code={block.text}
                    language={languageOf(block.lang)}
                    title={<span className="font-mono uppercase tracking-wider text-[10.5px]">{block.lang || 'texte'}</span>}
                />
            );
        case 'table':
            return (
                <div className="scrollbar-thin overflow-x-auto rounded-xl border bg-surface">
                    <table className="w-full border-collapse text-left text-sm">
                        <thead>
                            <tr className="border-b bg-subtle">
                                {block.header.map((cell, i) => (
                                    <th key={i} scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        <InlineMarkdown text={cell} />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {block.rows.map((row, r) => (
                                <tr key={r} className="border-b last:border-b-0">
                                    {row.map((cell, c) => (
                                        <td key={c} className={cn('px-4 py-2.5 align-top', c === 0 ? 'w-20 whitespace-nowrap' : 'text-muted-foreground')}>
                                            <InlineMarkdown text={cell} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
    }
}

/** Markdown blocks. `exclude` drops some kinds (e.g. code shown elsewhere). */
export function Markdown({
    source,
    size = 'md',
    className,
    exclude = [],
}: {
    source: string;
    size?: 'sm' | 'md';
    className?: string;
    exclude?: Block['kind'][];
}) {
    const blocks = parseBlocks(source).filter(b => !exclude.includes(b.kind));
    if (blocks.length === 0) return null;
    return (
        <div className={cn('space-y-4', className)}>
            {blocks.map((block, i) => (
                <BlockNode key={i} block={block} size={size} />
            ))}
        </div>
    );
}
