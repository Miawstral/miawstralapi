import { useNow } from '@/hooks/useNow';

/** "à l’instant", "il y a 12 s", "il y a 2 min": age of a refresh, ticking every second. */
export function UpdatedAgo({ updatedAt }: { updatedAt: number }) {
    const now = useNow(1_000);
    const seconds = Math.max(0, Math.round((now.getTime() - updatedAt) / 1000));
    const label = seconds < 5 ? 'à l’instant' : seconds < 60 ? `il y a ${seconds} s` : `il y a ${Math.floor(seconds / 60)} min`;
    return (
        <time dateTime={new Date(updatedAt).toISOString()} className="tnum">
            {label}
        </time>
    );
}
