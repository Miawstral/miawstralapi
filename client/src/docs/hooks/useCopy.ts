import { useCallback, useEffect, useRef, useState } from 'react';
import { copyText } from '../lib/clipboard';

/** Copies text and reports it for a moment ("Copié"). */
export function useCopy(duration = 1600) {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);
    const copy = useCallback(
        async (text: string) => {
            const ok = await copyText(text);
            if (!ok) return;
            setCopied(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), duration);
        },
        [duration],
    );
    return { copied, copy };
}
