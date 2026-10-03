import { useId } from 'react';

/** Props of the panel controlled by <Tabs idBase=…>. */
export const tabPanelProps = (idBase: string, value: string) => ({
    role: 'tabpanel' as const,
    id: `${idBase}-panel`,
    'aria-labelledby': `${idBase}-tab-${value}`,
});

/** useId() usable in element ids and CSS selectors. */
export function useStableId(prefix: string) {
    return `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}
