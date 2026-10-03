/**
 * Minimal RFC 4180 CSV reader: quoted fields, escaped quotes, CRLF, BOM.
 * Calls `onRow` with an object per record keyed by the header names.
 */
export function parseCsv(text: string, onRow: (row: Record<string, string>) => void): void {
    let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
    const n = text.length;
    let header: string[] | null = null;
    let fields: string[] = [];
    let field = '';

    const endRecord = () => {
        fields.push(field);
        field = '';
        if (!header) {
            header = fields.map(h => h.trim());
        } else if (fields.length > 1 || fields[0] !== '') {
            const row: Record<string, string> = {};
            for (let k = 0; k < header.length; k++) row[header[k]] = fields[k] ?? '';
            onRow(row);
        }
        fields = [];
    };

    while (i < n) {
        const c = text[i];
        if (c === '"') {
            i++;
            while (i < n) {
                if (text[i] === '"') {
                    if (text[i + 1] === '"') {
                        field += '"';
                        i += 2;
                    } else {
                        i++;
                        break;
                    }
                } else {
                    field += text[i++];
                }
            }
        } else if (c === ',') {
            fields.push(field);
            field = '';
            i++;
        } else if (c === '\n' || c === '\r') {
            endRecord();
            i += c === '\r' && text[i + 1] === '\n' ? 2 : 1;
        } else {
            const start = i;
            while (i < n && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r' && text[i] !== '"') i++;
            field += text.slice(start, i);
        }
    }
    if (field !== '' || fields.length > 0) endRecord();
}
