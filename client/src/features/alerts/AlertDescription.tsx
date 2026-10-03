import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import type { DescriptionBlock } from './alertFormat';

/** Description of an alert, paragraphs and line breaks preserved. */
export function AlertDescription({ blocks, id, className }: { blocks: DescriptionBlock[]; id?: string; className?: string }) {
    return (
        <div id={id} className={cn('space-y-2 text-[13px] leading-relaxed text-muted-foreground', className)}>
            {blocks.map((block, index) =>
                block.kind === 'paragraph' ? (
                    <p key={index} className="break-words">
                        {block.lines.map((line, i) => (
                            <Fragment key={i}>
                                {i > 0 && <br />}
                                {line}
                            </Fragment>
                        ))}
                    </p>
                ) : (
                    <ul key={index} className="space-y-1">
                        {block.items.map((item, i) => (
                            <li key={i} className="relative break-words pl-3.5">
                                <span aria-hidden="true" className="absolute left-0.5 top-[0.6em] h-1 w-1 rounded-full bg-muted-foreground/60" />
                                {item}
                            </li>
                        ))}
                    </ul>
                ),
            )}
        </div>
    );
}
