/**
 * Parser for the Markdown subset of the OpenAPI descriptions: headings,
 * paragraphs, lists, fenced code, tables; inline code, bold, italics, links.
 */

export type Block =
    | { kind: 'heading'; level: number; text: string }
    | { kind: 'paragraph'; text: string }
    | { kind: 'list'; ordered: boolean; items: string[] }
    | { kind: 'code'; lang: string; text: string }
    | { kind: 'table'; header: string[]; rows: string[][] };

export type Inline =
    | { kind: 'text'; text: string }
    | { kind: 'code'; text: string }
    | { kind: 'strong'; children: Inline[] }
    | { kind: 'em'; children: Inline[] }
    | { kind: 'link'; href: string; children: Inline[] };

const splitRow = (line: string) =>
    line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map(cell => cell.trim());

export function parseBlocks(markdown: string): Block[] {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const blocks: Block[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (line.trim() === '') {
            i++;
            continue;
        }
        const fence = /^```(\w*)/.exec(line);
        if (fence) {
            const code: string[] = [];
            i++;
            while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
            i++;
            blocks.push({ kind: 'code', lang: fence[1], text: code.join('\n') });
            continue;
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading) {
            blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2].trim() });
            i++;
            continue;
        }
        if (line.trim().startsWith('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? '')) {
            const header = splitRow(line);
            i += 2;
            const rows: string[][] = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(splitRow(lines[i++]));
            blocks.push({ kind: 'table', header, rows });
            continue;
        }
        const bullet = /^\s*([-*]|\d+\.)\s+/;
        if (bullet.test(line)) {
            const ordered = /^\s*\d+\./.test(line);
            const items: string[] = [];
            while (i < lines.length && lines[i].trim() !== '') {
                if (bullet.test(lines[i])) items.push(lines[i].replace(bullet, ''));
                else items[items.length - 1] += ` ${lines[i].trim()}`;
                i++;
            }
            blocks.push({ kind: 'list', ordered, items });
            continue;
        }
        const paragraph: string[] = [];
        while (
            i < lines.length &&
            lines[i].trim() !== '' &&
            !/^(#{1,6}\s|```)/.test(lines[i]) &&
            !bullet.test(lines[i]) &&
            !lines[i].trim().startsWith('|')
        ) {
            paragraph.push(lines[i++].trim());
        }
        blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    }
    return blocks;
}

const INLINE = /(`[^`]+`)|(\*\*(?:[^*]|\*(?!\*))+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/g;

/** French typography: no line break before « : ; ! ? » » nor after « « ». */
const typography = (text: string) => text.replace(/ ([:;!?»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');

export function parseInline(text: string): Inline[] {
    const result: Inline[] = [];
    let last = 0;
    for (const match of text.matchAll(INLINE)) {
        const index = match.index ?? 0;
        if (index > last) result.push({ kind: 'text', text: typography(text.slice(last, index)) });
        const [token] = match;
        if (match[1]) result.push({ kind: 'code', text: token.slice(1, -1) });
        else if (match[2]) result.push({ kind: 'strong', children: parseInline(token.slice(2, -2)) });
        else if (match[3]) result.push({ kind: 'em', children: parseInline(token.slice(1, -1)) });
        else {
            const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)!;
            result.push({ kind: 'link', href: link[2], children: parseInline(link[1]) });
        }
        last = index + token.length;
    }
    if (last < text.length) result.push({ kind: 'text', text: typography(text.slice(last)) });
    return result;
}

/** Splits a section on its "### " headings (for card layouts). */
export function splitSubsections(markdown: string): { lead: string; items: { title: string; body: string }[] } {
    const parts = markdown.split(/^### /m);
    const lead = parts.shift()?.trim() ?? '';
    const items = parts.map(part => {
        const newline = part.indexOf('\n');
        return newline < 0
            ? { title: part.trim(), body: '' }
            : { title: part.slice(0, newline).trim(), body: part.slice(newline + 1).trim() };
    });
    return { lead, items };
}

/** Plain text of some Markdown, for search and summaries. */
export const plainText = (markdown: string) =>
    markdown
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[`*#>|]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
