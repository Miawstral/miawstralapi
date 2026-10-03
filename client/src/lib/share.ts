import type { RouteOption } from '@/types';
import { formatDuration } from './format';

/** Shares the current page (Web Share API on phones, clipboard elsewhere). Returns what happened. */
export async function shareCurrentPage(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
    const url = window.location.href;
    try {
        if (navigator.share) {
            await navigator.share({ title, text, url });
            return 'shared';
        }
        await navigator.clipboard.writeText(url);
        return 'copied';
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'failed';
        try {
            await navigator.clipboard.writeText(url);
            return 'copied';
        } catch {
            return 'failed';
        }
    }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-05" + "08:15" (may be "24:10") → local ICS date-time "20261005T081500". */
function icsDateTime(serviceDate: string, time: string): string {
    const [h, m] = time.split(':').map(Number);
    const date = new Date(`${serviceDate}T00:00:00Z`);
    date.setUTCMinutes(h * 60 + m);
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00`;
}

const escapeIcs = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => `\\${m}`);

/** Downloads the itinerary as a calendar event (.ics). */
export function downloadRouteEvent(route: RouteOption, serviceDate: string, from: string, to: string): void {
    const lines = route.steps.map(step =>
        step.type === 'bus'
            ? `${step.departureTime} Ligne ${step.line} → ${step.headsign}, de ${step.from.name} à ${step.to.name} (${step.arrivalTime})`
            : `${step.departureTime} Marche ${formatDuration(step.duration)}${step.to.name ? ` jusqu'à ${step.to.name}` : ''}`,
    );
    const now = new Date();
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
    const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Miawstral//Itineraire//FR',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:${stamp}-${Math.random().toString(36).slice(2)}@miawstral`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=Europe/Paris:${icsDateTime(serviceDate, route.departureTime)}`,
        `DTEND;TZID=Europe/Paris:${icsDateTime(serviceDate, route.arrivalTime)}`,
        `SUMMARY:${escapeIcs(`Trajet ${from} → ${to}`)}`,
        `DESCRIPTION:${escapeIcs(`${lines.join('\n')}\n\n${window.location.href}`)}`,
        `URL:${window.location.href}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT10M',
        'ACTION:DISPLAY',
        'DESCRIPTION:Départ dans 10 minutes',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `trajet-${serviceDate}-${route.departureTime.replace(':', 'h')}.ics` });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
