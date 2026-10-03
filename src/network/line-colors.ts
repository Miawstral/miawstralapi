/** Official-ish colors of the Réseau Mistral lines. */
const LINE_COLORS: Record<string, string> = {
    '1': '#303f9f',
    '2': '#4db6ac',
    '3': '#f44336',
    '6': '#03a9f4',
    '9': '#9ccc65',
    '10': '#546e7a',
    '11': '#ab47bc',
    '12': '#d32f2f',
    '15': '#212121',
    '16': '#ba68c8',
    '17': '#f44336',
    '18': '#e1bee7',
    '20': '#ffa000',
    '23': '#6f304e',
    '28': '#8bc34a',
    '29': '#00e676',
    '31': '#ff9800',
    '33': '#ffeb3b',
    '36': '#7e57c2',
    '39': '#388e3c',
    '40': '#3f51b5',
    '55': '#7cb342',
    '63': '#90caf9',
    '65': '#29b6f6',
    '67': '#ffeb3b',
    '68': '#915a42',
    '70': '#00acc1',
    '72': '#cddc39',
    '81': '#ef5350',
    '82': '#f9a825',
    '83': '#fdd835',
    '84': '#f06292',
    '87': '#90caf9',
    '91': '#f06292',
    '92': '#ffa000',
    '98': '#fdd835',
    '101': '#29b6f6',
    '102': '#f06292',
    '103': '#546e7a',
    '111': '#fdd835',
    '112': '#f06292',
    '120': '#fdd835',
    '129': '#29b6f6',
    '191': '#d32f2f',
    U: '#f07f06',
};

/** Color of a line, or a stable color derived from its id. */
export function getLineColor(lineId: string): string {
    const known = LINE_COLORS[lineId];
    if (known) return known;

    let hash = 0;
    for (let i = 0; i < lineId.length; i++) {
        hash = (lineId.charCodeAt(i) + ((hash << 5) - hash)) | 0;
    }
    return `hsl(${Math.abs(hash % 360)}, 65%, 45%)`;
}

/** Numeric lines first, in numeric order, then the others alphabetically. */
export function compareLineIds(a: string, b: string): number {
    const na = Number(a);
    const nb = Number(b);
    const aNum = Number.isFinite(na);
    const bNum = Number.isFinite(nb);
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.localeCompare(b);
}
