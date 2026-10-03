import { normalizeText } from '@/lib/text';
import type { ServiceAlert } from '@/types';

/**
 * Pure helpers to present GTFS-RT service alerts in French: effect labels,
 * effective period ("Depuis le 6 mars", "Le 4 oct. de 9 h à 17 h"…), status,
 * cleaned-up title and description paragraphs.
 *
 * Dates are shown in the network's time zone (Toulon), whatever the device's.
 */

export type AlertStatus = 'ongoing' | 'upcoming' | 'ended';
export type AlertTone = 'danger' | 'warning' | 'info';

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

export type AlertEffectKind =
    | 'NO_SERVICE'
    | 'REDUCED_SERVICE'
    | 'SIGNIFICANT_DELAYS'
    | 'DETOUR'
    | 'ADDITIONAL_SERVICE'
    | 'MODIFIED_SERVICE'
    | 'STOP_MOVED'
    | 'ACCESSIBILITY_ISSUE'
    | 'OTHER';

const EFFECTS: Record<AlertEffectKind, { label: string; tone: AlertTone }> = {
    NO_SERVICE: { label: 'Service interrompu', tone: 'danger' },
    REDUCED_SERVICE: { label: 'Service perturbé', tone: 'warning' },
    SIGNIFICANT_DELAYS: { label: 'Retards importants', tone: 'warning' },
    DETOUR: { label: 'Déviation', tone: 'warning' },
    ADDITIONAL_SERVICE: { label: 'Service renforcé', tone: 'info' },
    MODIFIED_SERVICE: { label: 'Service modifié', tone: 'info' },
    STOP_MOVED: { label: 'Arrêt déplacé', tone: 'warning' },
    ACCESSIBILITY_ISSUE: { label: 'Accessibilité réduite', tone: 'warning' },
    OTHER: { label: 'Information', tone: 'info' },
};

export function effectKind(effect: string | null): AlertEffectKind {
    const key = (effect ?? '').toUpperCase();
    return key in EFFECTS && key !== 'OTHER' ? (key as AlertEffectKind) : 'OTHER';
}

export function effectInfo(effect: string | null): { kind: AlertEffectKind; label: string; tone: AlertTone } {
    const kind = effectKind(effect);
    return { kind, ...EFFECTS[kind] };
}

// ---------------------------------------------------------------------------
// Network-local dates
// ---------------------------------------------------------------------------

const TIME_ZONE = 'Europe/Paris';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const partsFormatter = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
});

interface LocalParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
}

function localParts(date: Date): LocalParts {
    const out: Record<string, number> = {};
    for (const part of partsFormatter.formatToParts(date)) {
        if (part.type !== 'literal') out[part.type] = Number(part.value);
    }
    return { year: out.year, month: out.month, day: out.day, hour: out.hour % 24, minute: out.minute };
}

/** Date of a wall-clock time in the network's time zone. */
function localDate(year: number, month: number, day: number, hour = 0): Date {
    const guess = Date.UTC(year, month - 1, day, hour);
    const p = localParts(new Date(guess));
    const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - guess;
    return new Date(guess - offset);
}

const dayKey = (p: LocalParts) => p.year * 10_000 + p.month * 100 + p.day;

/** Calendar day of an end time: until 4 a.m. it still belongs to the previous service day. */
const endDayParts = (end: Date) => localParts(new Date(end.getTime() - 4 * HOUR));

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function dayNumber(p: LocalParts): string {
    return p.day === 1 ? '1er' : String(p.day);
}

/** "6 mars", "1er oct.", "4 janv. 2027" (the year only when it is not the current one). */
function formatDay(p: LocalParts, now: LocalParts, withMonth = true): string {
    if (!withMonth) return dayNumber(p);
    const year = p.year !== now.year ? ` ${p.year}` : '';
    return `${dayNumber(p)} ${MONTHS[p.month - 1]}${year}`;
}

/** "9 h", "17 h 30". */
function formatHour(p: LocalParts): string {
    return p.minute === 0 ? `${p.hour} h` : `${p.hour} h ${String(p.minute).padStart(2, '0')}`;
}

/** The disruption covers the whole service day at its start / end. */
const startsAtDayStart = (start: LocalParts) => start.hour < 6;
const endsAtDayEnd = (end: LocalParts) => end.hour >= 21 || end.hour < 4;

// ---------------------------------------------------------------------------
// Title dates ("Du 24/08 au 23/10 : …")
// ---------------------------------------------------------------------------

const DATE_TOKEN = String.raw`\d{1,2}(?:/\d{1,2})?(?:/\d{2,4})?`;
const TITLE_PREFIX = new RegExp(
    String.raw`^\s*(?:(à partir du|a partir du|dès le|des le|depuis le|du|le|les|jusqu['’]au)\s+)?(${DATE_TOKEN})(?:\s+(?:au|et|-)\s+(${DATE_TOKEN}))?\s*:\s*`,
    'i',
);

interface DayMonth {
    day: number;
    month: number | null;
    year: number | null;
}

