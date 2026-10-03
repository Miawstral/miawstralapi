/** "+3 min", "-1 min", "à l'heure": display of a delay in seconds. */
export function formatDelay(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes === 0) return 'à l’heure';
    return `${minutes > 0 ? '+' : '−'}${Math.abs(minutes)} min`;
}

export type DelayTone = 'ontime' | 'late' | 'verylate' | 'early';

export function delayTone(seconds: number): DelayTone {
    const minutes = Math.round(seconds / 60);
    if (minutes <= -1) return 'early';
    if (minutes <= 1) return 'ontime';
    if (minutes <= 5) return 'late';
    return 'verylate';
}

/** Minutes from now (Date) to "HH:MM" today, handling the night (00:15 after 23:50). */
export function minutesFromNow(time: string, now: Date): number | null {
    const match = /^(\d{1,2}):(\d{2})/.exec(time);
    if (!match) return null;
    const target = Number(match[1]) * 60 + Number(match[2]);
    const current = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    let diff = target - current;
    if (diff < -12 * 60) diff += 24 * 60;
    return diff;
}

/** "à l'approche", "3 min", "1 h 05", or the time itself when far. */
export function formatCountdown(minutes: number | null, time: string): string {
    if (minutes === null) return time;
    if (minutes < 1) return 'à l’approche';
    if (minutes < 60) return `${Math.floor(minutes)} min`;
    return time;
}
