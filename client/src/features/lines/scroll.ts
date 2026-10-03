import { useLayoutEffect, type RefObject } from 'react';

/** Nearest scrollable ancestor (the panel's scroll area, whatever the shell). */
export function scrollParent(element: HTMLElement | null): HTMLElement | null {
    let node = element?.parentElement ?? null;
    while (node && node !== document.body) {
        const { overflowY } = getComputedStyle(node);
        if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
        node = node.parentElement;
    }
    return null;
}

/**
 * When a view replaces another one in the panel (list → detail), brings its top
 * into view (the scroll area keeps the previous offset otherwise) and moves the
 * keyboard focus to `focusRef` without scrolling.
 */
export function useRevealOnMount(rootRef: RefObject<HTMLElement | null>, focusRef?: RefObject<HTMLElement | null>) {
    useLayoutEffect(() => {
        const root = rootRef.current;
        const parent = scrollParent(root);
        if (root && parent) {
            const offset = root.getBoundingClientRect().top - parent.getBoundingClientRect().top;
            if (offset < 0) parent.scrollTop += offset;
        }
        // Only take the focus from an element that was removed (the row the user activated).
        const active = document.activeElement;
        if (focusRef?.current && (!active || active === document.body || !active.isConnected)) {
            focusRef.current.focus({ preventScroll: true });
        }
        // Mount only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
