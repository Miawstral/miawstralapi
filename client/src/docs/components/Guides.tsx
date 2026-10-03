import {
    ArrowLeftRight,
    Clock3,
    FileArchive,
    Gauge,
    Globe,
    Hash,
    MapPin,
    Radio,
    Timer,
    type LucideIcon,
} from 'lucide-react';
import { languageOf } from '../lib/highlight';
import { parseBlocks, splitSubsections } from '../lib/markdown';
import { normalize, type GuideSection } from '../lib/spec';
import { CodePanel } from './code';
import { Markdown } from './Markdown';

/** Icon of a card, from words of its title. */
const CARD_ICONS: [RegExp, LucideIcon][] = [
    [/arret/, MapPin],
    [/ligne|sens/, ArrowLeftRight],
    [/heure|journee|date/, Clock3],
    [/temps reel/, Radio],
    [/debit|limite/, Gauge],
    [/cache|etag/, Timer],
    [/compress/, FileArchive],
    [/cors|navigateur/, Globe],
];

function iconFor(title: string): LucideIcon {
    const key = normalize(title);
    return CARD_ICONS.find(([pattern]) => pattern.test(key))?.[1] ?? Hash;
}

function CodeBlocks({ source }: { source: string }) {
    const blocks = parseBlocks(source).filter(b => b.kind === 'code');
    return (
        <>
            {blocks.map((block, i) =>
                block.kind === 'code' ? (
                    <CodePanel
                        key={i}
                        code={block.text}
                        language={languageOf(block.lang)}
                        title={<span className="font-mono text-[10.5px] uppercase tracking-wider">{block.lang || 'texte'}</span>}
                    />
                ) : null,
            )}
        </>
    );
}

/** A "## " section of the API description. */
export function Guide({ guide, index }: { guide: GuideSection; index: number }) {
    const { lead, items } = splitSubsections(guide.body);
    const hasCode = parseBlocks(guide.body).some(b => b.kind === 'code');

    return (
        <section id={guide.id} aria-labelledby={`${guide.id}-title`} className="scroll-mt-20 border-t py-14 sm:py-16">
            <p className="font-mono text-xs font-medium text-muted-foreground">{String(index + 1).padStart(2, '0')}</p>
            <h2 id={`${guide.id}-title`} className="mt-1.5 text-[1.65rem] font-semibold tracking-tight text-foreground">
                {guide.title}
            </h2>
            {items.length > 0 ? (
                <>
                    {lead && <Markdown source={lead} className="mt-4 max-w-3xl" />}
                    <ul className="mt-6 grid gap-3 md:grid-cols-2">
                        {items.map(item => {
                            const Icon = iconFor(item.title);
                            return (
                                <li key={item.title} className="rounded-2xl bg-surface p-5 shadow-control">
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                                            <Icon className="h-4 w-4" aria-hidden="true" />
                                        </span>
                                        <h3 className="text-[15px] font-semibold text-foreground">{item.title}</h3>
                                    </div>
                                    <Markdown source={item.body} size="sm" className="mt-3" />
                                </li>
                            );
                        })}
                    </ul>
                </>
            ) : hasCode ? (
                <div className="mt-5 grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] xl:gap-12">
                    <Markdown source={guide.body} exclude={['code']} className="min-w-0" />
                    <div className="min-w-0 space-y-4">
                        <CodeBlocks source={guide.body} />
                    </div>
                </div>
            ) : (
                <Markdown source={guide.body} className="mt-5 max-w-3xl" />
            )}
        </section>
    );
}
