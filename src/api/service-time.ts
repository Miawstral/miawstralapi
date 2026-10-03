import { config } from '../config';
import { badRequest } from '../lib/http-error';
import { SERVICE_DAY_START_HOUR, serviceDateNow } from '../lib/time';
import { feedValidity } from '../network/network.store';

const previousDay = (date: string) => new Date(Date.parse(`${date}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/**
 * Service day and time (minutes since its midnight) of a request:
 * - nothing: now;
 * - a time only: today, a time before 3:00 being the end of the previous service day (24:30);
 * - a date: that day, from the given time or the start of the day.
 */
export function resolveServiceTime(date: string | undefined, minutes: number | undefined): { date: string; minutes: number } {
    const now = serviceDateNow(config.timezone);
    let result: { date: string; minutes: number };
    if (date === undefined) {
        if (minutes === undefined) result = { date: now.date, minutes: Math.floor(now.minutes) };
        // "00:30" means tonight, i.e. 24:30 of the current service day.
        else result = { date: now.date, minutes: minutes < SERVICE_DAY_START_HOUR * 60 ? minutes + 24 * 60 : minutes };
    } else {
        result = { date, minutes: minutes ?? (date === now.date ? Math.floor(now.minutes) : SERVICE_DAY_START_HOUR * 60) };
        if (minutes !== undefined && minutes < SERVICE_DAY_START_HOUR * 60) result = { date: previousDay(date), minutes: minutes + 24 * 60 };
    }

    const { from, to } = feedValidity();
    if (date !== undefined && from && to && (result.date < from || result.date > to)) {
        throw badRequest(`No timetable for ${date}: the timetables cover ${from} to ${to}.`);
    }
    return result;
}
