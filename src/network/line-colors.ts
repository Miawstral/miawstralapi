const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

/** Natural order of line ids: "2" < "8M" < "10" < "11B" < "U". */
export function compareLineIds(a: string, b: string): number {
    return collator.compare(a, b);
}
