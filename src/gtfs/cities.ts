/**
 * The GTFS has no city: Réseau Mistral stop ids start with a code of the
 * municipality (TOxxxx = Toulon, SExxxx = La Seyne-sur-Mer…).
 */
const CITY_BY_PREFIX: Record<string, string> = {
    BN: 'Toulon',
    CA: 'Carqueiranne',
    CR: 'La Crau',
    GA: 'La Garde',
    HY: 'Hyères',
    OL: 'Ollioules',
    PR: 'Le Pradet',
    RE: 'Le Revest-les-Eaux',
    SA: 'Sanary-sur-Mer',
    SE: 'La Seyne-sur-Mer',
    SI: 'Six-Fours-les-Plages',
    SM: 'Saint-Mandrier-sur-Mer',
    TE: 'Toulon',
    TO: 'Toulon',
    VA: 'La Valette-du-Var',
};

export function cityOfStop(stopId: string): string | null {
    return CITY_BY_PREFIX[stopId.slice(0, 2).toUpperCase()] ?? null;
}
