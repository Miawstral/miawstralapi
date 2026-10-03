/**
 * Tiny syntax highlighter for the languages of the code samples. Each language
 * is a list of rules tried in order at every position (the first match wins).
 */

export type TokenType =
    | 'key'
    | 'string'
    | 'number'
    | 'literal'
    | 'keyword'
    | 'function'
    | 'type'
    | 'comment'
    | 'flag'
    | 'command'
    | 'variable'
    | 'punct'
    | 'method'
    | 'header'
    | 'plain';

export interface Token {
    type: TokenType;
    text: string;
}

export type Language = 'json' | 'bash' | 'javascript' | 'typescript' | 'python' | 'http' | 'text';

type Rule = [RegExp, TokenType | ((match: RegExpExecArray, source: string, end: number) => TokenType)];

const JSON_RULES: Rule[] = [
    [/"(?:[^"\\\n]|\\.)*"/y, (_m, source, end) => (/^\s*:/.test(source.slice(end, end + 8)) ? 'key' : 'string')],
    [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y, 'number'],
    [/\b(?:true|false|null)\b/y, 'literal'],
    [/[{}[\],:]/y, 'punct'],
];

const BASH_RULES: Rule[] = [
    [/#[^\n]*/y, 'comment'],
    [/'[^']*'/y, 'string'],
    [/"(?:[^"\\]|\\.)*"/y, 'string'],
    [/\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/y, 'variable'],
    [/(?<=^|\n|\|\s?)\s*(?:curl|http|wget|jq)\b/y, 'command'],
    [/(?<=\s)--?[A-Za-z][\w-]*/y, 'flag'],
    [/\\(?=\n)/y, 'punct'],
];

const JS_KEYWORDS =
    'const|let|var|await|async|function|return|if|else|throw|new|import|from|export|type|interface|of|for|in|try|catch|typeof|as';
const JS_RULES: Rule[] = [
    [/\/\/[^\n]*/y, 'comment'],
    [/\/\*[\s\S]*?\*\//y, 'comment'],
    [/'(?:[^'\\\n]|\\.)*'/y, 'string'],
    [/"(?:[^"\\\n]|\\.)*"/y, 'string'],
    [/`(?:[^`\\]|\\.)*`/y, 'string'],
    [new RegExp(`\\b(?:${JS_KEYWORDS})\\b`, 'y'), 'keyword'],
    [/\b(?:true|false|null|undefined)\b/y, 'literal'],
    [/\b\d+(?:\.\d+)?\b/y, 'number'],
    [/\b[A-Z][A-Za-z0-9_]*\b/y, 'type'],
    [/\b[A-Za-z_$][\w$]*(?=\s*\()/y, 'function'],
    [/\b[A-Za-z_$][\w$]*(?=\s*:(?!:))/y, 'key'],
    [/[{}[\]();,.:=<>?!|&+*-]/y, 'punct'],
];

const PY_RULES: Rule[] = [
    [/#[^\n]*/y, 'comment'],
    [/[rfb]?"(?:[^"\\\n]|\\.)*"/y, 'string'],
    [/[rfb]?'(?:[^'\\\n]|\\.)*'/y, 'string'],
    [/\b(?:import|from|def|return|if|else|elif|raise|for|in|with|as|not|and|or|try|except|lambda)\b/y, 'keyword'],
    [/\b(?:True|False|None)\b/y, 'literal'],
    [/\b\d+(?:\.\d+)?\b/y, 'number'],
    [/\b[A-Za-z_]\w*(?=\s*\()/y, 'function'],
    [/\b[A-Za-z_]\w*(?==(?!=))/y, 'key'],
    [/[{}[\]();,.:=]/y, 'punct'],
];

const RULES: Record<Exclude<Language, 'http' | 'text'>, Rule[]> = {
    json: JSON_RULES,
    bash: BASH_RULES,
    javascript: JS_RULES,
    typescript: JS_RULES,
    python: PY_RULES,
};

function push(tokens: Token[], type: TokenType, text: string) {
    const last = tokens[tokens.length - 1];
    if (last && last.type === type) last.text += text;
    else tokens.push({ type, text });
}

function tokenizeWith(rules: Rule[], source: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    outer: while (i < source.length) {
        for (const [regex, type] of rules) {
            regex.lastIndex = i;
            const match = regex.exec(source);
            if (match && match[0].length > 0) {
                const end = i + match[0].length;
                push(tokens, typeof type === 'function' ? type(match, source, end) : type, match[0]);
                i = end;
                continue outer;
            }
        }
        push(tokens, 'plain', source[i]);
        i++;
    }
    return tokens;
}

/** HTTP message: request line, headers, then a JSON body. */
function tokenizeHttp(source: string): Token[] {
    const tokens: Token[] = [];
    const blank = source.indexOf('\n\n');
    const head = blank < 0 ? source : source.slice(0, blank);
    const body = blank < 0 ? '' : source.slice(blank);
    head.split('\n').forEach((line, index) => {
        if (index > 0) push(tokens, 'plain', '\n');
        const request = index === 0 && /^([A-Z]+)(\s+)(\S+)(.*)$/.exec(line);
        const header = index > 0 && /^([\w-]+)(:)(.*)$/.exec(line);
        if (request) {
            push(tokens, 'method', request[1]);
            push(tokens, 'plain', request[2]);
            push(tokens, 'string', request[3]);
            push(tokens, 'comment', request[4]);
        } else if (header) {
            push(tokens, 'header', header[1]);
            push(tokens, 'punct', header[2]);
            push(tokens, 'plain', header[3]);
        } else {
            push(tokens, 'plain', line);
        }
    });
    return [...tokens, ...tokenizeWith(JSON_RULES, body)];
}

export function tokenize(source: string, language: Language): Token[] {
    if (language === 'text') return [{ type: 'plain', text: source }];
    if (language === 'http') return tokenizeHttp(source);
    return tokenizeWith(RULES[language], source);
}

export function languageOf(name: string | undefined): Language {
    switch ((name ?? '').toLowerCase()) {
        case 'json':
            return 'json';
        case 'bash':
        case 'sh':
        case 'shell':
        case 'curl':
            return 'bash';
        case 'js':
        case 'javascript':
            return 'javascript';
        case 'ts':
        case 'typescript':
            return 'typescript';
        case 'py':
        case 'python':
            return 'python';
        case 'http':
            return 'http';
        default:
            return 'text';
    }
}
