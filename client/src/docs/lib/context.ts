import { createContext, useContext } from 'react';
import type { SampleLanguage } from './codegen';
import type { DocsModel } from './spec';

export const ModelContext = createContext<DocsModel | null>(null);

export function useModel(): DocsModel {
    const model = useContext(ModelContext);
    if (!model) throw new Error('ModelContext manquant');
    return model;
}

/** Language of the code samples, shared by every endpoint. */
export const LanguageContext = createContext<{ language: SampleLanguage; setLanguage: (language: SampleLanguage) => void }>({
    language: 'curl',
    setLanguage: () => {},
});

export const useSampleLanguage = () => useContext(LanguageContext);

/** Base URL of the requests: the origin serving the page. */
export const BASE_URL = typeof window === 'undefined' ? '' : window.location.origin;
