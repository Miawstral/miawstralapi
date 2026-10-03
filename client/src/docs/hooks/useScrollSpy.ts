import { useEffect, useState } from 'react';

/**
 * Id of the section currently read: the last one whose top went above the
 * reading line (a bit under the top bar). `null` above the first one.
 */
export function useScrollSpy(ids: string[], offset = 120): string | null {
    const [active, setActive] = useState<string | null>(null);
    const key = ids.join('|');

    useEffect(() => {
        const list = key ? key.split('|') : [];
        let frame = 0;
        const update = () => {
            frame = 0;
            let current: string | null = null;
            for (const id of list) {
                const element = document.getElementById(id);
                if (!element) continue;
                if (element.getBoundingClientRect().top - offset <= 0) current = id;
                else break;
            }
            // At the very bottom, the last section is the one read.
            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4 && list.length) {
                current = list[list.length - 1];
            }
            setActive(current);
        };
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };
        schedule();
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
        };
    }, [key, offset]);

    return active;
}