function parseToken(token: string): DayMonth | null {
    const [d, m, y] = token.split('/').map(Number);
    if (!(d >= 1 && d <= 31)) return null;
    if (m !== undefined && !(m >= 1 && m <= 12)) return null;
    return { day: d, month: m ?? null, year: y === undefined ? null : y < 100 ? 2000 + y : y };
}

/** Dates announced in the title, which often differ from the publication window of the alert. */
function titleDates(title: string): { prefix: string; start: DayMonth | null; end: DayMonth | null } | null {
    const match = TITLE_PREFIX.exec(title);
    if (!match) return null;
    const keyword = (match[1] ?? '').toLowerCase();
    let first = parseToken(match[2]);
    let second = match[3] ? parseToken(match[3]) : null;
    if (!first) return null;
    // "Du 02 au 04/10": the first date takes the month of the second one.
    if (second && first.month === null) first = { ...first, month: second.month, year: first.year ?? second.year };
    if (first.month === null) return null;
    if (second && second.month === null) second = null;
    const untilOnly = keyword.startsWith('jusqu');
    return {
        prefix: match[0],
        start: untilOnly ? null : first,
        end: untilOnly ? first : second,
    };
}

/** Picks the year that puts a day/month inside (or right next to) the publication window. */
function resolveDay(value: DayMonth, start: Date | null, end: Date | null, now: Date): Date | null {
    if (value.month === null) return null;
    const month = value.month;
    const from = (start?.getTime() ?? -Infinity) - 2 * DAY;
    const to = (end?.getTime() ?? Infinity) + 2 * DAY;
    const reference = localParts(start ?? now).year;
    const years = value.year ? [value.year] : [reference, reference + 1, reference - 1];
    for (const year of years) {
        const date = localDate(year, month, value.day);
        if (date.getTime() >= from && date.getTime() <= to) return date;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Period & status
// ---------------------------------------------------------------------------

function parseIso(value: string | null): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * When the disruption really applies. The feed's active period usually starts
 * when the alert is published (weeks before roadworks): the date announced in
 * the title is preferred when it is later.
 */
export function effectivePeriod(alert: ServiceAlert, now: Date = new Date()): { start: Date | null; end: Date | null } {
    let start = parseIso(alert.start);
    let end = parseIso(alert.end);
    const fromTitle = titleDates(alert.title);
    if (fromTitle?.start) {
        const announced = resolveDay(fromTitle.start, start, end, now);
        if (announced && (!start || dayKey(localParts(announced)) > dayKey(localParts(start)))) start = announced;
    }
    if (fromTitle?.end && !end) {
        const announced = resolveDay(fromTitle.end, start, end, now);
        if (announced) end = new Date(announced.getTime() + DAY - 15 * 60_000);
    }
    return { start, end };
}

export function alertStatus(alert: ServiceAlert, now: Date = new Date()): AlertStatus {
    const { start, end } = effectivePeriod(alert, now);
    if (end && end.getTime() < now.getTime()) return 'ended';
    if (start && start.getTime() > now.getTime()) return 'upcoming';
    if (!start && !end) return alert.active ? 'ongoing' : 'upcoming';
    return 'ongoing';
}

/** Beyond this, an end date is most likely a placeholder ("until further notice"). */
const FAR_END = 45 * DAY;

/** "Depuis le 6 mars", "Jusqu'au 23 oct.", "Le 4 oct. de 9 h à 17 h", "Du 5 au 10 oct."… or null. */
export function formatAlertPeriod(alert: ServiceAlert, now: Date = new Date()): string | null {
    const { start, end } = effectivePeriod(alert, now);
    if (!start && !end) return null;
    const today = localParts(now);
    const s = start ? localParts(start) : null;
    const e = end ? localParts(end) : null;
    const eDay = end ? endDayParts(end) : null;
    const status = alertStatus(alert, now);

    if (status === 'ended' && eDay) return `Terminée le ${formatDay(eDay, today)}`;

    if (status === 'ongoing') {
        if (!end || !e || !eDay) return s ? `Depuis le ${formatDay(s, today)}` : null;
        if (dayKey(eDay) === dayKey(today)) {
            return endsAtDayEnd(e) ? 'Jusqu’à ce soir' : `Jusqu’à ${formatHour(e)}`;
        }
        if (s && end.getTime() - now.getTime() > FAR_END) return `Depuis le ${formatDay(s, today)}`;
        return `Jusqu’au ${formatDay(eDay, today)}${endsAtDayEnd(e) ? '' : ` à ${formatHour(e)}`}`;
    }

    // Upcoming.
    if (!s) return eDay ? `Jusqu’au ${formatDay(eDay, today)}` : null;
    if (!e || !eDay || !end || (start && end.getTime() - start.getTime() > FAR_END + 30 * DAY)) {
        return `À partir du ${formatDay(s, today)}${startsAtDayStart(s) ? '' : ` à ${formatHour(s)}`}`;
    }
    if (dayKey(eDay) === dayKey(s)) {
        const partial = !startsAtDayStart(s) || !endsAtDayEnd(e);
        return `Le ${formatDay(s, today)}${partial ? ` de ${formatHour(s)} à ${formatHour(e)}` : ''}`;
    }
    const sameMonth = s.year === eDay.year && s.month === eDay.month;
    return `Du ${formatDay(s, today, !sameMonth)} au ${formatDay(eDay, today)}`;
}

/** Full, unambiguous dates for a tooltip. */
export function formatAlertRange(alert: ServiceAlert): string | null {
    const format = new Intl.DateTimeFormat('fr-FR', {
        timeZone: TIME_ZONE,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
    });
    const start = parseIso(alert.start);
    const end = parseIso(alert.end);
    if (!start && !end) return null;
    if (start && end) return `Du ${format.format(start)} au ${format.format(end)}`;
    return start ? `À partir du ${format.format(start)}` : `Jusqu’au ${format.format(end!)}`;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** Title without the leading dates (shown separately), e.g. "Travaux Av Esprit Armando à La Seyne". */
export function alertTitle(alert: ServiceAlert): string {
    const parsed = titleDates(alert.title);
    const rest = parsed ? alert.title.slice(parsed.prefix.length).trim() : alert.title.trim();
    if (!rest) return alert.title.trim();
    return rest.charAt(0).toLocaleUpperCase('fr-FR') + rest.slice(1);
}

export type DescriptionBlock = { kind: 'paragraph'; lines: string[] } | { kind: 'list'; items: string[] };

/**
 * Paragraphs of the description (blank lines), keeping single line breaks;
 * runs of "- item" lines become lists. A first paragraph repeating the title is dropped.
 */
export function descriptionBlocks(alert: ServiceAlert): DescriptionBlock[] {
    const paragraphs = alert.description
        .replace(/\r\n?/g, '\n')
        .split(/\n\s*\n/)
        .map(p => p.split('\n').map(line => line.trim()).filter(Boolean))
        .filter(lines => lines.length > 0);

    if (paragraphs.length > 1 && normalizeText(paragraphs[0].join(' ')) === normalizeText(alert.title)) paragraphs.shift();

    const blocks: DescriptionBlock[] = [];
    for (const lines of paragraphs) {
        let text: string[] = [];
        let items: string[] = [];
        const flushText = () => {
            if (text.length) blocks.push({ kind: 'paragraph', lines: text });
            text = [];
        };
        const flushItems = () => {
            if (items.length) blocks.push({ kind: 'list', items });
            items = [];
        };
        for (const line of lines) {
            const item = /^[-•*–]\s+(.*)$/.exec(line);
            if (item) {
                flushText();
                items.push(item[1]);
            } else {
                flushItems();
                text.push(line);
            }
        }
        flushText();
        flushItems();
    }
    return blocks;
}

/** "Merci de votre compréhension." and the like: not worth a "read more". */
export function isCourtesyBlock(block: DescriptionBlock): boolean {
    return block.kind === 'paragraph' && /^(merci de votre (compr[ée]hension|patience)|nous vous prions de nous excuser)/i.test(block.lines.join(' '));
}

/** Plain text of the first block, for a collapsed preview. */
export function blocksPreview(blocks: DescriptionBlock[]): string {
    const first = blocks[0];
    if (!first) return '';
    return first.kind === 'paragraph' ? first.lines.join(' ') : first.items.join(' · ');
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

/** Alerts that are not over yet: ongoing first (newest first), then upcoming (soonest first). */
export function splitAlerts(alerts: ServiceAlert[], now: Date = new Date()): { ongoing: ServiceAlert[]; upcoming: ServiceAlert[] } {
    const withDates = alerts.map(alert => ({ alert, status: alertStatus(alert, now), period: effectivePeriod(alert, now) }));
    const time = (date: Date | null, fallback: number) => date?.getTime() ?? fallback;
    const ongoing = withDates
        .filter(a => a.status === 'ongoing')
        .sort((a, b) => time(b.period.start, 0) - time(a.period.start, 0))
        .map(a => a.alert);
    const upcoming = withDates
        .filter(a => a.status === 'upcoming')
        .sort((a, b) => time(a.period.start, Infinity) - time(b.period.start, Infinity))
        .map(a => a.alert);
    return { ongoing, upcoming };
}

/** Line id → alerts concerning it that are not over (ongoing ones first). */
export function alertsByLine(alerts: ServiceAlert[], now: Date = new Date()): Map<string, { alert: ServiceAlert; status: AlertStatus }[]> {
    const map = new Map<string, { alert: ServiceAlert; status: AlertStatus }[]>();
    for (const alert of alerts) {
        const status = alertStatus(alert, now);
        if (status === 'ended') continue;
        for (const line of alert.lines) {
            const list = map.get(line.id) ?? [];
            list.push({ alert, status });
            map.set(line.id, list);
        }
    }
    for (const list of map.values()) list.sort((a, b) => Number(a.status !== 'ongoing') - Number(b.status !== 'ongoing'));
    return map;
}
